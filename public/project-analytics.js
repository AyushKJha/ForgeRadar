const dimensions=[['career','Career'],['problem','Problem'],['adoption','Adoption'],['trend','Trend'],['learning','Learning'],['feasibility','Feasibility'],['gap','Competition gap'],['novelty','Novelty']];
const safe=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
export function projectAnalytics(state={}){
 const projects=Array.isArray(state.projects)?state.projects:[];
 const opportunities=new Map((state.opportunities||[]).map(item=>[item.id,item]));
 const weights=state.weights||{};
 const activeWeights=dimensions.filter(([key])=>Number.isFinite(Number(weights[key]))&&Number(weights[key])>0);
 const weightTotal=activeWeights.reduce((sum,[key])=>sum+Number(weights[key]),0);
 const rows=projects.map(project=>{
  const status=String(project.status||'').toLowerCase();
  const stage=/block|fail|error/.test(status)?'blocked':/build|progress|test|review/.test(status)?'building':project.preview?'ready':'planned';
  const opportunity=opportunities.get(project.opportunityId);
  const valid=weightTotal>0&&activeWeights.every(([key])=>Number.isFinite(Number(opportunity?.metrics?.[key]))&&Number(opportunity.metrics[key])>=0&&Number(opportunity.metrics[key])<=100);
  const merit=valid?Math.round(activeWeights.reduce((sum,[key])=>sum+Number(weights[key])*Number(opportunity.metrics[key]),0)/weightTotal):null;
  return {id:project.id,title:project.title||'Untitled project',status:project.status||'Unspecified',stage,merit};
 });
 const counts={building:0,ready:0,planned:0,blocked:0};for(const row of rows)counts[row.stage]++;
 return {rows,counts,total:rows.length,weights:activeWeights.map(([key,label])=>({label,percent:weightTotal?Math.round(Number(weights[key])/weightTotal*100):0}))};
}
export function projectAnalyticsHTML(data){
 const {rows,counts,total,weights}=data;
 const segments=[['building','Building'],['ready','Ready to inspect'],['planned','Planning'],['blocked','Blocked']];
 return `<div class="analytics-head"><div><span class="micro">PROJECT INTELLIGENCE / LIVE RECORDS</span><h2>Build pulse</h2><p>Actual workspace states and your opportunity ranking weights. A score is an estimate, not build progress.</p></div><span class="analytics-live"><i></i> ${total} WORKSPACES</span></div><div class="analytics-grid"><article class="analytics-tile analytics-overview"><span class="micro">WORK IN MOTION</span><div class="analytics-main-number">${counts.building}<small>building now</small></div><div class="analytics-track" role="img" aria-label="${counts.building} building, ${counts.ready} ready, ${counts.planned} planning, ${counts.blocked} blocked">${segments.map(([key])=>`<span class="track-${key}" style="--share:${total?counts[key]/total*100:0}%"></span>`).join('')}</div><div class="analytics-legend">${segments.map(([key,label])=>`<span><i class="legend-${key}"></i>${label} <b>${counts[key]}</b></span>`).join('')}</div></article><article class="analytics-tile analytics-weight"><span class="micro">YOUR RANKING WEIGHTAGE</span><h3>What matters in a proposal</h3>${weights.length?`<div class="weight-bars">${weights.map(item=>`<div class="weight-row"><span>${safe(item.label)}</span><div class="weight-rail"><i style="--weight:${item.percent}%"></i></div><strong>${item.percent}%</strong></div>`).join('')}</div>`:'<p class="muted">Set positive ranking weights in Settings to compare ideas.</p>'}<p class="analytics-note">Normalized from your saved ranking profile.</p></article><article class="analytics-tile analytics-projects"><span class="micro">PROJECT PORTFOLIO</span><h3>Where each build stands</h3>${rows.length?`<div class="analytics-project-list">${rows.slice(-6).reverse().map(row=>`<div class="analytics-project-row"><span class="project-status-dot status-${row.stage}"></span><div><strong>${safe(row.title)}</strong><small>${safe(row.status)}</small></div><span class="project-merit" title="Opportunity merit estimate, not completion">${row.merit===null?'Unscored':`${row.merit}/100`}</span></div>`).join('')}</div>`:'<p class="muted">No projects yet. Approve a proposal to start one.</p>'}<p class="analytics-note">${rows.length>6?`Showing 6 of ${rows.length} projects. Open My projects for all.`:'Scores appear only when source metrics are available.'}</p></article></div>`;
}
