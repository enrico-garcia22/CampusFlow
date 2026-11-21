(() => {
  'use strict';
  const safe=()=>window.CF.safeText;
  let rooms=[];
  function card(r){
    const e=safe(),estado=r.estado_agora==='em_uso'?'Em uso':r.estado_agora==='reservada'?'Reservada agora':'Livre agora';
    const badge=r.estado_agora==='livre'?'badge-green':'badge-neutral';
    return `<article class="room-card"><div class="room-head"><span class="room-tag">Sala cadastrada</span><div class="room-name-row"><span class="room-symbol" aria-hidden="true">▤</span><div><h2>${e(r.nome)}</h2><div class="room-building">${e(r.predio)}</div></div></div>
    <p class="room-description">${e(r.descricao || 'Espaço universitário cadastrado no sistema.')}</p>
    <div class="room-metadata"><span>♙ ${Number(r.capacidade)} pessoas</span><span>◷ ${e(r.abre_as)} às ${e(r.fecha_as)}</span><span class="badge ${badge}">${estado}</span></div></div>
    <details class="room-details"><summary>Ver detalhes da sala</summary><div class="room-details-body"><div class="room-info-grid">
    <div><span>Localização</span><strong>${e(r.predio)}</strong></div><div><span>Capacidade máxima</span><strong>${Number(r.capacidade)} pessoas</strong></div>
    <div><span>Funcionamento diário informado</span><strong>${e(r.abre_as)} às ${e(r.fecha_as)}</strong></div><div><span>Identificador no banco</span><strong>${Number(r.id)}</strong></div>
    </div><p class="muted small">O estado exibido refere-se ao momento atual; a disponibilidade para uma data futura será validada no formulário de reserva.</p>
    <a class="btn btn-primary btn-block" href="reservar-sala.html?sala=${Number(r.id)}">Reservar sala →</a>
    </div></details></article>`;
  }
  document.addEventListener('DOMContentLoaded',async()=>{
    const {CF,CF_API}=window;
    if(!CF_API.read()){location.replace('../index.html');return;}
    const list=document.getElementById('roomList'), count=document.getElementById('roomCount'), search=document.getElementById('roomSearch'), building=document.getElementById('buildingFilter'),capacity=document.getElementById('capacityFilter');
    const msg=document.getElementById('loadError');
    const aviso=document.getElementById('reservaSuccess');
    const parametros=new URLSearchParams(location.search);
    if (parametros.get('reserva')==='ok') {
      aviso.hidden=false;
      const id=parametros.get('id');
      aviso.querySelector('[data-reserva-confirmacao]').textContent=id && /^\d+$/.test(id)
        ? `Reserva #${id} confirmada no sistema. Consulte o histórico em Minhas reservas.`
        : 'Reserva confirmada no sistema. Consulte o histórico em Minhas reservas.';
      history.replaceState(null,'',location.pathname);
    }
    function render(){
      const q=search.value.trim().toLocaleLowerCase('pt-BR');
      const filtered=rooms.filter(r=>[r.nome,r.predio,r.descricao].join(' ').toLocaleLowerCase('pt-BR').includes(q) && (!building.value||r.predio===building.value) && Number(r.capacidade)>=Number(capacity.value||0));
      count.textContent=`${filtered.length} ${filtered.length===1?'sala encontrada':'salas encontradas'}`;
      list.innerHTML=filtered.length?filtered.map(card).join(''):'<div class="empty-state full-grid"><h2>Nenhuma sala encontrada</h2><p>Altere a busca ou os filtros.</p></div>';
    }
    function reset(){search.value='';building.value='';capacity.value='';render();}
    search.addEventListener('input',render);
    [building,capacity].forEach(el=>el.addEventListener('change',render));
    document.getElementById('clearFilters').addEventListener('click',reset);
    try{
      const usuario=await CF_API.me();CF.setupShell(usuario);
      rooms=await CF_API.salas();
      if(!Array.isArray(rooms))throw new Error('A API não retornou uma lista de salas.');
      const buildings=[...new Set(rooms.map(r=>r.predio))].sort((a,b)=>a.localeCompare(b,'pt-BR'));
      building.innerHTML='<option value="">Todos os prédios</option>'+buildings.map(s=>`<option value="${CF.safeText(s)}">${CF.safeText(s)}</option>`).join('');
      render();
    }catch(err){
      if(err.status===401){location.replace('../index.html');return;}
      msg.textContent=err.message;msg.hidden=false;
      count.textContent='Falha ao carregar salas';list.textContent='Verifique o XAMPP, a API e a configuração de CORS.';
    }
  });
})();
