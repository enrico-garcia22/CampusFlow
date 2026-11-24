import test from 'node:test';
import assert from 'node:assert/strict';
import { gerarTokenReserva, hashTokenQr } from '../src/utils/qrcode.js';

const reserva = {
  usuarioId: 1,
  salaId: 1,
  inicioUtc: '2026-11-24 16:30:00',
  fimUtc: '2026-11-24 17:00:00',
};

test('duas reservas para o mesmo usuário, sala e horário têm QR únicos quando IDs mudam', () => {
  const tokenPrimeiro = gerarTokenReserva({ ...reserva, reservaId: 101 });
  const tokenSegundo = gerarTokenReserva({ ...reserva, reservaId: 102 });
  assert.notEqual(tokenPrimeiro, tokenSegundo);
  assert.notEqual(hashTokenQr(tokenPrimeiro), hashTokenQr(tokenSegundo));
});

test('QR novo pode ser reconstruído com o mesmo ID após a reserva ser salva', () => {
  const dados = { ...reserva, reservaId: 103 };
  const tokenInicial = gerarTokenReserva(dados);
  const tokenConsultado = gerarTokenReserva(dados);
  assert.equal(tokenInicial, tokenConsultado);
  assert.equal(hashTokenQr(tokenInicial), hashTokenQr(tokenConsultado));
});

test('QR legado continua recuperável sem precisar alterar reservas antigas', () => {
  const tokenLegado = gerarTokenReserva(reserva);
  assert.equal(tokenLegado, gerarTokenReserva({ ...reserva, reservaId: null }));
  const tokenNovo = gerarTokenReserva({ ...reserva, reservaId: 101 });
  assert.notEqual(tokenLegado, tokenNovo);
});

test('identificadores inválidos não geram QR com versão nova', () => {
  assert.throws(() => gerarTokenReserva({ ...reserva, reservaId: 0 }));
  assert.throws(() => gerarTokenReserva({ ...reserva, reservaId: -7 }));
  assert.throws(() => gerarTokenReserva({ ...reserva, reservaId: 'inválido' }));
});
