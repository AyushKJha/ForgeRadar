import test from 'node:test';
import assert from 'node:assert/strict';
import {validateProposal,validateTask} from './v3-projects.mjs';
test('proposal cannot silently cite an uncollected source or omit success criteria',()=>{
  const input={title:'Firmware risk explorer',problem:'Review firmware risks',goal:'Show clear findings',successMetric:'Detect three fixture risks',scope:'Import a fixture and report',sourceUrl:'https://openalex.org/W1'};
  assert.throws(()=>validateProposal(input),/source already collected/);
  assert.equal(validateProposal(input,{sourceUrls:[input.sourceUrl]}).title,'Firmware risk explorer');
  assert.throws(()=>validateProposal({...input,successMetric:''},{sourceUrls:[input.sourceUrl]}),/Success metric/);
});
test('manual task cannot be completed without evidence or sign-off',()=>{
  const input={title:'Write parser',description:'Parse a fixture',acceptance:'Fixture passes',status:'done'};
  assert.throws(()=>validateTask(input),/test evidence/);
  assert.equal(validateTask({...input,evidence:'Human review signed off'}).status,'done');
});
