/* Formulário real: só a API confirma a disponibilidade. */
(() => {
  'use strict';
  document.addEventListener('DOMContentLoaded',async()=>{
    const api=window.CF_API, CF=window.CF, util=window.CF_RESERVAS;
    if(!api.read()){location.replace('../index.html');return;}
    const $=id=>document.getElementById(id);
    const form=$('bookingForm'),sel=$('sala'),data=$('data'),inicio=$('horaInicio'),fim=$('horaFim'),pessoas=$('pessoas');
    const feedback=$('bookingFeedback'),aside=$('roomPreview'),sugestoes=$('recomendacoes');
    const submit=$('submitReserva'),check=$('checkRecomendacao');
    let rooms=[];
    data.min=util.dataCampus();
    function salaAtual(){return rooms.find(r=>Number(r.id)===Number(sel.value));}
    function falha(mensagem){feedback.textContent=mensagem;}
    function horariosDaSala(room){
      if(!room)return[];
      const start=room.abre_as.slice(0,5),end=room.fecha_as.slice(0,5);
      const slots=[];
      for(let h=0;h<=23;h++)for(const m of [0,30]){
        const t=`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
        if(t>=start&&t<=end)slots.push(t);
      }
      if(end==='24:00')slots.push('24:00');
      else if(!slots.includes(end))slots.push(end); // admite último horário não múltiplo de 30 minutos
      return slots.filter(t=>t>=start&&t<=end);
    }
    function atualizarHorarios(){
      const room=salaAtual(),slots=horariosDaSala(room);
      const antigoInicio=inicio.value,antigoFim=fim.value;
      const opts=slots.map(t=>`<option value="${t}">${t}</option>`).join('');
      inicio.innerHTML='<option value="">Selecione</option>'+opts;
      fim.innerHTML='<option value="">Selecione</option>'+opts;
      if(slots.includes(antigoInicio))inicio.value=antigoInicio;
      if(slots.includes(antigoFim))fim.value=antigoFim;
      atualizarPreview();
    }
    function atualizarPreview(){
      const room=salaAtual();
      if(!room){aside.innerHTML='<h2>Escolha uma sala</h2><p class="muted small">Informações sobre o espaço selecionado aparecerão aqui.</p>';return;}
      aside.innerHTML=`<div class="room-symbol" aria-hidden="true">▤</div><h2>${CF.safeText(room.nome)}</h2>
        <p class="muted">${CF.safeText(room.predio)}</p><div class="detail-stack">
        <div><span>Capacidade máxima</span><strong>${Number(room.capacidade)} pessoas</strong></div>
        <div><span>Horário de funcionamento</span><strong>${CF.safeText(room.abre_as)} às ${CF.safeText(room.fecha_as)}</strong></div>
        <div><span>Disponibilidade</span><strong>Será confirmada para a data e horários selecionados</strong></div></div>`;
      pessoas.max=String(room.capacidade);
    }
    function pedidoPeriodo(){
      const n=Number(pessoas.value),room=salaAtual();
      if(!room)throw new Error('Selecione uma sala.');
      if(!Number.isInteger(n)||n<1)throw new Error('Informe uma quantidade inteira positiva de participantes.');
      if(n>Number(room.capacidade))throw new Error(`A sala comporta no máximo ${room.capacidade} pessoas.`);
      if(!data.value||!inicio.value||!fim.value)throw new Error('Informe a data e os horários de início e término.');
      if(fim.value<=inicio.value)throw new Error('O horário de término precisa ser posterior ao início.');
      if(data.value<util.dataCampus())throw new Error('Selecione uma data futura.');
      const ini=util.isoCampus(data.value,inicio.value),f=util.isoCampus(data.value,fim.value);
      if(new Date(ini).getTime()<=Date.now())throw new Error('O início da reserva precisa estar no futuro.');
      return{inicio:ini,fim:f,pessoas:n};
    }
    function mostrarRecomendacoes(recomendadas){
      sugestoes.hidden=false;
      if(!recomendadas.length){sugestoes.innerHTML='<div class="empty-state"><h3>Nenhuma sala disponível para esse período</h3><p>Tente outro horário, uma data diferente ou um grupo menor.</p></div>';return;}
      const itens=recomendadas.map(r=>`<li class="quick-item"><span class="quick-icon" aria-hidden="true">▤</span><span style="flex:1"><strong>${CF.safeText(r.nome)} · ${CF.safeText(r.predio)}</strong><small>${Number(r.capacidade)} lugares · ${Number(r.percentual_aproveitamento)}% de aproveitamento planejado</small></span><button type="button" class="btn btn-outline btn-sm" data-sala-recomendada="${Number(r.id)}">Selecionar</button></li>`).join('');
      sugestoes.innerHTML=`<h3>Salas disponíveis recomendadas</h3><p class="muted small">Priorizamos a menor sala que acomoda o grupo, considerando os conflitos conhecidos no momento.</p><ul class="quick-list">${itens}</ul>`;
      sugestoes.querySelectorAll('[data-sala-recomendada]').forEach(btn=>btn.addEventListener('click',()=>{
        sel.value=btn.dataset.salaRecomendada;
        atualizarHorarios();
        falha('');
        CF.toast('Sala selecionada. Confira o período antes de confirmar.');
      }));
    }
    check.addEventListener('click',async()=>{
      falha('');
      let periodo;
      try{periodo=pedidoPeriodo();}catch(err){falha(err.message);return;}
      check.disabled=true;sugestoes.hidden=false;sugestoes.textContent='Consultando disponibilidade…';
      try{mostrarRecomendacoes(await api.recomendadas(periodo));}
      catch(err){sugestoes.hidden=true;falha(err.message);if(err.status===401)location.replace('../index.html');}
      finally{check.disabled=false;}
    });
    form.addEventListener('submit',async event=>{
      event.preventDefault();falha('');
      if(!form.reportValidity())return;
      let periodo;
      try{periodo=pedidoPeriodo();}catch(err){falha(err.message);return;}
      const payload={sala_id:Number(sel.value),...periodo,
        titulo:$('titulo').value.trim()||null,descricao:$('descricao').value.trim()||null,
        nomes_participantes:$('nomesParticipantes').value.trim()||null};
      submit.disabled=true;check.disabled=true;
      try{
        const response=await api.criarReserva(payload);
        location.assign(`salas.html?reserva=ok&id=${encodeURIComponent(response.reserva.id)}`);
      }catch(err){
        falha(err.status===409?`${err.message} Consulte as salas recomendadas ou altere o horário.`:err.message);
        if(err.status===401)location.replace('../index.html');
      }finally{submit.disabled=false;check.disabled=false;}
    });
    sel.addEventListener('change',()=>{atualizarHorarios();sugestoes.hidden=true;falha('');});
    [data,inicio,fim,pessoas].forEach(el=>el.addEventListener('change',()=>{sugestoes.hidden=true;falha('');}));
    try{
      const [user,list]=await Promise.all([api.me(),api.salas()]);
      CF.setupShell(user);
      $('responsavelDados').textContent=`${user.nome_completo||user.nome_usuario} · ${user.email||''} · ${user.telefone||'telefone não informado'}`;
      rooms=Array.isArray(list)?list:[];
      sel.innerHTML='<option value="">Selecione uma sala</option>'+rooms.map(r=>`<option value="${Number(r.id)}">${CF.safeText(r.nome)} — ${CF.safeText(r.predio)} (${Number(r.capacidade)} lugares)</option>`).join('');
      const id=new URLSearchParams(location.search).get('sala');
      if(rooms.some(r=>String(r.id)===id))sel.value=id;
      atualizarHorarios();
      if(!rooms.length)falha('Nenhuma sala ativa cadastrada.');
    }catch(err){falha(err.message);submit.disabled=true;check.disabled=true;if(err.status===401)location.replace('../index.html');}
  });
})();
