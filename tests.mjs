import test from 'node:test';
import assert from 'node:assert/strict';
import {score,cluster,proposal,defaults} from './server.mjs';
test('weighted ranking normalizes and follows career priority',()=>{assert.equal(score(Object.fromEntries(Object.keys(defaults).map(k=>[k,100]))),100);assert.equal(score({career:80,problem:20},{career:100,problem:0}),80);assert.equal(score({career:80,problem:20},{career:0,problem:100}),20);});
test('clustering keeps evidence and ignores unrelated signals',()=>{const result=cluster([{id:'a',title:'IAM security permissions',description:'',url:'https://example.com',source:'Test'},{id:'b',title:'Banana recipes',description:''}]);assert.equal(result.length,1);assert.equal(result[0].evidence[0].id,'a');assert.match(proposal(result[0]),/https:\/\/example.com/);assert.match(proposal(result[0]),/estimates/);});
