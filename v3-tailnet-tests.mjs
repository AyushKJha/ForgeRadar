import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
test('configured private tailnet host preserves account auth and secure cookies',async()=>{
 const directory=await mkdtemp(path.join(os.tmpdir(),'forge-v3-tailnet-'));
 process.env.FORGERADAR_DATA_DIR=directory;process.env.FORGERADAR_TAILSCALE_HOST='forge-test.example.ts.net';
 const {server,closeLocalRuntime}=await import('./server.mjs?tailnet-test');
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const port=server.address().port;
 const request=(method,route,body,cookie,origin='https://forge-test.example.ts.net',host='forge-test.example.ts.net',extra={})=>new Promise((resolve,reject)=>{const payload=body?JSON.stringify(body):'';const req=http.request({hostname:'127.0.0.1',port,path:route,method,headers:{Host:host,Origin:origin,...extra,...(cookie?{Cookie:cookie}:{}),...(body?{'Content-Type':'application/json','Content-Length':Buffer.byteLength(payload)}:{})}},response=>{let data='';response.on('data',chunk=>data+=chunk);response.on('end',()=>resolve({status:response.statusCode,headers:response.headers,body:data}));});req.on('error',reject);req.end(payload);});
 try{
  assert.equal((await request('GET','/api/account/session')).status,200);
  assert.equal((await request('GET','/api/account/session',null,null,undefined,'evil.example.ts.net')).status,403);
  assert.equal((await request('GET','/api/account/session',null,null,undefined,'localhost:4317',{'X-Forwarded-Host':'forge-test.example.ts.net','X-Forwarded-Proto':'https'})).status,200);
  assert.equal((await request('POST','/api/account/register',{email:'owner@example.test',password:'a-long-owner-password'},null,'http://forge-test.example.ts.net')).status,403);
  const owner=await request('POST','/api/account/register',{email:'owner@example.test',password:'a-long-owner-password'});assert.equal(owner.status,200);assert.match(owner.headers['set-cookie'][0],/Secure/);
  const member=await request('POST','/api/account/register',{email:'member@example.test',password:'a-long-member-password'});const cookie=member.headers['set-cookie'][0].split(';')[0];
  assert.equal((await request('GET','/v3',null,cookie)).status,200);
  assert.equal((await request('GET','/api/state',null,cookie)).status,403);
  assert.equal((await request('GET','/preview/not-a-project/index.html',null,cookie)).status,403);
 }finally{await new Promise(resolve=>server.close(resolve));closeLocalRuntime();delete process.env.FORGERADAR_DATA_DIR;delete process.env.FORGERADAR_TAILSCALE_HOST;await rm(directory,{recursive:true,force:true});}
});
