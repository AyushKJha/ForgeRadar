import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {openV3Store} from './v3-store.mjs';
import {compileApp} from './fullstack.mjs';
import {normalizeProjectDesign} from './project-design.mjs';

const root=path.dirname(fileURLToPath(import.meta.url));
const proposal={title:'Field Notes',problem:'Keep equipment readings',goal:'Find readings quickly',successMetric:'Save and find three records',scope:'Offline equipment log',sourceUrl:''};
const spec={title:'Field Notes',description:'Equipment readings',entities:[{name:'readings',label:'Readings',fields:[{name:'label',label:'Label',type:'text',required:true,options:[]}]}]};

test('project design is validated and stored only on the approved owner project',async()=>{
  const directory=await mkdtemp(path.join(os.tmpdir(),'forge-design-'));const store=openV3Store(path.join(directory,'test.sqlite'));
  try{const owner=store.createUser('owner@design.test','a-long-password-123','owner'),other=store.createUser('other@design.test','a-long-password-456');const project=store.createProject(owner.id,proposal);
    assert.throws(()=>store.approveProject(owner.id,project.id,{style:'unsafe-style'}),/supported style/);
    assert.equal(store.project(owner.id,project.id).status,'proposal');
    const approved=store.approveProject(owner.id,project.id,{style:'neumorphism',palette:'ember',motion:'playful'});
    assert.deepEqual(approved.design,{style:'neumorphism',palette:'ember',motion:'playful'});
    assert.equal(store.project(other.id,project.id),null);
    assert.equal(store.projects(other.id).length,0);
  }finally{store.close();await rm(directory,{recursive:true,force:true});}
});

test('approved design changes generated project assets and keeps real data controls',async()=>{
  const files=await compileApp(spec,root,{style:'retro',palette:'citrus',motion:'none'});
  const get=name=>files.find(file=>file.path===name)?.content;
  assert.deepEqual(JSON.parse(get('design.json')),{style:'retro',palette:'citrus',motion:'none'});
  assert.match(get('workspace.html'),/data-style="retro" data-palette="citrus" data-motion="none"/);
  assert.match(get('workspace.html'),/id="sort"/);
  assert.match(get('workspace.js'),/editing\?'update':'create'/);
  assert.match(get('workspace.css'),/body\[data-style="retro"\]/);
  assert.throws(()=>normalizeProjectDesign({motion:'flashing'}),/supported style/);
});
