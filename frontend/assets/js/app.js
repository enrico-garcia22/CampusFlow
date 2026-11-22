/* CampusFlow — navegação do catálogo e reservas reais. */
(() => {
  'use strict';
  const safeText=(value='')=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const initials=(name='')=>String(name).trim().split(/\s+/).slice(0,2).map(w=>w[0]?.toUpperCase()||'').join('')||'CF';
  const toast=(message,type='success')=>{
    let host=document.getElementById('toastArea');
    if(!host){host=document.createElement('div');host.id='toastArea';host.setAttribute('role','status');host.setAttribute('aria-live','polite');document.body.append(host);}
    const el=document.createElement('div');el.className='toast'+(type==='error'?' is-error':'');el.textContent=message;host.append(el);setTimeout(()=>el.remove(),5000);
  };
  function setupShell(user){
    if(!document.getElementById('sidebarMount'))return;
    const page=document.body.dataset.page||'salas';
    const titles={salas:'Salas disponíveis','reservar-sala':'Reservar sala','minhas-reservas':'Minhas reservas'};
    const nome=user.nome_completo||user.nome_usuario||'Estudante';
    const nav=[['salas.html','salas','▤','Salas disponíveis'],['reservar-sala.html','reservar-sala','▦','Reservar sala'],['minhas-reservas.html','minhas-reservas','◷','Minhas reservas']]
      .map(([href,id,icon,label])=>`<a class="nav-link" href="${href}" ${page===id?'aria-current="page"':''}><span class="nav-symbol" aria-hidden="true">${icon}</span><span>${label}</span></a>`).join('');
    document.getElementById('sidebarMount').innerHTML=`<aside class="sidebar" id="sidebar" aria-label="Menu principal">
      <a href="salas.html" class="brand"><span class="brand-mark" aria-hidden="true">C</span><span>Campus<span class="flow">Flow</span></span></a>
      <p class="sidebar-caption">NAVEGAÇÃO</p><nav class="nav-list">${nav}</nav>
     <div class="sidebar-bottom"><a class="nav-link" href="../index.html" id="logoutLink"><span class="nav-symbol" aria-hidden="true">↪</span><span>Sair</span></a></div>
    </aside><div class="sidebar-overlay" id="sidebarOverlay" hidden></div>`;
    document.getElementById('topbarMount').innerHTML=`<header class="topbar"><button class="icon-button menu-toggle" id="menuToggle" type="button" aria-label="Abrir menu" aria-expanded="false" aria-controls="sidebar">☰</button><div class="breadcrumb"><a href="salas.html">Início</a><span aria-hidden="true">/</span><strong>${safeText(titles[page]||'CampusFlow')}</strong></div><div class="topbar-actions"><div class="user-chip"><span class="avatar">${safeText(initials(nome))}</span><span><strong>${safeText(nome)}</strong><small>Sessão autenticada</small></span></div></div></header>`;
    document.getElementById('footerMount').innerHTML=`<footer class="app-footer"><span>© ${new Date().getFullYear()} CampusFlow</span><span>API Node.js + MariaDB · reservas reais</span></footer>`;
    const sidebar=document.getElementById('sidebar'),overlay=document.getElementById('sidebarOverlay'),toggle=document.getElementById('menuToggle');
    const close=()=>{sidebar.classList.remove('is-open');overlay.classList.remove('is-visible');overlay.hidden=true;toggle.setAttribute('aria-expanded','false');};
    toggle.addEventListener('click',()=>{if(sidebar.classList.contains('is-open'))close();else{sidebar.classList.add('is-open');overlay.hidden=false;overlay.classList.add('is-visible');toggle.setAttribute('aria-expanded','true');}});
    overlay.addEventListener('click',close);
    document.addEventListener('keydown',e=>{if(e.key==='Escape')close();});
    document.getElementById('logoutLink').addEventListener('click',()=>window.CF_API.clear());
  }
  window.CF=Object.freeze({safeText,initials,toast,setupShell});
})();
