import {mkdir,writeFile,readFile} from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {compileApp} from './fullstack.mjs';
import {validateSpec} from './app-kit.mjs';

const execute=promisify(execFile);
const slug=value=>String(value).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,55)||'project';

export async function buildV3Application({project,repositoryRoot,workspaceRoot,model,generate,runId=randomUUID()}){
  if(project.status!=='approved'||!/^[a-f0-9-]{36}$/i.test(project.id))throw new Error('An approved project is required');
  if(!/^[a-f0-9-]{36}$/i.test(runId))throw new Error('Invalid build identity');
  const folder=path.join(workspaceRoot,project.id,'builds',runId);
  const output=await generate({title:project.title,problem:project.problem,goal:project.goal,successMetric:project.successMetric,scope:project.scope});
  const spec=validateSpec(output);
  spec.title=project.title;
  const files=await compileApp(spec,repositoryRoot,project.design||{});
  const packageFile=files.find(file=>file.path==='package.json');
  const packageData=JSON.parse(packageFile.content);packageData.name=slug(project.title);packageFile.content=JSON.stringify(packageData,null,2);
  const htmlFile=files.find(file=>file.path==='workspace.html');
  htmlFile.content=htmlFile.content.replace('YOUR APPLICATION / PERSISTENT WORKSPACE',`PRIVATE PREVIEW / ${project.title.replace(/[&<>"']/g,'')}`).replace('Node.js + SQLite · owner workspace · data is stored on your laptop worker','Node.js + SQLite · private local project data');
  files.push({path:'README.md',content:`# ${project.title}\n\n${project.problem}\n\n## Current scope\n\n${project.scope}\n\nThis is a generated, local-first data workspace. It supports typed forms, persistent SQLite records, search, CSV/JSON import and JSON export. Domain-specific behavior beyond these features is not implemented.\n\n## Visual direction\n\nThe approved design is recorded in \`design.json\`. The interface includes responsive overview cards, collection switching, live search, sorting, record editing, import and export. Motion respects reduced-motion preferences.\n\n## Run locally\n\nInstall Node.js 24 or newer, then run \`node server.mjs\` from this folder. Open the printed local address. Set \`APP_PASSWORD\` before any non-loopback hosting. No third-party API key is required.\n\n## Validate\n\nRun \`node --test app.test.mjs\`. The generated build was tested with this command before private preview. Review domain-specific acceptance criteria manually.\n\n## Source and limitations\n\nProject proposal: ${project.sourceUrl||'user-defined idea'}. Originality, real-world effectiveness and public deployment remain unverified. No public release is included.\n`});
  await mkdir(folder,{recursive:true});
  for(const file of files){if(!/^[a-zA-Z0-9_.-]+$/.test(file.path))throw new Error('Unexpected generated filename');await writeFile(path.join(folder,file.path),file.content,'utf8');}
  const startedAt=new Date().toISOString(),checks=[];
  for(const file of files.filter(item=>/\.(?:js|mjs)$/.test(item.path))){await execute(process.execPath,['--check',file.path],{cwd:folder,timeout:15000,windowsHide:true,maxBuffer:500000});checks.push({name:`syntax ${file.path}`,status:'passed'});}
  const testResult=await execute(process.execPath,['--test','app.test.mjs'],{cwd:folder,timeout:30000,windowsHide:true,maxBuffer:1000000});
  checks.push({name:'persistent CRUD acceptance',status:'passed',output:(testResult.stdout+'\n'+testResult.stderr).slice(0,12000)});
  const savedSpec=JSON.parse(await readFile(path.join(folder,'app.json'),'utf8'));
  return {id:runId,folder,spec:savedSpec,model,startedAt,finishedAt:new Date().toISOString(),checks,files:files.map(file=>file.path)};
}
