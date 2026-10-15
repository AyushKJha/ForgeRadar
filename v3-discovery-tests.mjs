import test from 'node:test';
import assert from 'node:assert/strict';
import {recommend,eligibility,rankResearch,relatedWork} from './v3-discovery.mjs';
const record=(title,url)=>({sourceTitle:title,canonicalUrl:`https://openalex.org/${url}`,provider:'OpenAlex',publishedAt:'2022-01-01',retrievedAt:'2026-10-15',verifiedSource:true,sourceType:'research paper'});
test('cybersecurity-only profile has no generic AI or software fallback',()=>{
  const profile={domains:['cybersecurity'],excludedDomains:[],goal:'learning'};
  const results=recommend([record('AI systems for web applications','W1'),record('Malware detection and access control','W2')],profile);
  assert.deepEqual(results.map(item=>item.canonicalUrl),['https://openalex.org/W2']);
  assert.equal(recommend([record('AI systems for web applications','W1')],profile).length,0);
});
test('exclusions are hard and interdisciplinary requires two chosen domains',()=>{
  const item=record('Firmware vulnerability detection for embedded systems','W3');
  assert.equal(eligibility(item,{domains:['cybersecurity','embedded_systems'],excludedDomains:['embedded_systems']}).eligible,false);
  assert.equal(eligibility(item,{domains:['cybersecurity','embedded_systems'],excludedDomains:[]},{mode:'interdisciplinary'}).eligible,true);
  assert.equal(eligibility(item,{domains:['cybersecurity'],excludedDomains:[]},{mode:'interdisciplinary'}).eligible,false);
});
test('publication date stays distinct from retrieval and ranking admits uncertainty',()=>{
  const profile={domains:['cybersecurity'],excludedDomains:[],goal:'research',weeklyHours:5,horizonWeeks:8};
  const [item]=recommend([record('Cybersecurity risk detection','W4')],profile);
  assert.equal(item.publishedAt,'2022-01-01');assert.equal(item.freshness,'publication not recent or unknown');
  assert.equal(item.ranking.weights.domain,30);assert.equal(item.ranking.factors.originality,20);
  assert.match(item.ranking.uncertainty.join(' '),/Originality not verified/);
});
test('mode selection changes weights and challenge mode has no invented opportunities',()=>{
  const profile={domains:['cybersecurity'],excludedDomains:[],goal:'research'};
  const research=recommend([record('Cybersecurity vulnerability detection','W9')],profile,{mode:'research'});
  assert.equal(research[0].ranking.weights.originality,25);
  assert.equal(recommend([record('Cybersecurity vulnerability detection','W9')],profile,{mode:'challenge'}).length,0);
});
test('related work only cites real cached records and labels limited coverage',()=>{
  const target=record('Embedded firmware vulnerability detection','W40');
  const research=[target,record('Embedded firmware vulnerability assessment','W41')];
  const signals=[{source:'GitHub',title:'Embedded firmware vulnerability scanner',url:'https://github.com/example/firmware-scanner'},{source:'Sample',title:'Embedded firmware vulnerability demo',url:''}];
  const result=relatedWork(target,research,signals);
  assert.equal(result.items.length,2);
  assert.ok(result.items.every(item=>item.url.startsWith('https://')));
  assert.match(result.coverage,/cannot establish worldwide originality/);
});
