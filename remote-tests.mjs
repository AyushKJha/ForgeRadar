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
r=await fetch(url+'/download/forgeradar-android.apk');assert.equal(r.status,200);assert.match(r.headers.get('content-type'),/application\/vnd\.android\.package-archive/);assert.equal(Buffer.from(await r.arrayBuffer()).subarray(0,2).toString(),'PK');
r=await fetch(url+'/bridge',{method:'POST',body:'{}'});assert.equal(r.status,401);
r=await fetch(url+'/login',{method:'POST',headers:{Origin:'https://evil.example'},body:'password='+process.env.FORGERADAR_ADMIN_PASSWORD});assert.equal(r.status,403);
r=await fetch(url+'/login',{method:'POST',headers:{Origin:url,Accept:'application/json'},body:'password='+process.env.FORGERADAR_ADMIN_PASSWORD});assert.equal(r.status,200);assert.equal((await r.json()).ok,true);assert.match(r.headers.get('set-cookie'),/forge_session=[a-f0-9]{64}\.[a-f0-9]+\.[a-f0-9]{64}; HttpOnly; Secure; SameSite=Strict/);
r=await fetch(url+'/login.js');assert.equal(r.status,200);assert.match(await r.text(),/preventDefault/);
 r=await fetch(url+'/');assert.equal(r.status,200);const loginPage=await r.text();assert.match(loginPage,/Create an account/);assert.match(loginPage,/id="toRegister"/);assert.match(loginPage,/private ForgeRadar workspace/);assert.doesNotMatch(loginPage,/invitation key/i);assert.match(loginPage,/src="\/login\.js"/);
r=await fetch(url+'/login',{method:'POST',redirect:'manual',headers:{Origin:url},body:'password='+process.env.FORGERADAR_ADMIN_PASSWORD});assert.equal(r.status,303);const cookie=r.headers.get('set-cookie').split(';')[0];assert.match(r.headers.get('set-cookie'),/HttpOnly; Secure; SameSite=Strict/);
r=await fetch(url+'/project-analytics.js',{headers:{Cookie:cookie}});assert.equal(r.status,200);assert.match(r.headers.get('content-type'),/javascript/);assert.match(await r.text(),/export function projectAnalytics/);
r=await fetch(url+'/api/mission',{method:'POST',headers:{Cookie:cookie,Origin:url,'Content-Type':'application/json'},body:'{"kind":"discover"}'});assert.equal(r.status,503);
const snapshot={state:{busy:false,projects:[]},machine:{machine:{status:'idle'},events:[]},models:{connected:true,models:['test']}};
const bridge=body=>fetch(url+'/bridge',{method:'POST',headers:{Authorization:'Bearer '+process.env.FORGERADAR_BRIDGE_TOKEN,'Content-Type':'application/json'},body:JSON.stringify({...snapshot,...body})});
r=await bridge({});assert.equal(r.status,200);
 const registerRequest=fetch(url+'/api/account/register',{method:'POST',headers:{Origin:url,'Content-Type':'application/json'},body:JSON.stringify({email:'new@example.test',password:'long-password-123'})});
 let authRequest;for(let retry=0;retry<30;retry++){r=await bridge({wait:false});authRequest=(await r.json()).authRequest;if(authRequest)break;await new Promise(resolve=>setTimeout(resolve,10));}
 assert.equal(authRequest.action,'register');assert.equal(authRequest.email,'new@example.test');assert.equal(authRequest.password,'long-password-123');assert.equal(authRequest.inviteKey,undefined);
 r=await bridge({wait:false,authResult:{id:authRequest.id,ok:true,result:{user:{id:'user-1',email:'new@example.test',role:'member'},sessionToken:'a'.repeat(64)}}});assert.equal(r.status,200);
 r=await registerRequest;assert.equal(r.status,200);assert.equal((await r.json()).user.email,'new@example.test');assert.match(r.headers.get('set-cookie'),/HttpOnly; Secure; SameSite=Strict/);const memberCookie=r.headers.get('set-cookie').split(';')[0];
 r=await fetch(url+'/',{headers:{Cookie:memberCookie},redirect:'manual'});assert.equal(r.status,303);assert.equal(r.headers.get('location'),'/v3');
 r=await fetch(url+'/v3',{headers:{Cookie:memberCookie}});assert.equal(r.status,200);assert.match(await r.text(),/Your profile/);
 r=await fetch(url+'/api/state',{headers:{Cookie:memberCookie}});assert.equal(r.status,403);
 r=await fetch(url+'/preview/11111111-1111-4111-8111-111111111111/index.html',{headers:{Cookie:memberCookie}});assert.equal(r.status,403);
 r=await fetch(url+'/apps/11111111-1111-4111-8111-111111111111/workspace.html',{headers:{Cookie:memberCookie}});assert.equal(r.status,403);
 const proxiedProfile=fetch(url+'/api/account/profile',{headers:{Cookie:memberCookie}});
 authRequest=null;for(let retry=0;retry<30;retry++){r=await bridge({wait:false});authRequest=(await r.json()).authRequest;if(authRequest)break;await new Promise(resolve=>setTimeout(resolve,10));}
 assert.equal(authRequest.action,'proxy');assert.equal(authRequest.method,'GET');assert.equal(authRequest.path,'/api/account/profile');assert.equal(authRequest.sessionToken,'a'.repeat(64));
 await bridge({wait:false,authResult:{id:authRequest.id,ok:true,result:{status:200,contentType:'application/json',body:Buffer.from('{"profile":null}').toString('base64')}}});r=await proxiedProfile;assert.equal(r.status,200);assert.deepEqual(await r.json(),{profile:null});
 const loginRequest=fetch(url+'/api/account/login',{method:'POST',headers:{Origin:url,'Content-Type':'application/json'},body:JSON.stringify({email:'new@example.test',password:'long-password-123'})});
 authRequest=null;for(let retry=0;retry<30;retry++){r=await bridge({wait:false});authRequest=(await r.json()).authRequest;if(authRequest)break;await new Promise(resolve=>setTimeout(resolve,10));}
 assert.equal(authRequest.action,'login');assert.equal(authRequest.email,'new@example.test');
 await bridge({wait:false,authResult:{id:authRequest.id,ok:true,result:{user:{id:'user-1',email:'new@example.test',role:'member'},sessionToken:'b'.repeat(64)}}});r=await loginRequest;assert.equal(r.status,200);
 const rejectedLogin=fetch(url+'/api/account/login',{method:'POST',headers:{Origin:url,'Content-Type':'application/json'},body:JSON.stringify({email:'new@example.test',password:'long-password-123'})});
 authRequest=null;for(let retry=0;retry<30;retry++){r=await bridge({wait:false});authRequest=(await r.json()).authRequest;if(authRequest)break;await new Promise(resolve=>setTimeout(resolve,10));}
 await bridge({wait:false,authResult:{id:authRequest.id,ok:false,status:401,message:'Incorrect email or password'}});r=await rejectedLogin;assert.equal(r.status,401);
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
r=await fetch(url+'/api/account/logout',{method:'POST',headers:{Cookie:cookie,Origin:'https://evil.example'}});assert.equal(r.status,403);
r=await fetch(url+'/api/account/logout',{method:'POST',headers:{Cookie:cookie,Origin:url}});assert.equal(r.status,200);assert.match(r.headers.get('set-cookie'),/forge_session=;.*Max-Age=0/);
r=await fetch(url+'/api/state',{headers:{Cookie:cookie}});assert.equal(r.status,401);
}finally{await new Promise(resolve=>server.close(resolve));}
});
