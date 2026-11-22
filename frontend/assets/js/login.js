(() => {
  'use strict';
  document.addEventListener('DOMContentLoaded',()=>{
    if(new URLSearchParams(location.search).get('cadastro')==='ok'){document.getElementById('successSignup').hidden=false;}
    const redirect = sessionStorage.getItem('campusflow.post_login_redirect');
    if(window.CF_API.read()){
      if(redirect) sessionStorage.removeItem('campusflow.post_login_redirect');
      location.replace(redirect || 'pages/salas.html');
      return;
    }
    const form=document.getElementById('loginForm'), error=document.getElementById('loginError');
    const password=document.getElementById('password');
    const toggle=document.getElementById('togglePassword');
    toggle.addEventListener('click',()=>{const show=password.type==='password';password.type=show?'text':'password';toggle.textContent=show?'Ocultar':'Mostrar';toggle.setAttribute('aria-pressed',String(show));});
    form.addEventListener('submit',async e=>{
      e.preventDefault();error.textContent='';if(!form.reportValidity())return;
      const submit=form.querySelector('[type="submit"]');submit.disabled=true;
      try{
        await window.CF_API.login(document.getElementById('username').value.trim(),password.value);
        const destino = sessionStorage.getItem('campusflow.post_login_redirect') || 'pages/salas.html';
        sessionStorage.removeItem('campusflow.post_login_redirect');
        location.assign(destino);
      }catch(err){error.textContent=err.message;}
      finally{submit.disabled=false;}
    });
  });
})();
