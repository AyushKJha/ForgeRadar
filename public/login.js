const card=document.querySelector('#authCard');
const notice=document.querySelector('#loginNotice');
const reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)');

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
  button.disabled=true;notice.textContent=mode==='register'?'Creating your account on the host laptop…':'Signing in…';
  const body={email:fields.get('email'),password:fields.get('password')};
  if(mode==='register')body.inviteKey=fields.get('inviteKey');
  try{
    const response=await fetch('/api/account/'+mode,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    const result=await response.json();
    if(!response.ok)throw new Error(result.error||'Account access failed');
    location.assign('/');
  }catch(error){notice.textContent=error.message==='Failed to fetch'?'The sign-in service could not be reached. Check your connection and try again.':error.message;button.disabled=false;}
}
document.querySelector('#loginForm').addEventListener('submit',event=>submitAccount(event,'login'));
document.querySelector('#registerForm').addEventListener('submit',event=>submitAccount(event,'register'));
