(() => {
  'use strict';
  document.addEventListener('DOMContentLoaded',()=>{
    if(new URLSearchParams(location.search).get('cadastro')==='ok'){document.getElementById('successSignup').hidden=false;}
    if(window.CF_API.read()){location.replace('pages/salas.html');return;}
    const form=document.getElementById('loginForm'), error=document.getElementById('loginError');
    const password=document.getElementById('password');
    const toggle=document.getElementById('togglePassword');
    toggle.addEventListener('click',()=>{const show=password.type==='password';password.type=show?'text':'password';toggle.textContent=show?'Ocultar':'Mostrar';toggle.setAttribute('aria-pressed',String(show));});
    form.addEventListener('submit',async e=>{
      e.preventDefault();error.textContent='';if(!form.reportValidity())return;
      const submit=form.querySelector('[type="submit"]');submit.disabled=true;
      try{
        await window.CF_API.login(document.getElementById('username').value.trim(),password.value);
        location.assign('pages/salas.html');
      }catch(err){error.textContent=err.message;}
      finally{submit.disabled=false;}
    });
  });
})();
