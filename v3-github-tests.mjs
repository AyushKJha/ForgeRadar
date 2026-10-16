import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {buildV3Application} from './v3-builder.mjs';
import {scanReleaseTree} from './v3-release.mjs';
import {publishPublicRepository,validRepoName} from './v3-github.mjs';

const repositoryRoot=path.dirname(fileURLToPath(import.meta.url));
const project={id:randomUUID(),status:'approved',title:'Signal Desk',problem:'Review signals',scope:'Local data log',goal:'Track signals',successMetric:'Store three records'};
const spec={title:'Signal Desk',description:'Signals',entities:[{name:'signals',label:'Signals',fields:[{name:'label',label:'Label',type:'text',required:true,options:[]}]}]};

test('public release gates on final confirmation and publishes only after verified private push',async()=>{
  const root=await mkdtemp(path.join(os.tmpdir(),'forge-v3-github-'));
  try{const built=await buildV3Application({project,repositoryRoot,workspaceRoot:root,model:'fixture',generate:async()=>spec});
    const scan=await scanReleaseTree(built.folder),stagingParent=path.join(root,'release');await mkdir(stagingParent);
    const calls=[],sha='a'.repeat(40);let publicState=false;
    const api=async(endpoint,method='GET',body)=>{calls.push([method,endpoint,body]);if(endpoint==='/user')return {login:'example-owner'};if(endpoint==='/user/repos')return {owner:{login:'example-owner'},private:true};if(method==='PATCH'){publicState=true;return {private:false};}if(endpoint.endsWith('/git/ref/heads/main'))return {object:{sha}};return {private:!publicState};};
    const git=async(_cwd,args)=>{calls.push(['git',...args]);return args[0]==='rev-parse'?sha:'';};
    await assert.rejects(()=>publishPublicRepository({sourceFolder:built.folder,stagingFolder:path.join(stagingParent,'no-confirm'),repoName:'signal-desk',expectedFingerprint:scan.fingerprint,confirmed:false,acknowledgeHumanReview:true,api,git}),/confirmation/);
    assert.equal(calls.length,0);
    const result=await publishPublicRepository({sourceFolder:built.folder,stagingFolder:path.join(stagingParent,'release-one'),repoName:'signal-desk',expectedFingerprint:scan.fingerprint,confirmed:true,acknowledgeHumanReview:true,api,git});
    assert.equal(result.visibility,'public');assert.equal(result.websiteUrl,null);
    assert.ok(calls.findIndex(item=>item[0]==='git'&&item[1]==='push')<calls.findIndex(item=>item[0]==='PATCH'));
    assert.equal(validRepoName('../unsafe'),false);
  }finally{await rm(root,{recursive:true,force:true});}
});

test('failed push never requests public visibility',async()=>{
  const root=await mkdtemp(path.join(os.tmpdir(),'forge-v3-github-fail-'));
  try{const built=await buildV3Application({project,repositoryRoot,workspaceRoot:root,model:'fixture',generate:async()=>spec});const scan=await scanReleaseTree(built.folder);const stagingParent=path.join(root,'release');await mkdir(stagingParent);
    const methods=[],api=async(endpoint,method='GET')=>{methods.push(method);return endpoint==='/user'?{login:'example-owner'}:{owner:{login:'example-owner'},private:true};};
    const git=async(_cwd,args)=>{if(args[0]==='rev-parse')return 'b'.repeat(40);if(args[0]==='push')throw new Error('Push failed');return '';};
    await assert.rejects(()=>publishPublicRepository({sourceFolder:built.folder,stagingFolder:path.join(stagingParent,'release-one'),repoName:'signal-desk',expectedFingerprint:scan.fingerprint,confirmed:true,acknowledgeHumanReview:true,api,git}),error=>error.privateRepositoryUrl==='https://github.com/example-owner/signal-desk');
    assert.equal(methods.includes('PATCH'),false);
  }finally{await rm(root,{recursive:true,force:true});}
});
