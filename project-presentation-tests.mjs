import test from 'node:test';
import assert from 'node:assert/strict';
import {projectRepoName,projectPackageName,projectBannerSvg,fullstackReadme} from './project-presentation.mjs';

test('generated project identity is independent and readable',()=>{
  assert.equal(projectRepoName('ForgeRadar local AI evaluation workbench'),'Local-AI-Evaluation-Workbench');
  assert.equal(projectRepoName('Data pipeline health monitor'),'Data-Pipeline-Health-Monitor');
  assert.equal(projectPackageName('Amazon Wishlist Filter / Deal Query'),'amazon-wishlist-filter-deal-query');
  assert.equal(projectRepoName('Generated code review tracker'),'Review-Tracker');
});

test('project banner and README remain project-specific and explain local startup',()=>{
  const banner=projectBannerSvg('Signals & <Systems>');
  assert.match(banner,/Signals &amp; &lt;Systems&gt;/);
  assert.doesNotMatch(banner,/forgeradar/i);
  const readme=fullstackReadme({title:'Signal Monitor',problem:'Teams need a record of failed checks.',description:'Manage checks and incidents.',entities:[{label:'Check'},{label:'Incident'}]});
  assert.match(readme,/docs\/banner\.svg/);
  assert.match(readme,/node server\.mjs/);
  assert.match(readme,/only while this server is running/);
  assert.doesNotMatch(readme,/forgeradar/i);
});
