import test from 'node:test';
import assert from 'node:assert/strict';
import {validateProfile} from './v3-profile.mjs';

test('manual onboarding accepts one focused domain and no resume',()=>{
  const profile=validateProfile({domains:['cybersecurity'],goal:'portfolio',weeklyHours:8,onboardingComplete:true});
  assert.deepEqual(profile.domains,['cybersecurity']);
  assert.deepEqual(profile.skills,[]);
  assert.equal(profile.goal,'portfolio');
});

test('CV-derived claims stay editable and do not become verified skills',()=>{
  const profile=validateProfile({domains:['embedded_systems'],education:['B.Tech in ECE'],projectClaims:['Built a sensor prototype'],frameworks:['PyTorch'],researchInterests:['Signal processing']});
  assert.deepEqual(profile.education,['B.Tech in ECE']);
  assert.deepEqual(profile.projectClaims,['Built a sensor prototype']);
  assert.deepEqual(profile.skills,[]);
});

test('profile rejects overlapping exclusions and unsupported fields',()=>{
  assert.throws(()=>validateProfile({domains:['cybersecurity'],excludedDomains:['cybersecurity']}));
  assert.throws(()=>validateProfile({domains:['made_up']}));
  assert.throws(()=>validateProfile({weeklyHours:200}));
});
