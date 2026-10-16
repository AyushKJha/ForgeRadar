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
test('task estimates and due dates are bounded and editable',()=>{
  const input={title:'Measure noise',description:'Collect observations',acceptance:'Three valid records',estimateHours:4.5,dueDate:'2026-11-05'};
  assert.equal(validateTask(input).estimateHours,4.5);
  assert.equal(validateTask(input).dueDate,'2026-11-05');
  assert.throws(()=>validateTask({...input,estimateHours:1001}),/Estimate/);
  assert.throws(()=>validateTask({...input,dueDate:'2026-02-30'}),/due date/);
});
