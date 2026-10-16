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
    assert.equal(store.schemaVersion,9);
    const complete=randomUUID(),interrupted=randomUUID();
    store.begin(complete,'discover');store.stage(complete,'scout');store.finish(complete,'complete','scout');
    store.begin(interrupted,'build');store.stage(interrupted,'builder');
    const queued=randomUUID(),claimed=randomUUID();
    store.enqueue({id:queued,kind:'discover',commandId:'discover-12345678'});
    store.enqueue({id:claimed,kind:'build',input:'approved-proposal'});
    assert.equal(store.claimNext().id,queued);
    store.putCache('openalex:ai','openalex',{items:[{id:'a'}]},60000);
    store.close();
    store=openV3Store(filename);
    assert.equal(store.interruptedOnOpen,2);
    assert.equal(store.health().counts.complete,1);
    assert.equal(store.health().counts.interrupted,1);
    assert.equal(store.health().pending,1);
    assert.equal(store.enqueue({id:randomUUID(),kind:'discover',commandId:'discover-12345678'}).id,queued);
    assert.equal(store.claimNext().id,claimed);
    store.finishCommand(claimed,'complete');
    assert.deepEqual(store.getCache('openalex:ai').payload,{items:[{id:'a'}]});
    assert.throws(()=>store.putCache('../secret','openalex',{},60000));
    store.close();
  }finally{await rm(directory,{recursive:true,force:true});}
});

test('local accounts hash passwords, expire sessions and isolate profile rows',async()=>{
  const directory=await mkdtemp(path.join(os.tmpdir(),'forge-v3-accounts-'));
  const store=openV3Store(path.join(directory,'accounts.sqlite'));
  try{
    const owner=store.createUser('owner@example.test','a-long-owner-password','owner');
    const member=store.createUser('member@example.test','a-long-member-password');
    assert.equal(store.verifyUser('owner@example.test','wrong-password'),null);
    assert.equal(store.verifyUser('owner@example.test','a-long-owner-password').id,owner.id);
    assert.throws(()=>store.createUser('another@example.test','another-long-password','owner'));
    const token=store.createSession(member.id);
    assert.equal(store.authenticate(token).id,member.id);
    store.saveProfile(owner.id,{domains:['cybersecurity']},true);
    assert.equal(store.loadProfile(member.id),null);
    store.saveProfile(member.id,{domains:['embedded_systems']},true);
    assert.deepEqual(store.loadProfile(owner.id).profile.domains,['cybersecurity']);
    assert.deepEqual(store.loadProfile(member.id).profile.domains,['embedded_systems']);
    store.destroySession(token);
    assert.equal(store.authenticate(token),null);
  }finally{store.close();await rm(directory,{recursive:true,force:true});}
});

test('saved and dismissed research feedback stays scoped to one account',async()=>{
  const directory=await mkdtemp(path.join(os.tmpdir(),'forge-v3-feedback-'));
  const store=openV3Store(path.join(directory,'feedback.sqlite'));
  try{
    const first=store.createUser('one@example.test','a-long-owner-password','owner');
    const second=store.createUser('two@example.test','another-long-password');
    const url='https://openalex.org/W12345';
    store.saveFeedback(first.id,url,'saved');
    assert.equal(store.listFeedback(second.id).length,0);
    store.saveFeedback(first.id,url,'dismissed','too costly');
    assert.deepEqual(store.listFeedback(first.id).map(item=>item.reason),['too costly']);
    assert.equal(store.deleteFeedback(second.id,url),0);
    assert.equal(store.deleteFeedback(first.id,url),1);
    assert.throws(()=>store.saveFeedback(first.id,'http://localhost/private','saved'));
  }finally{store.close();await rm(directory,{recursive:true,force:true});}
});
test('Eclipse is fixed while reduced-motion preferences persist per user',async()=>{
  const directory=await mkdtemp(path.join(os.tmpdir(),'forge-v3-themes-'));
  const filename=path.join(directory,'themes.sqlite');let store=openV3Store(filename);
  try{
    const first=store.createUser('one@example.test','a-long-owner-password','owner');
    const second=store.createUser('two@example.test','another-long-password');
    assert.equal(store.appearance(first.id).theme,'eclipse');
    store.saveAppearance(first.id,'eclipse',true);
    assert.throws(()=>store.saveAppearance(first.id,'sunset',false));
    store.close();store=openV3Store(filename);
    assert.deepEqual([store.appearance(first.id).theme,store.appearance(first.id).reducedMotion,store.appearance(second.id).theme],['eclipse',true,'eclipse']);
  }finally{store.close();await rm(directory,{recursive:true,force:true});}
});

test('scheduler retains the next collection time across engine construction',()=>{
  const nextCollectAt='2026-10-15T18:30:00.000Z';
  const state={automation:{enabled:true,autoBuild:false,dailySync:false,intervalMinutes:360,nextCollectAt},opportunities:[],projects:[],signals:[]};
  const runtime=createOrchestrator({state,root:'unused',persist:async()=>{},refresh:async()=>{},models:async()=>({connected:false,models:[]}),jsonFetch:async()=>{},score:()=>0,proposal:()=>''});
  try{assert.equal(runtime.status().nextCollect,nextCollectAt);}
  finally{runtime.stop();}
});

test('queued approved maintenance resumes after worker restart without duplicate execution',async()=>{
  const directory=await mkdtemp(path.join(os.tmpdir(),'forge-v3-queue-'));
  try{
    let store=openV3Store(path.join(directory,'queue.sqlite'));
    const id=randomUUID();store.enqueue({id,kind:'sync',commandId:'owner-sync-12345678'});store.close();
    store=openV3Store(path.join(directory,'queue.sqlite'));
    const state={automation:{enabled:false,autoBuild:false,dailySync:false,intervalMinutes:360},opportunities:[],projects:[],signals:[]};
    const runtime=createOrchestrator({state,root:directory,persist:async()=>{},refresh:async()=>{},models:async()=>({connected:false,models:[]}),jsonFetch:async()=>{},score:()=>0,proposal:()=>'',jobStore:store});
    try{
      await runtime.resumePending();
      assert.equal(store.health().pending,0);
      assert.equal(store.health().counts.complete,1);
      assert.equal(state.commandReceipts.filter(receipt=>receipt.id==='owner-sync-12345678').length,1);
      await runtime.resumePending();
      assert.equal(store.health().counts.complete,1);
    }finally{runtime.stop();store.close();}
  }finally{await rm(directory,{recursive:true,force:true});}
});

test('local agent refuses inference when system RAM is critically low',async()=>{
  const state={automation:{enabled:false,autoBuild:false,dailySync:false,intervalMinutes:360},opportunities:[],projects:[],signals:[]};
  let calls=0;
  const runtime=createOrchestrator({state,root:'unused',persist:async()=>{},refresh:async()=>{},models:async()=>({connected:true,models:['qwen3:4b'],resources:{freeRamGiB:0.5}}),jsonFetch:async()=>{calls++;throw new Error('Should not call model');},score:()=>0,proposal:()=>''});
  try{const result=await runtime.start('prompt','Check the status');assert.equal(result.machine.status,'blocked');assert.match(result.machine.error,/RAM is free/);assert.equal(calls,0);}
  finally{runtime.stop();}
});
