const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const frontend = path.resolve(__dirname, '../frontend');

function carregarApi(fetchMock) {
  const valores = new Map();
  const sessionStorage = {
    getItem: (k) => valores.get(k) || null,
    setItem: (k, v) => valores.set(k, v),
    removeItem: (k) => valores.delete(k),
  };
  const window = {};
  const source = fs.readFileSync(path.join(frontend, 'assets/js/api.js'), 'utf8');
  vm.runInNewContext(source, { window, sessionStorage, fetch: fetchMock, URLSearchParams });
  return window.CF_API;
}

const ok = (body) => ({ ok: true, json: async () => body });

test('api.obterQrCode envia requisição GET para rota autenticada da reserva', async () => {
  let chamada;
  const api = carregarApi(async (url, opts) => {
    if (url.endsWith('/auth/login')) return ok({ token: 'jwt_mock', usuario: { id: 1 } });
    chamada = { url, opts };
    return ok({ reserva_id: 10, qr_svg: '<svg></svg>', checkin_url: 'http://test' });
  });

  await api.login('usuario', 'senha');
  const res = await api.obterQrCode(10);

  assert.equal(chamada.url, 'http://localhost:3001/api/reservas/10/qrcode');
  assert.equal(chamada.opts.method, 'GET');
  assert.equal(chamada.opts.headers.Authorization, 'Bearer jwt_mock');
  assert.equal(res.reserva_id, 10);
});

test('api.checkin envia token no corpo para a rota de check-in', async () => {
  let chamada;
  const api = carregarApi(async (url, opts) => {
    if (url.endsWith('/auth/login')) return ok({ token: 'jwt_mock', usuario: { id: 1 } });
    chamada = { url, opts };
    return ok({ mensagem: 'Presença confirmada!', status: 'em_uso' });
  });

  await api.login('usuario', 'senha');
  const res = await api.checkin('token_de_teste_123');

  assert.equal(chamada.url, 'http://localhost:3001/api/reservas/checkin');
  assert.equal(chamada.opts.method, 'POST');
  assert.equal(chamada.opts.headers.Authorization, 'Bearer jwt_mock');
  assert.equal(JSON.parse(chamada.opts.body).token, 'token_de_teste_123');
  assert.equal(res.status, 'em_uso');
});

test('api.checkin valida parâmetro obrigatório', async () => {
  const api = carregarApi(async () => ok({}));
  await assert.rejects(() => api.checkin(''), /Token de check-in inválido/);
  await assert.rejects(() => api.checkin(null), /Token de check-in inválido/);
});
