import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {openV3Store} from './v3-store.mjs';
import {createOrchestrator} from './orchestrator.mjs';

test('additive V3 migration records jobs, survives restart and interrupts unfinished work',async()=>{
  const directory=await mkdtemp(path.join(os.tmpdir(),'forge-v3-store-'));
  const filename=path.join(directory,'state.sqlite');
  try{
    let store=openV3Store(filename);
    assert.equal(store.schemaVersion,1);
    const complete=randomUUID(),interrupted=randomUUID();
    store.begin(complete,'discover');store.stage(complete,'scout');store.finish(complete,'complete','scout');
    store.begin(interrupted,'build');store.stage(interrupted,'builder');
    store.putCache('openalex:ai','openalex',{items:[{id:'a'}]},60000);
    store.close();
    store=openV3Store(filename);
    assert.equal(store.interruptedOnOpen,1);
    assert.equal(store.health().counts.complete,1);
    assert.equal(store.health().counts.interrupted,1);
    assert.deepEqual(store.getCache('openalex:ai').payload,{items:[{id:'a'}]});
    assert.throws(()=>store.putCache('../secret','openalex',{},60000));
    store.close();
  }finally{await rm(directory,{recursive:true,force:true});}
});

test('scheduler retains the next collection time across engine construction',()=>{
  const nextCollectAt='2026-10-15T18:30:00.000Z';
  const state={automation:{enabled:true,autoBuild:false,dailySync:false,intervalMinutes:360,nextCollectAt},opportunities:[],projects:[],signals:[]};
  const runtime=createOrchestrator({state,root:'unused',persist:async()=>{},refresh:async()=>{},models:async()=>({connected:false,models:[]}),jsonFetch:async()=>{},score:()=>0,proposal:()=>''});
  try{assert.equal(runtime.status().nextCollect,nextCollectAt);}
  finally{runtime.stop();}
});
