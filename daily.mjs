import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
const root=path.dirname(fileURLToPath(import.meta.url));
const headers=async()=>{try{return {Authorization:'Bearer '+JSON.parse(await readFile(path.join(root,'data/local-service-token.json'),'utf8')).token};}catch(error){if(error.code==='ENOENT')return {};throw error;}};
const engineUrl='http://127.0.0.1:4317/api/machine';
const requestMachine=async()=>fetch(engineUrl,{headers:await headers(),signal:AbortSignal.timeout(3000)});
const connectionCode=error=>error?.cause?.code||error?.code;
try{const response=await requestMachine();if(!response.ok)throw new Error(`Engine health check returned HTTP ${response.status}`);}catch(error){
 const code=connectionCode(error);
 if(code==='EACCES'||code==='EPERM')throw new Error(`ForgeRadar is already expected to run locally, but this process is not allowed to connect to 127.0.0.1:4317 (${code}). No duplicate service was started. Run this task outside the restricted sandbox or allow local loopback access.`);
 if(code&&code!=='ECONNREFUSED'&&code!=='ECONNRESET'&&code!=='ETIMEDOUT'&&code!=='UND_ERR_CONNECT_TIMEOUT')throw error;
 execFileSync('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-File',path.join(root,'start.ps1')],{windowsHide:true,stdio:'pipe',timeout:120000});
 await new Promise(r=>setTimeout(r,1000));
}
const get=async()=>{const r=await requestMachine();if(!r.ok)throw new Error(`Engine status unavailable (HTTP ${r.status})`);return r.json();};
const before=await get();if(!before.automation.enabled){console.log('Automation is paused; no work started.');}else if(before.machine.status==='running'){console.log('A mission is already running; no duplicate work started.');}else {
const day=new Date(Date.now()+330*60000).toISOString().slice(0,10);if(before.automation.lastDay===day){console.log('Today’s daily work is already complete.');}else {
const r=await fetch('http://127.0.0.1:4317/api/mission',{method:'POST',headers:{'Content-Type':'application/json',...await headers()},body:JSON.stringify({kind:'daily'})});if(!r.ok)throw new Error((await r.json()).error);
console.log('Daily agent mission started.');let final;
for(let i=0;i<180;i++){await new Promise(r=>setTimeout(r,5000));final=await get();if(final.machine.status!=='running')break;}
console.log(JSON.stringify({status:final.machine.status,stage:final.machine.stage,error:final.machine.error||null,owner:final.github.owner}));
if(final.machine.status==='blocked')process.exitCode=1;
}}
