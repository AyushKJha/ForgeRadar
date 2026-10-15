// Manual, optional local-model smoke test. Creates only disposable temporary data.
import {mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
const directory=await mkdtemp(path.join(os.tmpdir(),'forge-v3-model-smoke-'));
process.env.FORGERADAR_DATA_DIR=directory;
const {server,closeLocalRuntime}=await import('./server.mjs?smoke='+Date.now());
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const port=server.address().port;
const request=(route,body,cookie)=>new Promise((resolve,reject)=>{
 const payload=JSON.stringify(body);const req=http.request({hostname:'127.0.0.1',port,path:route,method:'POST',headers:{Host:'localhost:4317',Origin:'http://localhost:4317','Content-Type':'application/json','Content-Length':Buffer.byteLength(payload),...(cookie?{Cookie:cookie}:{})}},response=>{let text='';response.on('data',chunk=>text+=chunk);response.on('end',()=>resolve({status:response.statusCode,headers:response.headers,body:JSON.parse(text)}));});req.on('error',reject);req.end(payload);
});
try{
 const account=await request('/api/account/register',{email:'smoke@example.test',password:'a-disposable-local-password'});
 if(account.status!==200)throw new Error('Test account creation failed');
 const cookie=account.headers['set-cookie'][0].split(';')[0];
 const proposal=await request('/api/account/projects',{title:'Offline CSV quality checker',problem:'Small teams need a local way to detect missing and duplicate rows in a CSV fixture.',goal:'Report data quality findings offline.',successMetric:'Find all known issues in a 20-row fixture.',scope:'Import CSV, validate rows, export a report.'},cookie);
 if(proposal.status!==200)throw new Error('Test proposal creation failed: '+JSON.stringify(proposal.body));
 const id=proposal.body.project.id;
 const approval=await request(`/api/account/projects/${id}/approve`,{confirm:true},cookie);
 if(approval.status!==200)throw new Error('Test approval failed');
 const started=Date.now();const plan=await request(`/api/account/projects/${id}/suggest-tasks`,{},cookie);
 if(plan.status!==200)throw new Error('Local model planner failed: '+JSON.stringify(plan.body));
 if(!plan.body.suggestions.length||plan.body.inserted!==0||plan.body.execution!=='local Ollama')throw new Error('Planner did not return review-only tasks');
 console.log(JSON.stringify({model:plan.body.model,suggestions:plan.body.suggestions.length,inserted:plan.body.inserted,elapsedSeconds:Math.round((Date.now()-started)/1000)}));
}finally{await new Promise(resolve=>server.close(resolve));closeLocalRuntime();await rm(directory,{recursive:true,force:true});}
