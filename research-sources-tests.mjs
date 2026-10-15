import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeOpenAlex,normalizeCrossref,collectResearch} from './research-sources.mjs';

test('research records keep publication and retrieval dates separate',()=>{
  const retrievedAt='2026-10-15T12:00:00.000Z';
  const paper=normalizeOpenAlex({id:'https://openalex.org/W123',display_name:'Embedded Systems Paper',publication_date:'2018-03-15',authorships:[{author:{display_name:'Ada'}}]},retrievedAt);
  assert.equal(paper.publishedAt,'2018-03-15T00:00:00.000Z');
  assert.equal(paper.retrievedAt,retrievedAt);
  assert.equal(paper.verifiedSource,true);
  assert.equal(paper.proposal,false);
  const crossref=normalizeCrossref({DOI:'10.1234/Old.Paper',title:['Old study'],published:{'date-parts':[[2019,2]]}},retrievedAt);
  assert.equal(crossref.publishedAt,'2019-02-01T00:00:00.000Z');
  assert.equal(crossref.canonicalUrl,'https://doi.org/10.1234/old.paper');
});

test('research connectors require opt-in, cache results and label offline stale evidence',async()=>{
  let calls=0,stale=false;
  const entries=new Map();
  const cache={putCache(key,provider,payload){entries.set(key,{provider,payload,fetchedAt:'2026-10-15T12:00:00.000Z',expiresAt:'2026-10-16T12:00:00.000Z'});},getCache(key,{allowStale=false}={}){const entry=entries.get(key);return entry&&(allowStale||!stale)?entry:null;}};
  const fetchImpl=async url=>{calls++;assert.equal(url.host,'api.openalex.org');return {ok:true,headers:{get:()=>null},json:async()=>({results:[{id:'https://openalex.org/W123',display_name:'Security operations',publication_date:'2024-01-02'}]})};};
  assert.equal((await collectResearch({query:'security operations',enabled:[],cache,fetchImpl})).results.length,0);
  assert.equal(calls,0);
  const first=await collectResearch({query:'security operations',enabled:['openalex'],cache,fetchImpl});
  assert.equal(first.results.length,1);
  assert.equal(calls,1);
  await collectResearch({query:'security operations',enabled:['openalex'],cache,fetchImpl});
  assert.equal(calls,1);
  stale=true;
  const offline=await collectResearch({query:'security operations',enabled:['openalex'],cache,fetchImpl:async()=>{throw new Error('offline');}});
  assert.equal(offline.results[0].cachedOffline,true);
  assert.equal(offline.health[0].status,'stale');
  await assert.rejects(collectResearch({query:'http://localhost/secrets',enabled:['openalex'],cache,fetchImpl}));
});
