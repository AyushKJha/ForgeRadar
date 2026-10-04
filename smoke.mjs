import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
const root=path.dirname(fileURLToPath(import.meta.url));
const config=JSON.parse(await readFile(path.join(root,'data/deployment.json'),'utf8'));
if(config.url!=='https://forgeradar.onrender.com')throw new Error('Use only the verified ForgeRadar deployment.');
const url=config.url;
let r=await fetch(url+'/api/state');assert.equal(r.status,401,'Private state must require authentication');
r=await fetch(url+'/login',{method:'POST',redirect:'manual',headers:{Origin:url,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({password:config.password}).toString()});assert.equal(r.status,303,'Owner sign-in failed');const cookie=r.headers.get('set-cookie')?.split(';')[0];assert(cookie,'Session cookie missing');
const headers={Cookie:cookie,Origin:url,'Content-Type':'application/json'};
r=await fetch(url+'/');assert.match(await r.text(),/Workshop password/,'Public visitors should see sign-in');
r=await fetch(url+'/',{headers});assert.match(await r.text(),/id="promptInput"/,'Prompt composer is missing from deployment');
r=await fetch(url+'/api/state',{headers});const state=await r.json();assert.equal(state.workerOnline,true,'Laptop worker is offline');
r=await fetch(url+'/api/chat',{method:'POST',headers,body:JSON.stringify({text:'What is the current project and automation status?'})});assert.equal(r.status,202,'Prompt was not accepted');
let completed=false;
for(let i=0;i<30;i++){await new Promise(resolve=>setTimeout(resolve,2000));const machine=await (await fetch(url+'/api/machine',{headers})).json();const current=await (await fetch(url+'/api/state',{headers})).json();if(machine.machine.status!=='running'&&current.chat?.at(-1)?.role==='assistant'&&current.chat.length>(state.chat?.length||0)){assert.equal(machine.machine.status,'complete',machine.machine.error);assert.match(current.chat.at(-1).content,/Automation: (enabled|paused)/,'Status reply must use real configuration');completed=true;break;}}
assert(completed,'Remote prompt did not finish in time');
console.log(JSON.stringify({url,ownerLogin:'passed',unauthorizedState:'blocked',promptComposer:'present',worker:'online',remotePrompt:'completed'}));
