const themes=['eclipse','cosmic','aurora','nebula','sunset'];
const select=document.querySelector('#themeSelect');
function applyTheme(value){const theme=themes.includes(value)?value:'eclipse';document.documentElement.dataset.theme=theme;if(select)select.value=theme;}
let saved;try{saved=localStorage.getItem('forgeradar-theme');}catch{}
applyTheme(saved);
select?.addEventListener('change',()=>{applyTheme(select.value);try{localStorage.setItem('forgeradar-theme',select.value);}catch{}});
document.querySelector('#heroPrompt')?.addEventListener('click',()=>{const input=document.querySelector('#promptInput');input?.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'center'});input?.focus({preventScroll:true});});
document.querySelector('#heroExplore')?.addEventListener('click',()=>{document.querySelector('[data-view="opportunities"]')?.click();document.querySelector('#surface')?.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});});
