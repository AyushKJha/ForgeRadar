import {validateTask} from './v3-projects.mjs';
const normalized=value=>String(value||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
export function normalizeSuggestedTasks(raw,existing=[]){
  if(!Array.isArray(raw)||raw.length>8)throw new Error('Local model returned an invalid task list');
  const seen=new Set(existing.map(item=>normalized(item.title))),suggestions=[];
  for(const item of raw){
    if(!item||typeof item!=='object'||item.reason!==undefined&&(typeof item.reason!=='string'||item.reason.length>400))throw new Error('Local model returned an invalid task explanation');
    const task=validateTask({...item,status:'todo',evidence:''}),key=normalized(task.title);
    if(!key||seen.has(key))continue;seen.add(key);
    suggestions.push({...task,reason:item.reason?.trim()||'Model supplied no reason; compare this task with the approved goal before accepting it.',origin:'local model suggestion; review before adding'});
    if(suggestions.length>=5)break;
  }
  return suggestions;
}
