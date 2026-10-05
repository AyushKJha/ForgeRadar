import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {validateSpec} from './app-kit.mjs';

export async function compileApp(spec,root){
 spec=validateSpec(spec);const files=[{path:'app.json',content:JSON.stringify(spec,null,2)},{path:'package.json',content:JSON.stringify({name:'forgeradar-workspace',private:true,type:'module',engines:{node:'>=24'},scripts:{start:'node server.mjs',test:'node --test app.test.mjs'}},null,2)},{path:'.gitignore',content:'data/\n.env\n.env.*\nnode_modules/\n'},{path:'.env.example',content:'HOST=127.0.0.1\nPORT=4320\n# Required when HOST is not loopback. Set in your hosting environment, never commit.\nAPP_PASSWORD=\n'}];
 files.push({path:'app-kit.mjs',content:await readFile(path.join(root,'app-kit.mjs'),'utf8')});
 for(const name of ['workspace.html','workspace.js','workspace.css'])files.push({path:name,content:await readFile(path.join(root,'public',name),'utf8')});
 files.push({path:'server.mjs',content:standaloneServer},{path:'app.test.mjs',content:standaloneTests});return files;
}
const standaloneServer=`import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {timingSafeEqual,createHmac,randomBytes} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {openApp} from './app-kit.mjs';
const root=path.dirname(fileURLToPath(import.meta.url)),host=process.env.HOST||'127.0.0.1',password=process.env.APP_PASSWORD;
if(!['127.0.0.1','localhost'].includes(host)&&(!password||password.length<16))throw new Error('Set an owner APP_PASSWORD of at least 16 characters before exposing this application.');
const app=openApp(JSON.parse(await readFile(path.join(root,'app.json'),'utf8')),path.join(root,'data/app.sqlite'));
const equal=(a,b)=>{const x=Buffer.from(String(a||'')),y=Buffer.from(String(b||''));return x.length===y.length&&timingSafeEqual(x,y);};
const attempts=new Map();const server=http.createServer(async(req,res)=>{const json=(status,body)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(body));};try{
res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");res.setHeader('Referrer-Policy','no-referrer');
const url=new URL(req.url,'http://localhost');if(['127.0.0.1','localhost'].includes(host)&&!['127.0.0.1:'+server.address().port,'localhost:'+server.address().port].includes(req.headers.host))return json(403,{error:'Unknown local host'});if(!['127.0.0.1','localhost'].includes(host)&&!req.headers.host)return json(403,{error:'Host required'});
let raw='';if(req.method==='POST'){const origin=req.headers.origin;if(origin&&origin!=='https://'+req.headers.host&&origin!=='http://'+req.headers.host)return json(403,{error:'Origin rejected'});for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>64000)return json(413,{error:'Request too large'});}}
if(password){const cookie=req.headers.cookie?.match(/(?:^|; )workspace=([a-f0-9]+\\.[a-f0-9]+\\.[a-f0-9]+)/)?.[1];const parts=(cookie||'').split('.');const valid=parts.length===3&&parseInt(parts[1],16)>Date.now()&&equal(parts[2],createHmac('sha256',password).update(parts[0]+'.'+parts[1]).digest('hex'));
if(url.pathname==='/login'&&req.method==='POST'){const ip=req.socket.remoteAddress;const previous=attempts.get(ip);if(previous&&Date.now()-previous.at<600000&&previous.count>=8)return json(429,{error:'Too many attempts. Try again in ten minutes.'});if(!equal(new URLSearchParams(raw).get('password'),password)){attempts.set(ip,{at:previous&&Date.now()-previous.at<600000?previous.at:Date.now(),count:previous&&Date.now()-previous.at<600000?previous.count+1:1});return json(401,{error:'Incorrect password'});}attempts.delete(ip);const value=randomBytes(16).toString('hex')+'.'+(Date.now()+43200000).toString(16);res.writeHead(303,{'Location':'/','Set-Cookie':'workspace='+value+'.'+createHmac('sha256',password).update(value).digest('hex')+'; HttpOnly; SameSite=Strict; Path=/; Max-Age=43200'+(!['127.0.0.1','localhost'].includes(host)?'; Secure':'')});return res.end();}
if(!valid){if(url.pathname==='/api')return json(401,{error:'Sign in first'});res.setHeader('Content-Type','text/html; charset=utf-8');return res.end('<!doctype html><html lang="en"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Owner sign in</title><h1>Owner workspace</h1><form method="post" action="/login"><label>Owner password<input name="password" type="password" autocomplete="current-password" required></label><button>Sign in</button></form></html>');}}
if(url.pathname==='/api'&&req.method==='POST'){if(req.headers.origin!=='https://'+req.headers.host&&req.headers.origin!=='http://'+req.headers.host)return json(403,{error:'Origin required'});return json(200,app.request(JSON.parse(raw)));}
const assets={'/':'workspace.html','/workspace.js':'workspace.js','/workspace.css':'workspace.css'};if(req.method!=='GET'||!assets[url.pathname])return json(404,{error:'Not found'});res.setHeader('Content-Type',url.pathname==='/'?'text/html; charset=utf-8':url.pathname.endsWith('.css')?'text/css':'text/javascript');res.end(await readFile(path.join(root,assets[url.pathname])));
}catch(error){json(400,{error:error.message});}});
server.listen(Number(process.env.PORT||4320),host,()=>console.log('Application listening on '+host+':'+server.address().port));
process.on('SIGTERM',()=>server.close(()=>{app.close();process.exit(0);}));
`;
const standaloneTests=`import test from 'node:test';import assert from 'node:assert/strict';import {mkdtemp,readFile,rm} from 'node:fs/promises';import os from 'node:os';import path from 'node:path';import {openApp,validateSpec} from './app-kit.mjs';
test('persistent CRUD, validation and idempotent writes',async()=>{const spec=validateSpec(JSON.parse(await readFile(new URL('./app.json',import.meta.url))));const folder=await mkdtemp(path.join(os.tmpdir(),'forge-app-'));const filename=path.join(folder,'db.sqlite');let app=openApp(spec,filename);try{const entity=spec.entities[0];const data=Object.fromEntries(entity.fields.map(f=>[f.name,f.type==='number'?12:f.type==='boolean'?false:f.type==='date'?'2026-10-05':f.type==='select'?f.options[0]:'Example']));const operation={action:'create',entity:entity.name,data,requestId:'create-record-123'};const created=app.request(operation);assert.deepEqual(app.request(operation),created);assert.equal(app.request({action:'list',entity:entity.name}).length,1);assert.throws(()=>app.request({...operation,requestId:'invalid-record-123',data:{unknown:'field'}}));app.close();app=openApp(spec,filename);assert.equal(app.request({action:'list',entity:entity.name})[0].id,created.id);const changed=app.request({action:'update',entity:entity.name,id:created.id,data,requestId:'update-record-123'});assert.equal(changed.id,created.id);app.request({action:'delete',entity:entity.name,id:created.id,requestId:'delete-record-123'});assert.equal(app.request({action:'list',entity:entity.name}).length,0);}finally{app.close();await rm(folder,{recursive:true,force:true});}});
`;
