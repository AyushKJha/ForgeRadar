import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeSuggestedTasks} from './v3-task-planner.mjs';
test('local task proposals are bounded, explained and deduplicated before review',()=>{
  const raw=[{title:'Write parser',description:'Parse fixture',acceptance:'Fixture passes',reason:'Needed for the MVP'},{title:'Write parser!',description:'Duplicate',acceptance:'Fixture passes',reason:'Duplicate'},{title:'Test parser',description:'Run fixtures',acceptance:'Three cases pass',reason:'Validation is required'}];
  assert.deepEqual(normalizeSuggestedTasks(raw,[{title:'Write parser'}]).map(item=>item.title),['Test parser']);
  assert.match(normalizeSuggestedTasks([{title:'Task',description:'Do it',acceptance:'Done'}])[0].reason,/supplied no reason/);
});
