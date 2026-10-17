import test from 'node:test';
import assert from 'node:assert/strict';
import {projectAnalytics,projectAnalyticsHTML} from './public/project-analytics.js';

test('analytics counts actual project states and never invents a score',()=>{
 const state={projects:[{id:'a',title:'A',status:'Building',opportunityId:'idea'},{id:'b',title:'B',status:'Application ready',preview:'/apps/b/'},{id:'c',title:'C',status:'Build blocked'},{id:'d',title:'D',status:'Plan ready'}],opportunities:[{id:'idea',metrics:{career:80,problem:60}}],weights:{career:3,problem:1}};
 const result=projectAnalytics(state);
 assert.deepEqual(result.counts,{building:1,ready:1,planned:1,blocked:1});
 assert.equal(result.rows[0].merit,75);
 assert.equal(result.rows[1].merit,null);
 assert.equal(result.weights.reduce((sum,row)=>sum+row.percent,0),100);
 const html=projectAnalyticsHTML(result);
 assert.match(html,/Unscored/);
 assert.match(html,/data-bar-height="88"/);
 assert.match(html,/data-ready-percent="25"/);
 assert.doesNotMatch(html,/style=/);
});

test('analytics escapes user project titles in its dashboard HTML',()=>{
 const html=projectAnalyticsHTML(projectAnalytics({projects:[{title:'<img src=x onerror=alert(1)>',status:'Plan ready'}]}));
 assert.doesNotMatch(html,/<img src=x/);
 assert.match(html,/&lt;img/);
});
