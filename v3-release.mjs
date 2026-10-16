import {readdir,lstat,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';

const allowed=new Set(['app.json','package.json','.gitignore','.env.example','app-kit.mjs','workspace.html','workspace.js','workspace.css','server.mjs','app.test.mjs','README.md']);
const secretPatterns=[/(?:ghp_|github_pat_|gho_|ghu_|ghs_|ghr_)[A-Za-z0-9_]{20,}/i,/sk-proj-[A-Za-z0-9_-]{20,}/i,/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/i,/(?:password|secret|api[_-]?key|token)\s*[:=]\s*["']?[A-Za-z0-9/+_-]{16,}/i];
const platformBrand=/forgeradar|chatgpt(?:\.com)?|codex(?:\.openai\.com)?/i;

export async function scanReleaseTree(folder){
  const names=await readdir(folder),files=[],findings=[];
  for(const name of names){
    if(!allowed.has(name)){findings.push({file:name,kind:'unexpected-file',detail:'Only reviewed application files may enter the release staging tree'});continue;}
    const location=path.join(folder,name),stat=await lstat(location);
    if(!stat.isFile()||stat.isSymbolicLink()){findings.push({file:name,kind:'unsafe-file',detail:'Symlinks and directories are excluded'});continue;}
    if(stat.size>500000){findings.push({file:name,kind:'oversized-file',detail:'Review files over 500 KB separately'});continue;}
    const content=await readFile(location,'utf8');
    if(secretPatterns.some(pattern=>pattern.test(content)))findings.push({file:name,kind:'possible-secret',detail:'Secret-like content needs manual review'});
    if(platformBrand.test(content))findings.push({file:name,kind:'platform-branding',detail:'Independent project source must not advertise the platform'});
    files.push({name,bytes:stat.size,sha256:createHash('sha256').update(content).digest('hex')});
  }
  for(const required of ['README.md','package.json','app.test.mjs','server.mjs','app.json'])if(!names.includes(required))findings.push({file:required,kind:'missing-file',detail:'Required release file is absent'});
  if(names.includes('README.md')){const readme=await readFile(path.join(folder,'README.md'),'utf8');for(const section of ['Run locally','Validate','Source and limitations'])if(!readme.includes(`## ${section}`))findings.push({file:'README.md',kind:'incomplete-readme',detail:`Missing ${section} section`});}
  return {ready:findings.length===0,files,findings,scannedAt:new Date().toISOString()};
}

export async function releaseReview({project,build,tasks}){
  if(!project||!build||build.status!=='passed'||!build.report||!build.spec)throw new Error('A passed local build is required for release review');
  const scan=await scanReleaseTree(build.folder);
  const incomplete=tasks.filter(task=>!task.archivedAt&&task.status!=='done').map(task=>({id:task.id,title:task.title,status:task.status}));
  const checks=[{name:'Local build and acceptance tests',status:build.report.checks?.every(check=>check.status==='passed')?'passed':'blocked'},{name:'Release file and secret scan',status:scan.ready?'passed':'blocked'},{name:'Approved task completion',status:incomplete.length?'blocked':'passed'},{name:'Domain-specific human review',status:'human-review-needed'},{name:'Public hosting compatibility',status:'human-review-needed'}];
  return {projectId:project.id,buildId:build.id,scannedAt:scan.scannedAt,files:scan.files,findings:scan.findings,incompleteTasks:incomplete,checks,readiness:checks.some(check=>check.status==='blocked')?'blocked':'human-review-needed',publicActionAvailable:false,hostingOptions:[{kind:'local',detail:'Runs while the owner computer is online; private access needs the configured tailnet.'},{kind:'static',detail:'This Node + SQLite application cannot run as a GitHub Pages static site.'},{kind:'public-host',detail:'Requires a separately reviewed compatible host and explicit owner approval.'}]};
}
