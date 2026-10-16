const field=(value,max,name,{required=true}={})=>{const text=String(value||'').trim();if(text.length>max||required&&!text)throw new Error(`${name} must be ${required?'1 to ':''}${max} characters`);return text;};
export function validateProposal(input,{sourceUrls=[]}={}){
  if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('Invalid proposal');
  const sourceUrl=field(input.sourceUrl,600,'Source URL',{required:false});
  if(sourceUrl&&!sourceUrls.includes(sourceUrl))throw new Error('Choose a source already collected in the research lab');
  return {title:field(input.title,140,'Title'),problem:field(input.problem,1500,'Problem'),goal:field(input.goal,800,'Goal'),successMetric:field(input.successMetric,500,'Success metric'),scope:field(input.scope,1200,'MVP scope'),sourceUrl};
}
export function validateTask(input){
  if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('Invalid task');
  const status=input.status||'todo',priority=input.priority||'medium';
  if(!['todo','in_progress','review','blocked','done'].includes(status)||!['low','medium','high'].includes(priority))throw new Error('Invalid task status or priority');
  const evidence=field(input.evidence,1200,'Evidence',{required:false}),acceptance=field(input.acceptance,800,'Acceptance criteria');
  if(status==='done'&&!evidence)throw new Error('A completed task needs test evidence or a human sign-off note');
  const estimateHours=input.estimateHours===null||input.estimateHours===undefined||input.estimateHours===''?null:Number(input.estimateHours);
  if(estimateHours!==null&&(!Number.isFinite(estimateHours)||estimateHours<0||estimateHours>1000))throw new Error('Estimate must be 0 to 1000 hours');
  const dueDate=input.dueDate||null;
  if(dueDate!==null&&(typeof dueDate!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)||!Number.isFinite(Date.parse(dueDate))||new Date(dueDate).toISOString().slice(0,10)!==dueDate))throw new Error('Use a valid due date');
  return {title:field(input.title,140,'Task title'),description:field(input.description,1500,'Description'),acceptance,evidence,status,priority,estimateHours,dueDate};
}
