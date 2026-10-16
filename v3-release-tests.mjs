import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {buildV3Application} from './v3-builder.mjs';
import {releaseReview,scanReleaseTree} from './v3-release.mjs';

const repositoryRoot=path.dirname(fileURLToPath(import.meta.url));
const project={id:randomUUID(),status:'approved',title:'Signal Analysis Desk',problem:'Review observations locally',scope:'Persistent observations',goal:'Compare observations',successMetric:'Store three records'};
const spec={title:'Signal Analysis Desk',description:'Observations',entities:[{name:'observations',label:'Observations',fields:[{name:'label',label:'Label',type:'text',required:true,options:[]}]}]};

test('release review inspects actual built files and blocks unfinished tasks',async()=>{
  const root=await mkdtemp(path.join(os.tmpdir(),'forge-v3-release-'));
  try{const built=await buildV3Application({project,repositoryRoot,workspaceRoot:root,model:'fixture',generate:async()=>spec});
    const build={id:built.id,status:'passed',folder:built.folder,spec:built.spec,report:{checks:built.checks}};
    const review=await releaseReview({project,build,tasks:[{id:randomUUID(),title:'Manual acceptance',status:'review'}]});
    assert.equal(review.readiness,'blocked');assert.equal(review.incompleteTasks.length,1);assert.equal(review.findings.length,0);
    assert.equal(review.publicActionAvailable,false);
    await writeFile(path.join(built.folder,'.env'),'APP_PASSWORD=example-secret-123456789');
    const unsafe=await scanReleaseTree(built.folder);assert.equal(unsafe.ready,false);assert.equal(unsafe.findings[0].kind,'unexpected-file');
  }finally{await rm(root,{recursive:true,force:true});}
});

test('release scan rejects platform branding and secret-like values',async()=>{
  const root=await mkdtemp(path.join(os.tmpdir(),'forge-v3-secret-'));
  try{await writeFile(path.join(root,'README.md'),'# ForgeRadar\n\n## Run locally\n## Validate\n## Source and limitations\n');
    await writeFile(path.join(root,'server.mjs'),'const token = "github_pat_abcdefghijklmnopqrstuvwx"');
    const scan=await scanReleaseTree(root);assert.equal(scan.ready,false);
    assert.ok(scan.findings.some(item=>item.kind==='platform-branding'));
    assert.ok(scan.findings.some(item=>item.kind==='possible-secret'));
  }finally{await rm(root,{recursive:true,force:true});}
});
