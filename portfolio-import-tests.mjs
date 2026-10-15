import test from 'node:test';
import assert from 'node:assert/strict';
import {githubUsername,previewGithubPortfolio} from './portfolio-import.mjs';

test('portfolio import accepts only a GitHub profile and public repositories',async()=>{
  for(const input of ['http://github.com/alice','https://github.com@127.0.0.1/alice','https://github.com/alice/repo','https://github.com/alice?redirect=1','https://127.0.0.1/alice'])assert.throws(()=>githubUsername(input));
  assert.equal(githubUsername('https://github.com/Alice/'),'Alice');
  let calls=0;const cache=new Map();
  const store={getCache:key=>cache.get(key)||null,putCache:(key,provider,payload)=>cache.set(key,{payload,fetchedAt:new Date().toISOString()})};
  const fetchImpl=async url=>{calls++;assert.equal(url.host,'api.github.com');return {ok:true,headers:{get:()=>null},json:async()=>[{id:1,name:'my-project',private:false,owner:{login:'Alice'},description:'Real work',language:'Python',updated_at:'2026-10-10T00:00:00Z'},{id:2,name:'private-work',private:true,owner:{login:'Alice'}},{id:3,name:'someone-else',private:false,owner:{login:'Bob'}}]};};
  const preview=await previewGithubPortfolio('https://github.com/Alice',{cache:store,fetchImpl});
  assert.equal(preview.repositories.length,1);
  assert.equal(preview.repositories[0].name,'my-project');
  assert.equal(preview.ownershipVerified,false);
  await previewGithubPortfolio('https://github.com/Alice',{cache:store,fetchImpl});
  assert.equal(calls,1);
});
