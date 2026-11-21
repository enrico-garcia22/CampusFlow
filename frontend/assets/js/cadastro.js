(() => {
  'use strict';
  document.addEventListener('DOMContentLoaded',()=>{
    const form=document.getElementById('cadastroForm'),error=document.getElementById('cadastroError');
    const read=id=>document.getElementById(id).value.trim();
    form.addEventListener('submit',async e=>{
      e.preventDefault();error.textContent='';if(!form.reportValidity())return;
      const ra=read('ra');
      if(!/^[0-9]{9}$/.test(ra)){error.textContent='O RA deve conter exatamente 9 números.';return;}
      const senha=document.getElementById('senha').value;
      if(senha!==document.getElementById('confirmarSenha').value){error.textContent='As senhas não coincidem.';return;}
      const submit=form.querySelector('[type="submit"]');submit.disabled=true;
      try{
        await window.CF_API.cadastro({nome_completo:read('nome_completo'),nome_usuario:read('nome_usuario'),email:read('email'),telefone:read('telefone'),ra,senha});
        // Sem login automático: a API não envia token no cadastro.
        location.replace('../index.html?cadastro=ok');
      }catch(err){error.textContent=err.message;}finally{submit.disabled=false;}
    });
  });
})();
