import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {buildV3Application} from './v3-builder.mjs';

const repositoryRoot=path.dirname(fileURLToPath(import.meta.url));
const project={id:randomUUID(),status:'approved',title:'Noise Analysis Desk',problem:'Review locally collected noise measurements',goal:'Compare observations',successMetric:'Store and search three observations',scope:'Local measurement log',sourceUrl:null};
const spec={title:'Model title',description:'A small measurement log',entities:[{name:'measurements',label:'Measurements',fields:[{name:'label',label:'Label',type:'text',required:true,options:[]},{name:'value',label:'Value',type:'number',required:true,options:[]}]}]};

test('approved local project generates and tests a runnable independent workspace',async()=>{
  const directory=await mkdtemp(path.join(os.tmpdir(),'forge-v3-build-'));
  try{const result=await buildV3Application({project,repositoryRoot,workspaceRoot:directory,model:'test-model',generate:async()=>spec});
    assert.equal(result.spec.title,project.title);assert.equal(result.checks.at(-1).status,'passed');
    assert.match(await readFile(path.join(result.folder,'README.md'),'utf8'),/node --test app\.test\.mjs/);
    const packageData=JSON.parse(await readFile(path.join(result.folder,'package.json'),'utf8'));
    assert.equal(packageData.name,'noise-analysis-desk');
    assert.doesNotMatch(await readFile(path.join(result.folder,'workspace.html'),'utf8'),/ForgeRadar/i);
  }finally{await rm(directory,{recursive:true,force:true});}
});

test('unapproved project cannot build',async()=>{
  await assert.rejects(()=>buildV3Application({project:{...project,status:'proposal'},repositoryRoot,workspaceRoot:os.tmpdir(),model:'test-model',generate:async()=>spec}),/approved project/);
});
