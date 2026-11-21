const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const frontend=path.resolve(__dirname,'../frontend');
function carregarApi(fetchMock){
  const valores=new Map();
  const sessionStorage={getItem:k=>valores.get(k)||null,setItem:(k,v)=>valores.set(k,v),removeItem:k=>valores.delete(k)};
  const window={};
  const source=fs.readFileSync(path.join(frontend,'assets/js/api.js'),'utf8');
  vm.runInNewContext(source,{window,sessionStorage,fetch:fetchMock,URLSearchParams});
  return window.CF_API;
}
function carregarDatas(){
  const window={};
  const source=fs.readFileSync(path.join(frontend,'assets/js/reservas-utils.js'),'utf8');
  vm.runInNewContext(source,{window,Intl,Date,Error});
  return window.CF_RESERVAS;
}
const ok=body=>({ok:true,json:async()=>body});
test('rota POST reserva recebe Bearer e payload sem RA',async()=>{
  let chamada;
  const api=carregarApi(async(url,options)=>{
    if(url.endsWith('/auth/login'))return ok({token:'jwt',usuario:{id:1}});
    chamada={url,options};return ok({reserva:{id:12,status:'confirmada'}});
  });
  await api.login('aluno_teste','senha');
  const payload={sala_id:1,inicio:'2027-01-18T14:00:00-03:00',fim:'2027-01-18T16:00:00-03:00',pessoas:12};
  const resposta=await api.criarReserva(payload);
  assert.equal(chamada.url,'http://localhost:3001/api/reservas');
  assert.equal(chamada.options.method,'POST');
  assert.equal(chamada.options.headers.Authorization,'Bearer jwt');
  assert.equal(JSON.parse(chamada.options.body).pessoas,12);
  assert.equal('ra' in JSON.parse(chamada.options.body),false);
  assert.equal(resposta.reserva.id,12);
});
test('consulta de recomendações codifica fuso e quantidade',async()=>{
  let chamada;
  const api=carregarApi(async(url,options)=>{
    if(url.endsWith('/auth/login'))return ok({token:'jwt',usuario:{id:1}});
    chamada=url;return ok({recomendadas:[{id:1,nome:'Sala 101'}]});
  });
  await api.login('u','p');
  const salas=await api.recomendadas({inicio:'2027-01-18T14:00:00-03:00',fim:'2027-01-18T15:00:00-03:00',pessoas:12});
  assert.equal(salas.length,1);
  const url=new URL(chamada);
  assert.equal(url.pathname,'/api/salas/recomendadas');
  assert.equal(url.searchParams.get('pessoas'),'12');
  assert.equal(url.searchParams.get('inicio'),'2027-01-18T14:00:00-03:00');
});
test('histórico chama rota autenticada e retorna coleção',async()=>{
  let chamada;
  const api=carregarApi(async(url,opts)=>{
    if(url.endsWith('/auth/login'))return ok({token:'jwt',usuario:{id:1}});
    chamada={url,opts};return ok({reservas:[{id:11,status:'confirmada'}]});
  });
  await api.login('u','p');
  assert.equal((await api.minhasReservas())[0].status,'confirmada');
  assert.equal(chamada.url,'http://localhost:3001/api/reservas/minhas');
  assert.equal(chamada.opts.headers.Authorization,'Bearer jwt');
});
test('cancelamento envia POST para a reserva correta',async()=>{
  let chamada;
  const api=carregarApi(async(url,opts)=>{
    if(url.endsWith('/auth/login'))return ok({token:'jwt',usuario:{id:1}});
    chamada={url,opts};return ok({status:'cancelada'});
  });
  await api.login('u','p');
  await api.cancelarReserva(42);
  assert.equal(chamada.url,'http://localhost:3001/api/reservas/42/cancelar');
  assert.equal(chamada.opts.method,'POST');
  await assert.rejects(()=>api.cancelarReserva('../'),/inválido/i);
});
test('reserva conflitante preserva status 409 para interface',async()=>{
  const api=carregarApi(async(url)=>{
    if(url.endsWith('/auth/login'))return ok({token:'jwt',usuario:{id:1}});
    return {ok:false,status:409,json:async()=>({erro:'Já existe reserva para essa sala nesse intervalo.'})};
  });
  await api.login('u','p');
  await assert.rejects(()=>api.criarReserva({}),err=>err.status===409);
});
test('datas em horário do campus produzem offset explícito',()=>{
  const u=carregarDatas();
  assert.equal(u.isoCampus('2027-01-18','14:30'),'2027-01-18T14:30:00-03:00');
  assert.equal(u.dataCampus(new Date('2027-01-18T01:00:00Z')),'2027-01-17');
  assert.match(u.dataHora('2027-01-18T17:30:00.000Z'),/14:30/);
});
test('datas inválidas são rejeitadas',()=>{
  const u=carregarDatas();
  assert.throws(()=>u.isoCampus('2027-02-30','15:00'));
  assert.throws(()=>u.isoCampus('2027-01-18','25:00'));
});
test('cancelamento na interface só aparece para reserva futura e confirmada',()=>{
  const u=carregarDatas(),agora=new Date('2027-01-01T15:00:00Z').getTime();
  assert.equal(u.cancelarPermitido({status:'confirmada',inicio:'2027-01-18T17:00:00Z'},agora),true);
  assert.equal(u.cancelarPermitido({status:'cancelada',inicio:'2027-01-18T17:00:00Z'},agora),false);
  assert.equal(u.cancelarPermitido({status:'confirmada',inicio:'2026-12-31T17:00:00Z'},agora),false);
});
test('páginas estão vinculadas aos clientes de API e não ao storage simulado',()=>{
  const pages=['salas.html','reservar-sala.html','minhas-reservas.html'];
  for(const page of pages){
    const html=fs.readFileSync(path.join(frontend,'pages',page),'utf8');
    assert.match(html,/assets\/js\/api\.js/);
    assert.doesNotMatch(html,/assets\/js\/data\.js/);
  }
});
