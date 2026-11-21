/* Conversão de datas do campus e regras auxiliares de apresentação (não substituem validação na API). */
(() => {
  'use strict';
  const ZONA='America/Sao_Paulo';
  const DIA=new Intl.DateTimeFormat('en-GB',{timeZone:ZONA,year:'numeric',month:'2-digit',day:'2-digit'});
  function dataCampus(instante=new Date()) {
    const parts=Object.fromEntries(DIA.formatToParts(instante).map(x=>[x.type,x.value]));
    return `${parts.year}-${parts.month}-${parts.day}`;
  }
  function isoCampus(data,hora){
    if(!/^\d{4}-\d{2}-\d{2}$/.test(data)|| !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(hora))throw new Error('Informe data e horário válidos.');
    const [ano,mes,dia]=data.split('-').map(Number);
    const v=new Date(Date.UTC(ano,mes-1,dia));
    if(v.getUTCFullYear()!==ano||v.getUTCMonth()!==mes-1||v.getUTCDate()!==dia) throw new Error('Data inválida.');
    // O protótipo usa o fuso America/Sao_Paulo, atualmente UTC-03:00.
    return `${data}T${hora}:00-03:00`;
  }
  function dataHora(iso){
    const date=new Date(iso);
    if(Number.isNaN(date.getTime()))return 'Data indisponível';
    return new Intl.DateTimeFormat('pt-BR',{timeZone:ZONA,dateStyle:'short',timeStyle:'short'}).format(date);
  }
  function cancelarPermitido(reserva,agora=Date.now()){
    return reserva?.status==='confirmada' && new Date(reserva.inicio).getTime()>agora;
  }
  const statusNomes={confirmada:'Confirmada',em_uso:'Em uso',concluida:'Concluída',expirada:'Expirada (sem check-in)',cancelada:'Cancelada'};
  window.CF_RESERVAS=Object.freeze({ZONA,dataCampus,isoCampus,dataHora,cancelarPermitido,statusNomes});
})();
