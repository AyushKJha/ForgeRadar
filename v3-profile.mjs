export const domains=[
  ['ai_ml','AI / machine learning'],['deep_learning','Deep learning'],['cybersecurity','Cybersecurity'],['soc_siem','SOC / SIEM'],
  ['cloud','Cloud'],['devops','DevOps'],['embedded_systems','Embedded systems'],['iot','IoT'],['signal_processing','Signal processing'],
  ['communications','Communication systems'],['robotics','Robotics'],['vlsi','VLSI'],['computer_vision','Computer vision'],
  ['data_science','Data science'],['software','Web / software'],['hardware_software','Hardware–software systems']
];
const domainSet=new Set(domains.map(([id])=>id));
const choices=(value,allowed,max,label)=>{if(!Array.isArray(value)||value.length>max||value.some(item=>typeof item!=='string'||!allowed.has(item)))throw new Error(`Invalid ${label}`);return [...new Set(value)];};
const strings=(value,maxItems,maxLength,label)=>{if(!Array.isArray(value)||value.length>maxItems||value.some(item=>typeof item!=='string'||item.trim().length>maxLength))throw new Error(`Invalid ${label}`);return [...new Set(value.map(item=>item.trim()).filter(Boolean))];};
export function validateProfile(input){
  if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('Invalid profile');
  const selected=choices(input.domains||[],domainSet,domains.length,'domains');
  const excluded=choices(input.excludedDomains||[],domainSet,domains.length,'excluded domains');
  if(selected.some(domain=>excluded.includes(domain)))throw new Error('A selected domain cannot also be excluded');
  const goals=new Set(['internship','research','startup','learning','gsoc','portfolio','other']);
  const levels=new Set(['beginner','intermediate','advanced','prefer_not_to_say']);
  const complexities=new Set(['small','medium','large','flexible']);
  const goal=input.goal||'learning',experience=input.experience||'prefer_not_to_say',complexity=input.complexity||'flexible';
  if(!goals.has(goal)||!levels.has(experience)||!complexities.has(complexity))throw new Error('Invalid profile preference');
  const weeklyHours=Number(input.weeklyHours||0),horizonWeeks=Number(input.horizonWeeks||0),budget=Number(input.budget||0);
  if(!Number.isFinite(weeklyHours)||weeklyHours<0||weeklyHours>80||!Number.isFinite(horizonWeeks)||horizonWeeks<0||horizonWeeks>104||!Number.isFinite(budget)||budget<0||budget>100000)throw new Error('Invalid time or budget preference');
  const portfolioRepos=input.portfolioRepos||[];
  if(!Array.isArray(portfolioRepos)||portfolioRepos.length>30||portfolioRepos.some(repo=>!repo||!Number.isSafeInteger(repo.id)||typeof repo.name!=='string'||repo.name.length>120||typeof repo.url!=='string'||!/^https:\/\/github\.com\/[A-Za-z0-9-]{1,39}\/[A-Za-z0-9._-]{1,120}$/.test(repo.url)))throw new Error('Invalid selected portfolio projects');
  return {domains:selected,excludedDomains:excluded,customDomains:strings(input.customDomains||[],10,60,'custom domains'),languages:strings(input.languages||[],15,40,'languages'),frameworks:strings(input.frameworks||[],15,60,'frameworks'),hardware:strings(input.hardware||[],15,80,'hardware'),goal,experience,complexity,weeklyHours,horizonWeeks,budget,skills:strings(input.skills||[],30,80,'claimed skills'),education:strings(input.education||[],10,180,'education'),projectClaims:strings(input.projectClaims||[],15,180,'project claims'),experienceNotes:strings(input.experienceNotes||[],10,180,'experience notes'),researchInterests:strings(input.researchInterests||[],10,180,'research interests'),goalNotes:strings(input.goalNotes||[],10,180,'goal notes'),portfolioRepos:portfolioRepos.map(repo=>({id:repo.id,name:repo.name,url:repo.url,description:String(repo.description||'').slice(0,300),language:String(repo.language||'').slice(0,50),ownershipVerified:false})),onboardingComplete:Boolean(input.onboardingComplete)};
}
