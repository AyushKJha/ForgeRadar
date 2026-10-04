import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.dirname(fileURLToPath(import.meta.url));
try{await fetch('http://127.0.0.1:4317/api/machine',{signal:AbortSignal.timeout(3000)});}catch{execFileSync('powershell.exe',['-NoProfile','-File',path.join(root,'start.ps1')],{windowsHide:true,stdio:'pipe',timeout:20000});await new Promise(r=>setTimeout(r,2000));}
const get=async()=>{const r=await fetch('http://127.0.0.1:4317/api/machine');if(!r.ok)throw new Error('Engine status unavailable');return r.json();};
const before=await get();if(!before.automation.enabled){console.log('Automation is paused; no work started.');process.exit(0);}if(before.machine.status==='running'){console.log('A mission is already running; no duplicate work started.');process.exit(0);}
const day=new Date(Date.now()+330*60000).toISOString().slice(0,10);if(before.automation.lastDay===day){console.log('Today’s daily work is already complete.');process.exit(0);}
const r=await fetch('http://127.0.0.1:4317/api/mission',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({kind:'daily'})});if(!r.ok)throw new Error((await r.json()).error);
console.log('Daily agent mission started.');let final;
for(let i=0;i<180;i++){await new Promise(r=>setTimeout(r,5000));final=await get();if(final.machine.status!=='running')break;}
console.log(JSON.stringify({status:final.machine.status,stage:final.machine.stage,error:final.machine.error||null,owner:final.github.owner}));
if(final.machine.status==='blocked')process.exitCode=1;
