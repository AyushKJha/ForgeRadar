import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';

test('local HTTP accounts isolate profiles and protect legacy owner APIs',async()=>{
  const directory=await mkdtemp(path.join(os.tmpdir(),'forge-v3-http-'));
  await writeFile(path.join(directory,'state.json'),JSON.stringify({research:{enabled:[],query:'',records:[
    {sourceTitle:'Cybersecurity vulnerability detection',canonicalUrl:'https://openalex.org/W123',provider:'OpenAlex',publishedAt:'2024-01-01',retrievedAt:'2026-10-15'},
    {sourceTitle:'Malware threat detection',canonicalUrl:'https://openalex.org/W124',provider:'OpenAlex',publishedAt:'2024-02-01',retrievedAt:'2026-10-15'},
    {sourceTitle:'Developer web framework',canonicalUrl:'https://openalex.org/W125',provider:'OpenAlex',publishedAt:'2024-03-01',retrievedAt:'2026-10-15'}
  ],health:[],lastRefresh:null}}));
  process.env.FORGERADAR_DATA_DIR=directory;
  const {server,closeLocalRuntime}=await import('./server.mjs?auth-test');
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const port=server.address().port;
  const request=(method,route,body,cookie,authorization)=>new Promise((resolve,reject)=>{
    const payload=body?JSON.stringify(body):'';
    const req=http.request({hostname:'127.0.0.1',port,path:route,method,headers:{Host:'localhost:4317',...(method==='POST'||method==='DELETE'?{Origin:'http://localhost:4317'}:{}),...(body?{'Content-Type':'application/json','Content-Length':Buffer.byteLength(payload)}:{}),...(cookie?{Cookie:cookie}:{}),...(authorization?{Authorization:authorization}:{})}},response=>{let text='';response.on('data',chunk=>text+=chunk);response.on('end',()=>resolve({status:response.statusCode,headers:response.headers,body:response.headers['content-type']?.includes('application/json')?JSON.parse(text):text}));});req.on('error',reject);req.end(payload);
  });
  try{
    assert.equal((await request('GET','/api/state')).status,401);
    const owner=await request('POST','/api/account/register',{email:'owner@example.test',password:'a-long-owner-password'});
    assert.equal(owner.status,200);assert.equal(owner.body.user.role,'owner');
    const ownerCookie=owner.headers['set-cookie'][0].split(';')[0];
    const member=await request('POST','/api/account/register',{email:'member@example.test',password:'a-long-member-password'});
    assert.equal(member.status,200);assert.equal(member.body.user.role,'member');
    const memberCookie=member.headers['set-cookie'][0].split(';')[0];
    assert.equal((await request('GET','/api/state',null,memberCookie)).status,403);
    assert.equal((await request('GET','/api/state',null,ownerCookie)).status,200);
    assert.equal((await request('GET','/v3',null,memberCookie)).status,200);
    assert.equal((await request('GET','/style.css',null,memberCookie)).status,200);
    const saved=await request('POST','/api/account/profile',{consent:true,profile:{domains:['cybersecurity'],onboardingComplete:true}},memberCookie);
    assert.equal(saved.status,200);
    assert.deepEqual((await request('GET','/api/account/profile',null,memberCookie)).body.profile.domains,['cybersecurity']);
    assert.equal((await request('GET','/api/account/profile',null,ownerCookie)).body.profile,null);
    assert.equal((await request('GET','/api/account/discovery')).status,401);
    const memberDiscovery=await request('GET','/api/account/discovery?mode=focused',null,memberCookie);
    assert.equal(memberDiscovery.status,200);assert.equal(memberDiscovery.body.profileRequired,false);assert.deepEqual(memberDiscovery.body.items.map(item=>item.canonicalUrl).sort(),['https://openalex.org/W123','https://openalex.org/W124']);
    assert.equal((await request('GET','/api/account/discovery?mode=invalid',null,memberCookie)).status,400);
    assert.equal((await request('POST','/api/account/discovery-feedback',{canonicalUrl:'https://openalex.org/W123',status:'saved'},memberCookie)).status,200);
    assert.equal((await request('GET','/api/account/discovery-feedback',null,ownerCookie)).body.items.length,0);
    assert.equal((await request('POST','/api/account/battle',{urls:['https://openalex.org/W123','https://openalex.org/W124']},memberCookie)).status,403);
    assert.equal((await request('POST','/api/account/discovery-feedback',{canonicalUrl:'https://openalex.org/W124',status:'saved'},memberCookie)).status,200);
    assert.equal((await request('POST','/api/account/battle',{urls:['https://openalex.org/W123','https://openalex.org/W124']},memberCookie)).status,200);
    assert.equal((await request('POST','/api/account/discovery-feedback',{canonicalUrl:'https://openalex.org/W123',status:'dismissed',reason:'too common'},memberCookie)).status,200);
    assert.deepEqual((await request('GET','/api/account/discovery',null,memberCookie)).body.items.map(item=>item.canonicalUrl),['https://openalex.org/W124']);
    const localToken=JSON.parse(await readFile(path.join(directory,'local-service-token.json'),'utf8')).token;
    assert.equal((await request('GET','/api/state',null,null,'Bearer '+localToken)).status,200);
    assert.equal((await request('GET','/api/state',null,null,'Bearer wrong')).status,401);
  }finally{await new Promise(resolve=>server.close(resolve));closeLocalRuntime();delete process.env.FORGERADAR_DATA_DIR;await rm(directory,{recursive:true,force:true});}
});
