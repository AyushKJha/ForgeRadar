import {mkdir,copyFile} from 'node:fs/promises';
import path from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {scanReleaseTree} from './v3-release.mjs';

const execute=promisify(execFile);
export const validRepoName=value=>typeof value==='string'&&/^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/.test(value)&&!value.endsWith('.')&&!value.endsWith('.git');

export async function savedGithubToken(){
  const fromEnvironment=process.env.GITHUB_TOKEN||process.env.GH_TOKEN;
  if(fromEnvironment)return fromEnvironment;
  return new Promise(resolve=>{const child=execFile('git',['credential','fill'],{timeout:10000,windowsHide:true,env:{...process.env,GIT_TERMINAL_PROMPT:'0',GCM_INTERACTIVE:'Never'}},(error,stdout)=>{if(error)return resolve(null);resolve(stdout.match(/^password=(.+)$/m)?.[1]?.trim()||null);});child.stdin.end('protocol=https\nhost=github.com\n\n');});
}

export async function githubApi(token,endpoint,method='GET',body){
  if(!/^\/(?:user|repos\/)[A-Za-z0-9_./-]*$/.test(endpoint))throw new Error('Invalid GitHub API endpoint');
  const response=await fetch('https://api.github.com'+endpoint,{method,headers:{'Authorization':`Bearer ${token}`,'Accept':'application/vnd.github+json','User-Agent':'ForgeRadar-local-release','X-GitHub-Api-Version':'2026-03-10',...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(30000)});
  if(!response.ok){const error=new Error(`GitHub returned HTTP ${response.status} during ${method} ${endpoint}`);error.status=response.status;throw error;}
  return response.status===204?null:response.json();
}

const localGit=async(cwd,args)=>{const result=await execute('git',args,{cwd,timeout:60000,windowsHide:true,maxBuffer:200000,env:{...process.env,GIT_TERMINAL_PROMPT:'0',GCM_INTERACTIVE:'Never'}});return result.stdout.trim();};

export async function publishPublicRepository({sourceFolder,stagingFolder,repoName,expectedFingerprint,confirmed,acknowledgeHumanReview,api,git=localGit}){
  if(confirmed!==true||acknowledgeHumanReview!==true)throw new Error('Final public-release confirmation and human review are required');
  if(!validRepoName(repoName)||!/^[a-f0-9]{64}$/i.test(expectedFingerprint))throw new Error('Invalid repository name or release fingerprint');
  const scan=await scanReleaseTree(sourceFolder);
  if(!scan.ready||scan.fingerprint!==expectedFingerprint)throw new Error('Release files changed or failed the final scan; review again');
  const me=await api('/user');
  if(!/^[A-Za-z0-9-]{1,39}$/.test(me?.login||''))throw new Error('GitHub account identity unavailable');
  await mkdir(stagingFolder,{recursive:false});
  for(const file of scan.files)await copyFile(path.join(sourceFolder,file.name),path.join(stagingFolder,file.name));
  await git(stagingFolder,['init','-b','main']);await git(stagingFolder,['add','--all']);
  await git(stagingFolder,['-c',`user.name=${me.login}`,'-c',`user.email=${me.login}@users.noreply.github.com`,'commit','-m','Initial verified release']);
  const localSha=await git(stagingFolder,['rev-parse','HEAD']);
  if(!/^[a-f0-9]{40}$/.test(localSha))throw new Error('Local release commit was not created');
  const created=await api('/user/repos','POST',{name:repoName,description:'Independent project source and local run instructions',private:true,auto_init:false});
  if(created?.owner?.login?.toLowerCase()!==me.login.toLowerCase()||created?.private!==true)throw new Error('GitHub created an unexpected repository; release stopped before public exposure');
  const repositoryUrl=`https://github.com/${me.login}/${repoName}`;
  try{
    await git(stagingFolder,['remote','add','origin',repositoryUrl+'.git']);
    await git(stagingFolder,['push','-u','origin','main']);
    const remote=await api(`/repos/${me.login}/${repoName}/git/ref/heads/main`);
    if(remote?.object?.sha!==localSha)throw new Error('Remote commit does not match the reviewed staging tree');
    const publicRepo=await api(`/repos/${me.login}/${repoName}`,'PATCH',{private:false});
    if(publicRepo?.private!==false)throw new Error('GitHub did not confirm public visibility');
    const verified=await api(`/repos/${me.login}/${repoName}`);
    if(verified?.private!==false)throw new Error('Public visibility could not be verified');
    return {repositoryUrl,commitSha:localSha,visibility:'public',websiteUrl:null,hosting:'Code published; Node + SQLite runtime requires a separate host'};
  }catch(error){error.privateRepositoryUrl=repositoryUrl;throw error;}
}
