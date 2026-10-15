// Explicit taxonomy: generic words such as "AI", "system" or "data" never imply a specialist domain.
const patterns={
  ai_ml:/\b(machine learning|neural network|predictive model|classification model)\b/i,
  deep_learning:/\b(deep learning|transformer model|convolutional neural|diffusion model)\b/i,
  cybersecurity:/\b(cybersecurity|cyber security|vulnerabilit\w*|malware|phishing|penetration test|threat detection|access control|zero trust|cryptograph\w*|intrusion detection)\b/i,
  soc_siem:/\b(siem|security operations cent(?:er|re)|security incident|threat hunting|log correlation)\b/i,
  cloud:/\b(cloud infrastructure|cloud computing|aws|azure|kubernetes|cloud native)\b/i,
  devops:/\b(devops|ci\/cd|continuous integration|infrastructure as code|terraform|deployment pipeline)\b/i,
  embedded_systems:/\b(embedded system|microcontroller|firmware|arduino|esp32|real.time operating system)\b/i,
  iot:/\b(internet of things|\biot\b|connected sensor|smart device)\b/i,
  signal_processing:/\b(signal processing|digital signal|spectral analysis|waveform|noise cancellation)\b/i,
  communications:/\b(telecommunication|wireless communication|radio frequency|\b5g\b|modulation|antenna)\b/i,
  robotics:/\b(robotic\w*|autonomous navigation|robot arm|slam algorithm)\b/i,
  vlsi:/\b(vlsi|integrated circuit|chip design|semiconductor|fpga|asic)\b/i,
  computer_vision:/\b(computer vision|image segmentation|object detection|visual recognition)\b/i,
  data_science:/\b(data science|statistical analysis|data mining|data analytics)\b/i,
  software:/\b(software engineering|web application|developer tool|programming language|web framework|api design)\b/i,
  hardware_software:/\b(hardware.software|hardware software|cyber physical|edge device)\b/i
};
const modes=new Set(['focused','interdisciplinary','research','career','startup','challenge']);
const weights={domain:30,usefulness:25,career:20,feasibility:15,originality:10};
const modeWeights={focused:weights,interdisciplinary:weights,research:{domain:25,usefulness:20,career:15,feasibility:15,originality:25},career:{domain:25,usefulness:20,career:35,feasibility:15,originality:5},startup:{domain:25,usefulness:35,career:10,feasibility:20,originality:10},challenge:{domain:25,usefulness:25,career:15,feasibility:20,originality:15}};
const text=record=>`${record.sourceTitle||record.title||''} ${record.excerpt||record.description||''}`.slice(0,1800);
export function matchedDomains(record){const content=text(record);return Object.entries(patterns).filter(([,pattern])=>pattern.test(content)).map(([domain])=>domain);}
export function eligibility(record,profile,{mode='focused',adjacent=false}={}){
  if(!modes.has(mode))throw new Error('Unknown discovery mode');
  const matched=matchedDomains(record),chosen=profile?.domains||[],excluded=profile?.excludedDomains||[];
  if(matched.some(domain=>excluded.includes(domain)))return {eligible:false,matched,reason:'Matches an excluded domain'};
  const selected=matched.filter(domain=>chosen.includes(domain));
  if(!chosen.length)return {eligible:false,matched,reason:'Select at least one domain'};
  if(!selected.length)return adjacent&&matched.length?{eligible:true,matched,selected,adjacent:true,reason:'Adjacent exploration was explicitly enabled'}:{eligible:false,matched,reason:'No selected domain matches'};
  if(mode==='interdisciplinary'&&selected.length<2)return {eligible:false,matched,reason:'Interdisciplinary mode needs two selected domains in the same source'};
  return {eligible:true,matched,selected,adjacent:false,reason:`Matches ${selected.join(', ')}`};
}
const clamp=n=>Math.max(0,Math.min(100,Math.round(n)));
export function rankResearch(record,profile,match,{mode='focused'}={}){
  const evidence=text(record),hours=Number(profile.weeklyHours)||0,horizon=Number(profile.horizonWeeks)||0;
  const domain=clamp(match.adjacent?20:match.selected.length>=2?100:80);
  // Heuristics express fit, not probability or objectively measured merit.
  const usefulness=clamp(/\b(problem|challenge|need|risk|failure|reduce|improve|detect|prevent)\b/i.test(evidence)?65:40);
  const career=clamp(profile.goal==='research'&&record.sourceType==='research paper'?85:profile.goal==='learning'?65:55);
  const feasibility=clamp(hours&&horizon&&hours*horizon<40?35:hours&&hours*horizon>=100?70:50);
  const originality=20; // Similar-work scan has not verified novelty.
  const factors={domain,usefulness,career,feasibility,originality};
  const activeWeights=modeWeights[mode];
  const score=Math.round(Object.entries(activeWeights).reduce((sum,[key,weight])=>sum+factors[key]*weight,0)/100);
  return {score,factors,weights:activeWeights,method:'Heuristic fit; estimates are unverified',uncertainty:['Usefulness inferred from source wording','Originality not verified against comparable work','Time and cost require an MVP plan'],mode};
}
export function recommend(records,profile,options={}){
  const mode=options.mode||'focused';if(!modes.has(mode))throw new Error('Unknown discovery mode');
  const seen=new Set(),items=[];
  for(const record of records||[]){
    if(!record?.canonicalUrl||seen.has(record.canonicalUrl))continue;
    if(mode==='research'&&!/research|paper|journal|preprint/i.test(record.sourceType||''))continue;
    if(mode==='challenge'&&!/challenge|competition|hackathon/i.test(record.sourceType||''))continue;
    seen.add(record.canonicalUrl);
    const match=eligibility(record,profile,{mode,adjacent:options.adjacent===true});if(!match.eligible)continue;
    const ranking=rankResearch(record,profile,match,{mode});
    items.push({...record,matchedDomains:match.matched,selectedDomains:match.selected,adjacent:match.adjacent,whyThisMatches:match.reason,ranking,freshness:record.publishedAt&&Date.now()-Date.parse(record.publishedAt)<90*86400000?'recent publication':'publication not recent or unknown',status:record.cachedOffline?'cached/offline':'verified source',proposalStatus:'No project proposal generated'});
  }
  return items.sort((a,b)=>b.ranking.score-a.ranking.score||String(b.publishedAt||'').localeCompare(String(a.publishedAt||'')));
}
const stop=new Set(['about','after','against','application','approach','based','between','building','could','detection','different','engineering','framework','from','into','model','models','paper','project','research','software','study','system','systems','that','their','there','these','this','through','using','with']);
const terms=value=>new Set(String(value||'').toLowerCase().match(/[a-z][a-z0-9-]{3,}/g)?.filter(word=>!stop.has(word))||[]);
export function relatedWork(target,records=[],signals=[]){
  const titleTerms=terms(target?.sourceTitle||target?.title),results=[];
  if(titleTerms.size<2)return {items:[],coverage:'Insufficient title terms for a local comparison'};
  const candidates=[...records.map(record=>({title:record.sourceTitle,url:record.canonicalUrl,kind:record.sourceType||'research source',publishedAt:record.publishedAt||null})),...signals.filter(signal=>signal.source==='GitHub'&&/^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/?$/.test(signal.url||'')).map(signal=>({title:signal.title,url:signal.url,kind:'GitHub repository',publishedAt:signal.publishedAt||null}))];
  const seen=new Set([target.canonicalUrl]);
  for(const item of candidates){if(!item.title||!item.url||seen.has(item.url))continue;seen.add(item.url);const other=terms(item.title),overlap=[...titleTerms].filter(word=>other.has(word));if(overlap.length<2)continue;results.push({...item,sharedTerms:overlap,similarity:Math.round(100*overlap.length/new Set([...titleTerms,...other]).size)});}
  results.sort((a,b)=>b.similarity-a.similarity);
  return {items:results.slice(0,8),coverage:'Local cached research and collected GitHub repository titles only. This cannot establish worldwide originality or an open research gap.'};
}
