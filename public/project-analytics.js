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
 const segments=[['building','Building'],['ready','Ready'],['planned','Planning'],['blocked','Blocked']];
 const max=Math.max(1,...segments.map(([key])=>counts[key]));
 const readyPercent=total?Math.round(counts.ready/total*100):0;
 return `<div class="analytics-head"><div><span class="micro">PROJECT INTELLIGENCE / LIVE RECORDS</span><h2>Build pulse</h2><p>Follow real project states and the ranking priorities you chose. Merit scores estimate an idea's fit, not build completion.</p></div><span class="analytics-live"><i></i> ${total} WORKSPACES</span></div>
 <div class="analytics-grid">
  <article class="analytics-tile analytics-overview"><div class="tile-heading"><span class="micro">PORTFOLIO STATUS</span><span aria-hidden="true">↗</span></div><div class="analytics-overview-core"><div><strong class="analytics-big-count"><span data-count="${counts.building}">${counts.building}</span></strong><span class="analytics-count-label">building now</span></div><div class="analytics-gauge" data-ready-percent="${readyPercent}" role="img" aria-label="${counts.ready} of ${total} projects ready to inspect"><div class="analytics-gauge-inner"><strong>${readyPercent}%</strong><small>ready</small></div></div></div><p class="analytics-note">${counts.ready} ready to inspect · ${counts.blocked} blocked</p></article>
  <article class="analytics-tile analytics-stages"><div class="tile-heading"><span class="micro">BUILD DISTRIBUTION</span><span aria-hidden="true">⌁</span></div><h3>Where work is happening</h3><div class="stage-chart" role="img" aria-label="${segments.map(([key,label])=>`${counts[key]} ${label.toLowerCase()}`).join(', ')}">${segments.map(([key,label])=>`<div class="stage-column"><span class="stage-value">${counts[key]}</span><div class="stage-well"><i class="stage-bar stage-${key}" data-bar-height="${Math.round(counts[key]/max*88)}"></i></div><span class="stage-label">${label}</span></div>`).join('')}</div><p class="analytics-note">Measured from saved workspaces, not an invented timeline.</p></article>
  <article class="analytics-tile analytics-weight"><div class="tile-heading"><span class="micro">RANKING WEIGHTAGE</span><span aria-hidden="true">◈</span></div><h3>What matters in a proposal</h3>${weights.length?`<div class="weight-bars">${weights.map(item=>`<div class="weight-row"><span>${safe(item.label)}</span><div class="weight-rail"><i data-weight="${item.percent}"></i></div><strong>${item.percent}%</strong></div>`).join('')}</div>`:'<p class="muted">Set positive ranking weights in Settings to compare ideas.</p>'}<p class="analytics-note">From your saved ranking profile.</p></article>
  <article class="analytics-tile analytics-projects"><div class="tile-heading"><span class="micro">PROJECT PORTFOLIO</span><span aria-hidden="true">▤</span></div><h3>Every project has a place</h3>${rows.length?`<div class="analytics-project-list">${rows.slice(-6).reverse().map(row=>`<div class="analytics-project-row"><span class="project-status-dot status-${row.stage}"></span><div><strong>${safe(row.title)}</strong><small>${safe(row.status)}</small></div><span class="project-merit" title="Opportunity merit estimate, not completion">${row.merit===null?'Unscored':`${row.merit}/100`}</span></div>`).join('')}</div>`:'<p class="muted">No projects yet. Approve a proposal to start one.</p>'}<p class="analytics-note">${rows.length>6?`Showing 6 of ${rows.length}. Open My projects for all.`:'Unscored means source metrics are unavailable.'}</p></article>
 </div>`;
}
export function animateProjectAnalytics(root){
 if(!root)return;
 for(const node of root.querySelectorAll('[data-bar-height]'))node.style.height=`${Number(node.dataset.barHeight)}px`;
 for(const node of root.querySelectorAll('[data-weight]'))node.style.width=`${Number(node.dataset.weight)}%`;
 for(const node of root.querySelectorAll('[data-ready-percent]')){const value=Number(node.dataset.readyPercent);node.style.background=`conic-gradient(var(--neo-violet) 0 ${value}%, #0e1522 ${value}% 100%)`;}
 const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
 const reveal=()=>{
  root.classList.add('analytics-visible');
  if(reduced)return;
  for(const node of root.querySelectorAll('[data-count]')){
   const target=Number(node.dataset.count);
   if(!Number.isFinite(target)||target<=0)continue;
   const started=performance.now();
   const frame=now=>{const fraction=Math.min(1,(now-started)/800);node.textContent=String(Math.round(target*(1-(1-fraction)**3)));if(fraction<1)requestAnimationFrame(frame);};
   node.textContent='0';requestAnimationFrame(frame);
  }
 };
 if(reduced||!('IntersectionObserver' in window)){reveal();return;}
 const observer=new IntersectionObserver(entries=>{if(entries.some(entry=>entry.isIntersecting)){observer.disconnect();reveal();}},{threshold:.12});
 observer.observe(root);
}
