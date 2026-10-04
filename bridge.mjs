import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url));
const config=JSON.parse(await readFile(path.join(root,'data/deployment.json'),'utf8'));
if(!/^https:\/\/[a-z0-9-]+\.onrender\.com$/.test(config.url)||config.token.length<32)throw new Error('Invalid deployment connection');
let completedId=null,lastCommandResult=null;try{completedId=JSON.parse(await readFile(path.join(root,'data/bridge-checkpoint.json'),'utf8')).completedId;}catch{}
async function local(route,body){const r=await fetch('http://127.0.0.1:4317/api/'+route,{...(body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(180000)});const result=await r.json();if(!r.ok)throw new Error(result.error);return result;}
for(;;){try{const [state,machine,models]=await Promise.all([local('state'),local('machine'),local('models')]);const previews={};for(const p of state.projects.filter(p=>p.preview)){previews[p.id]={};for(const f of ['index.html','style.css','app.js'])previews[p.id][f]=await readFile(path.join(root,'projects',p.id,f),'utf8');}
const r=await fetch(config.url+'/bridge',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+config.token},body:JSON.stringify({state,machine,models,previews,completedId,lastCommandResult}),signal:AbortSignal.timeout(90000)});if(!r.ok)throw new Error('Dashboard connection returned '+r.status);const {command}=await r.json();if(command&&command.id!==completedId){try{await local(command.route,command.body);lastCommandResult={id:command.id,at:new Date().toISOString(),route:command.route,ok:true,message:'Command delivered to laptop'};}catch(e){lastCommandResult={id:command.id,at:new Date().toISOString(),route:command.route,ok:false,message:e.message};}completedId=command.id;await writeFile(path.join(root,'data/bridge-checkpoint.json'),JSON.stringify({completedId}));console.log('Command processed: '+command.route);}}
catch(e){console.error(e.message);}await new Promise(r=>setTimeout(r,5000));}
