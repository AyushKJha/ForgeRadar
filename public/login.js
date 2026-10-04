const form=document.querySelector('form');
form.addEventListener('submit',async event=>{
event.preventDefault();const notice=document.querySelector('#loginNotice'),button=form.querySelector('button');
button.disabled=true;notice.textContent='Opening your workshop…';
try{const response=await fetch('/login',{method:'POST',headers:{Accept:'application/json','Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams(new FormData(form)).toString()});const result=await response.json();if(!response.ok)throw new Error(result.error||'Sign-in failed');window.location.assign('/');}
catch(error){notice.textContent=error.message==='Failed to fetch'?'The browser blocked or interrupted the sign-in request. Check this browser’s site access and try again.':error.message;button.disabled=false;}
});
