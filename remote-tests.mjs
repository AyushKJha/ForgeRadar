import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
process.env.FORGERADAR_BRIDGE_TOKEN=randomBytes(32).toString('hex');
process.env.FORGERADAR_ADMIN_PASSWORD=randomBytes(24).toString('hex');
const {server}=await import('./remote.mjs');
test('public dashboard protects state and serializes authenticated worker commands',async()=>{
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const url='http://127.0.0.1:'+server.address().port;
try{
let r=await fetch(url+'/api/state');assert.equal(r.status,401);
r=await fetch(url+'/bridge',{method:'POST',body:'{}'});assert.equal(r.status,401);
r=await fetch(url+'/login',{method:'POST',headers:{Origin:'https://evil.example'},body:'password='+process.env.FORGERADAR_ADMIN_PASSWORD});assert.equal(r.status,403);
r=await fetch(url+'/login',{method:'POST',headers:{Origin:url,Accept:'application/json'},body:'password='+process.env.FORGERADAR_ADMIN_PASSWORD});assert.equal(r.status,200);assert.equal((await r.json()).ok,true);assert.match(r.headers.get('set-cookie'),/forge_session=[a-f0-9]{64}\.[a-f0-9]+\.[a-f0-9]{64}; HttpOnly; Secure; SameSite=Strict/);
r=await fetch(url+'/login.js');assert.equal(r.status,200);assert.match(await r.text(),/preventDefault/);
r=await fetch(url+'/login',{method:'POST',redirect:'manual',headers:{Origin:url},body:'password='+process.env.FORGERADAR_ADMIN_PASSWORD});assert.equal(r.status,303);const cookie=r.headers.get('set-cookie').split(';')[0];assert.match(r.headers.get('set-cookie'),/HttpOnly; Secure; SameSite=Strict/);
r=await fetch(url+'/api/mission',{method:'POST',headers:{Cookie:cookie,Origin:url,'Content-Type':'application/json'},body:'{"kind":"discover"}'});assert.equal(r.status,503);
const snapshot={state:{busy:false,projects:[]},machine:{machine:{status:'idle'},events:[]},models:{connected:true,models:['test']}};
const bridge=body=>fetch(url+'/bridge',{method:'POST',headers:{Authorization:'Bearer '+process.env.FORGERADAR_BRIDGE_TOKEN,'Content-Type':'application/json'},body:JSON.stringify({...snapshot,...body})});
r=await bridge({});assert.equal(r.status,200);
r=await fetch(url+'/api/mission',{method:'POST',headers:{Cookie:cookie,Origin:'https://evil.example'},body:'{}'});assert.equal(r.status,403);
r=await fetch(url+'/api/mission',{method:'POST',headers:{Cookie:cookie,Origin:url,'Content-Type':'application/json'},body:'{"kind":"discover"}'});assert.equal(r.status,202);
r=await bridge({});const {command}=await r.json();assert.equal(command.body.kind,'discover');
r=await fetch(url+'/api/mission',{method:'POST',headers:{Cookie:cookie,Origin:url},body:'{}'});assert.equal(r.status,409);
r=await bridge({completedId:command.id});assert.equal((await r.json()).command,null);
r=await fetch(url+'/api/state',{headers:{Cookie:cookie}});assert.equal((await r.json()).workerOnline,true);
const commandId='browser-command-123';const submit=()=>fetch(url+'/api/chat',{method:'POST',headers:{Cookie:cookie,Origin:url,'Content-Type':'application/json'},body:JSON.stringify({text:'Show current progress',commandId})});
r=await submit();assert.equal(r.status,202);r=await submit();assert.equal(r.status,200);r=await fetch(url+'/api/commands',{headers:{Cookie:cookie}});assert.equal((await r.json()).results.filter(c=>c.id===commandId).length,1);await bridge({completedId:commandId,state:{busy:false,projects:[],commandReceipts:[{id:commandId,status:'complete'}]}});r=await submit();assert.equal((await r.json()).status,'complete');
const appId='11111111-1111-4111-8111-111111111111';await bridge({state:{busy:false,projects:[{id:appId,appSpec:{title:'Example'}}]}});const appRequest=fetch(url+'/apps/'+appId+'/api',{method:'POST',headers:{Cookie:cookie,Origin:url,'Content-Type':'application/json'},body:JSON.stringify({action:'list',entity:'items'})});
let appCommand;for(let retry=0;retry<20;retry++){r=await bridge({state:{busy:false,projects:[{id:appId,appSpec:{title:'Example'}}]}});appCommand=(await r.json()).command;if(appCommand)break;await new Promise(resolve=>setTimeout(resolve,10));}assert.equal(appCommand.route,'app');assert.equal(appCommand.body.projectId,appId);await bridge({completedId:appCommand.id,lastCommandResult:{id:appCommand.id,ok:true,result:[{id:'example-record',title:'Saved'}]}});r=await appRequest;assert.equal(r.status,200);assert.equal((await r.json())[0].title,'Saved');
}finally{await new Promise(resolve=>server.close(resolve));}
});
