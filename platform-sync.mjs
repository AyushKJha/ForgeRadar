import {execFile} from 'node:child_process';
import {readFile,readdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const cwd=path.dirname(fileURLToPath(import.meta.url));
const root=cwd;
const token=await new Promise((resolve,reject)=>{const child=execFile('git',['credential','fill'],{windowsHide:true,timeout:12000,env:{...process.env,GIT_TERMINAL_PROMPT:'0',GCM_INTERACTIVE:'Never'}},(error,stdout)=>{if(error)return reject(new Error('Saved GitHub credential lookup failed'));const match=stdout.match(/^password=(.+)$/m);if(!match)return reject(new Error('No saved GitHub token'));resolve(match[1].trim());});child.stdin.end('protocol=https\nhost=github.com\n\n');});
async function api(endpoint,method='GET',body){const r=await fetch('https://api.github.com'+endpoint,{method,headers:{Authorization:`Bearer ${token}`,'User-Agent':'ForgeRadar-platform','Accept':'application/vnd.github+json',...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(20000)});if(!r.ok){const e=new Error(`GitHub HTTP ${r.status} at ${endpoint}`);e.status=r.status;throw e;}return r.json();}
const me=await api('/user');const name='ForgeRadar';let repo;
try{repo=await api(`/repos/${me.login}/${name}`);}catch(e){if(e.status!==404)throw e;repo=await api('/user/repos','POST',{name,private:true,auto_init:true,description:'Local multi-agent opportunity discovery, evaluation, proposal, build and GitHub synchronization console.'});}
if(!repo.private||repo.owner.login!==me.login)throw new Error('Expected a private repository owned by the authenticated account');
const allowed=['.gitignore','README.md','package.json','server.mjs','orchestrator.mjs','social-sources.mjs','competition.mjs','tests.mjs','daily.mjs','platform-sync.mjs','start.ps1','remote.mjs','remote-tests.mjs','smoke.mjs','bridge.mjs','render.yaml','AUDIT.md','.env.example'];const files=[];
for(const filename of allowed)try{files.push({path:filename,content:await readFile(path.join(root,filename),'utf8')});}catch(e){if(e.code!=='ENOENT')throw e;}
for(const item of await readdir(path.join(root,'public'),{withFileTypes:true}))if(item.isFile()&&/\.(html|css|js)$/.test(item.name))files.push({path:'public/'+item.name,content:await readFile(path.join(root,'public',item.name),'utf8')});
for(const file of files)if(/(?:github_pat_|gh[pousr]_)[A-Za-z0-9_]{20,}|sk-proj-[A-Za-z0-9_-]{20,}/.test(file.content))throw new Error('Secret-like string detected in source; publication stopped');
const base=`/repos/${me.login}/${name}`;let ref;for(let i=0;i<4;i++){try{ref=await api(base+'/git/ref/heads/'+repo.default_branch);break;}catch(e){if(i===3)throw e;await new Promise(r=>setTimeout(r,1000));}}
const commit=await api(base+'/git/commits/'+ref.object.sha);const tree=[];
for(const file of files){const blob=await api(base+'/git/blobs','POST',{content:file.content,encoding:'utf-8'});tree.push({path:file.path,mode:'100644',type:'blob',sha:blob.sha});}
const newTree=await api(base+'/git/trees','POST',{base_tree:commit.tree.sha,tree});
if(newTree.sha===commit.tree.sha){console.log(JSON.stringify({repository:repo.html_url,visibility:'private',status:'No source changes'}));process.exit(0);}
const created=await api(base+'/git/commits','POST',{message:process.argv[2]||'Build local multi-agent orchestration and exposed agent operations console',tree:newTree.sha,parents:[ref.object.sha]});await api(base+'/git/refs/heads/'+repo.default_branch,'PATCH',{sha:created.sha,force:false});
await writeFile(path.join(root,'data','platform-repository.json'),JSON.stringify({owner:me.login,name,url:repo.html_url,private:true,branch:repo.default_branch,commit:created.sha},null,2));console.log(JSON.stringify({repository:repo.html_url,visibility:'private',commit:created.sha,files:files.length}));
