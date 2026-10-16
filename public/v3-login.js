const card=document.querySelector('#authCard');
const notice=document.querySelector('#authNotice');
const intro=document.querySelector('#intro');
const reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)');
let introTimer;

function finishIntro(){clearTimeout(introTimer);document.body.classList.remove('intro-active');intro.setAttribute('aria-hidden','true');try{sessionStorage.setItem('forgeradar-intro-seen','1');}catch{}}
function playIntro(){if(reducedMotion.matches)return;clearTimeout(introTimer);intro.setAttribute('aria-hidden','false');document.body.classList.remove('intro-active');void document.body.offsetWidth;document.body.classList.add('intro-active');introTimer=setTimeout(finishIntro,2600);}
document.querySelector('#skipIntro').addEventListener('click',finishIntro);
document.querySelector('#replayIntro').addEventListener('click',playIntro);
try{if(!sessionStorage.getItem('forgeradar-intro-seen'))playIntro();}catch{playIntro();}
reducedMotion.addEventListener('change',()=>{if(reducedMotion.matches)finishIntro();});

function setMode(mode){
  if(card.dataset.mode===mode)return;
  const active=mode==='register'?document.querySelector('#registerFace'):document.querySelector('#loginFace');
  const inactive=mode==='register'?document.querySelector('#loginFace'):document.querySelector('#registerFace');
  inactive.inert=true;inactive.setAttribute('aria-hidden','true');
  active.inert=false;active.setAttribute('aria-hidden','false');
  card.dataset.mode=mode;notice.textContent='';
  const focus=()=>active.querySelector('input[name="email"]').focus({preventScroll:true});
  if(reducedMotion.matches)focus();else setTimeout(focus,440);
}
document.querySelector('#toRegister').addEventListener('click',()=>setMode('register'));
document.querySelector('#toLogin').addEventListener('click',()=>setMode('login'));
for(const button of document.querySelectorAll('.reveal'))button.addEventListener('click',()=>{const field=button.parentElement.querySelector('input');const visible=field.type==='text';field.type=visible?'password':'text';button.textContent=visible?'Show':'Hide';button.setAttribute('aria-label',visible?'Show password':'Hide password');button.setAttribute('aria-pressed',String(!visible));});

async function submitAccount(event,mode){
  event.preventDefault();
  const form=event.currentTarget,button=form.querySelector('[type="submit"]'),fields=new FormData(form);
  button.disabled=true;notice.textContent=mode==='register'?'Creating your private account…':'Signing in…';
  try{
    const response=await fetch('/api/account/'+mode,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:fields.get('email'),password:fields.get('password')})});
    const result=await response.json();
    if(!response.ok)throw new Error(result.error||'Account access failed');
    location.assign('/v3');
  }catch(error){notice.textContent=error.message;button.disabled=false;}
}
document.querySelector('#loginForm').addEventListener('submit',event=>submitAccount(event,'login'));
document.querySelector('#registerForm').addEventListener('submit',event=>submitAccount(event,'register'));
