/* Histórico real: apenas reservas da conta autenticada. */
(() => {
  'use strict';
  document.addEventListener('DOMContentLoaded',async()=>{
    const api=window.CF_API, CF=window.CF, util=window.CF_RESERVAS;
    if(!api.read()){location.replace('../index.html');return;}
    const $=id=>document.getElementById(id);
    const list=$('bookingList'),search=$('reservationSearch'),status=$('statusFilter'),count=$('reservationCount');
    const error=$('historyError'),dialog=$('confirmDialog'),confirm=$('confirmAction');
    let records=[],pendingId=null;
    const safe=CF.safeText;
    function render(){
      const q=search.value.trim().toLocaleLowerCase('pt-BR');
      const filtered=records.filter(r=>[r.sala_nome,r.predio,r.titulo,r.descricao,r.id].join(' ').toLocaleLowerCase('pt-BR').includes(q) && (!status.value||r.status===status.value));
      count.textContent=`${filtered.length} ${filtered.length===1?'reserva encontrada':'reservas encontradas'}`;
      if(!filtered.length){list.innerHTML='<div class="empty-state"><span class="empty-icon" aria-hidden="true">▦</span><h2>Nenhuma reserva encontrada</h2><p>Faça uma reserva ou altere os filtros.</p><a class="btn btn-primary" href="reservar-sala.html">Nova reserva</a></div>';return;}
      list.innerHTML=filtered.map(r=>{
        const badge=r.status==='confirmada'||r.status==='em_uso'?'badge-green':r.status==='cancelada'||r.status==='expirada'?'badge-red':'badge-neutral';
        const cancel=util.cancelarPermitido(r)?`<button type="button" class="btn btn-danger btn-sm" data-cancelar-id="${Number(r.id)}">Cancelar reserva</button>`:'<span class="muted small">Sem cancelamento disponível</span>';
        return `<article class="panel booking-record"><div class="booking-record-head"><div><h2>${safe(r.sala_nome)}</h2><span class="muted small">${safe(r.predio)}${r.titulo?` · ${safe(r.titulo)}`:''}</span></div><span class="badge ${badge}">${safe(util.statusNomes[r.status]||r.status)}</span></div>
          <div class="booking-record-meta"><span>▦ Início: ${safe(util.dataHora(r.inicio))}</span><span>◷ Fim: ${safe(util.dataHora(r.fim))}</span><span>♙ ${Number(r.qtd_pessoas)} participantes</span></div>
          <div class="booking-record-actions"><span class="record-ref">Reserva #${Number(r.id)}</span>${cancel}</div></article>`;
      }).join('');
      list.querySelectorAll('[data-cancelar-id]').forEach(btn=>btn.addEventListener('click',()=>{
        pendingId=Number(btn.dataset.cancelarId);
        dialog.showModal();
      }));
    }
    async function carregar(){
      error.hidden=true;count.textContent='Carregando reservas…';
      try{records=await api.minhasReservas();if(!Array.isArray(records))throw new Error('Formato do histórico inválido.');render();}
      catch(err){error.hidden=false;error.textContent=err.message;count.textContent='Falha ao carregar reservas';list.textContent='';if(err.status===401)location.replace('../index.html');}
    }
    $('dismissAction').addEventListener('click',()=>{pendingId=null;dialog.close();});
    dialog.addEventListener('close',()=>{pendingId=null;});
    confirm.addEventListener('click',async()=>{
      const id=pendingId;
      if(!id)return;
      confirm.disabled=true;
      try{await api.cancelarReserva(id);dialog.close();CF.toast(`Reserva #${id} cancelada.`);await carregar();}
      catch(err){dialog.close();CF.toast(err.message,'error');await carregar();if(err.status===401)location.replace('../index.html');}
      finally{confirm.disabled=false;}
    });
    search.addEventListener('input',render);status.addEventListener('change',render);
    $('refreshBookings').addEventListener('click',carregar);
    try{const user=await api.me();CF.setupShell(user);await carregar();}
    catch(err){error.hidden=false;error.textContent=err.message;if(err.status===401)location.replace('../index.html');}
  });
})();
