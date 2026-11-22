/* CampusFlow: cliente REST — fase 2: autenticação, salas e reservas reais. */
(() => {
  'use strict';
  const BASE = 'http://localhost:3001/api';
  const KEY = 'campusflow.api.session.v1';
  const read = () => {
    try {
      const data = JSON.parse(sessionStorage.getItem(KEY) || 'null');
      return data && typeof data.token === 'string' && data.usuario ? data : null;
    } catch { return null; }
  };
  function save(data) {
    if (!data || !data.token || !data.usuario) throw new Error('Resposta de autenticação incompleta.');
    sessionStorage.setItem(KEY, JSON.stringify({token:data.token, usuario:data.usuario}));
  }
  function clear() { sessionStorage.removeItem(KEY); }
  async function request(path, {method='GET', data=null, auth=true}={}) {
    const session=read();
    if (auth && !session) throw new Error('Sessão ausente. Entre novamente.');
    const headers={ 'Accept':'application/json' };
    if (data!==null) headers['Content-Type']='application/json';
    if (auth) headers.Authorization=`Bearer ${session.token}`;
    let response;
    try {
      response=await fetch(`${BASE}${path}`, {method,headers,body:data!==null?JSON.stringify(data):undefined,cache:'no-store'});
    } catch {throw new Error('Não foi possível conectar à API. Confirme o Node.js em http://localhost:3001 e o XAMPP.');}
    let body;
    try {body=await response.json();} catch {body={};}
    if (!response.ok) {
      if (auth && response.status === 401) clear();
      const error=new Error(body.erro || `Erro HTTP ${response.status}.`);
      error.status=response.status;
      throw error;
    }
    return body;
  }
  async function login(nome_usuario,senha) {
    const response=await request('/auth/login',{method:'POST',data:{nome_usuario,senha},auth:false});
    save(response);
    return response.usuario;
  }
  async function cadastro(payload){return request('/auth/cadastro',{method:'POST',data:payload,auth:false});}
  async function me(){const response=await request('/auth/me');const session=read();if(session){session.usuario=response.usuario;save(session);}return response.usuario;}
  async function salas(){const response=await request('/salas');return response.salas;}
  async function recomendadas({inicio, fim, pessoas}) {
    const params = new URLSearchParams({inicio, fim, pessoas:String(pessoas)});
    const response = await request(`/salas/recomendadas?${params.toString()}`);
    return response.recomendadas;
  }
  async function criarReserva(payload) {
    return request('/reservas', {method:'POST', data:payload});
  }
  async function minhasReservas() {
    const response = await request('/reservas/minhas');
    return response.reservas;
  }
  async function cancelarReserva(id) {
    if (!Number.isSafeInteger(Number(id)) || Number(id) <= 0) throw new Error('Identificador de reserva inválido.');
    return request(`/reservas/${Number(id)}/cancelar`, {method:'POST'});
  }
  async function obterQrCode(reservaId) {
    if (!Number.isSafeInteger(Number(reservaId)) || Number(reservaId) <= 0) throw new Error('Identificador de reserva inválido.');
    return request(`/reservas/${Number(reservaId)}/qrcode`);
  }
  async function checkin(token) {
    if (!token || typeof token !== 'string') throw new Error('Token de check-in inválido.');
    return request('/reservas/checkin', {method:'POST', data:{token:token.trim()}});
  }
  window.CF_API=Object.freeze({ BASE,read,clear,login,cadastro,me,salas,recomendadas,criarReserva,minhasReservas,cancelarReserva,obterQrCode,checkin });
})();
