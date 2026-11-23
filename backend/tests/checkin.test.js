import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gerarTokenReserva, hashTokenQr, gerarQrCodeSvg } from '../src/utils/qrcode.js';
import { construirHtmlEmailConfirmacao, notificarReservaCriada } from '../src/services/emailService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const OUTBOX_DIR = path.resolve(__dirname, '../outbox');

test('construirHtmlEmailConfirmacao gera HTML com dados da reserva e QR Code', () => {
  const checkinUrl = 'http://localhost/CampusFlow/frontend/pages/checkin.html?token=123';
  const qrSvg = gerarQrCodeSvg(checkinUrl);
  const html = construirHtmlEmailConfirmacao({
    reservaId: 42,
    usuarioNome: 'Professor Teste',
    salaNome: 'Sala 101',
    predio: 'Bloco A',
    inicio: '2026-12-15T14:00:00-03:00',
    fim: '2026-12-15T16:00:00-03:00',
    pessoas: 12,
    titulo: 'Aula de Sistemas Computacionais',
    descricao: 'Revisão com projetor',
    checkinUrl,
    qrSvg,
  });

  assert.ok(html.includes('CampusFlow'));
  assert.ok(html.includes('#42'));
  assert.ok(html.includes('Professor Teste'));
  assert.ok(html.includes('Sala 101'));
  assert.ok(html.includes('Bloco A'));
  assert.ok(html.includes('12 participantes'));
  assert.ok(html.includes('<svg'));
  assert.ok(!html.includes('api.qrserver.com'));
  assert.ok(html.includes(checkinUrl));
});

test('notificarReservaCriada grava e-mail e metadados no outbox local', async () => {
  const token = 'abcdef1234567890'.repeat(4);
  const resultado = await notificarReservaCriada({
    reservaId: 999,
    usuario: { id: 1, nome_completo: 'Aluno Teste', email: 'aluno@campusflow.local' },
    sala: { id: 1, nome: 'Sala 101', predio: 'Bloco A' },
    inicio: '2026-12-15T14:00:00-03:00',
    fim: '2026-12-15T16:00:00-03:00',
    pessoas: 15,
    token,
    titulo: 'Reunião do Grupo',
    descricao: 'Testando automação',
  });

  assert.equal(resultado.sucesso, true);
  assert.ok(fs.existsSync(resultado.outboxPath));
  const conteudo = fs.readFileSync(resultado.outboxPath, 'utf8');
  assert.ok(conteudo.includes('#999'));
  assert.ok(conteudo.includes('Aluno Teste'));

  // Limpeza do teste
  fs.unlinkSync(resultado.outboxPath);
  const jsonPath = resultado.outboxPath.replace('.html', '.json');
  if (fs.existsSync(jsonPath)) fs.unlinkSync(jsonPath);
});

test('validação de janela temporal de check-in (15 min antes até o término)', () => {
  const inicioUtc = new Date('2026-12-15T17:00:00Z').getTime(); // 14:00 no campus
  const fimUtc = new Date('2026-12-15T19:00:00Z').getTime(); // 16:00 no campus
  const toleranciaAntecipadaMs = 15 * 60 * 1000;

  function estaNaJanela(agoraMs) {
    if (agoraMs < inicioUtc - toleranciaAntecipadaMs) return 'muito_cedo';
    if (agoraMs > fimUtc) return 'muito_tarde';
    return 'valido';
  }

  // 30 min antes: muito cedo
  assert.equal(estaNaJanela(inicioUtc - 30 * 60 * 1000), 'muito_cedo');
  // 15 min antes: válido
  assert.equal(estaNaJanela(inicioUtc - 15 * 60 * 1000), 'valido');
  // 5 min antes: válido
  assert.equal(estaNaJanela(inicioUtc - 5 * 60 * 1000), 'valido');
  // Durante a reserva: válido
  assert.equal(estaNaJanela(inicioUtc + 30 * 60 * 1000), 'valido');
  // No término exato: válido
  assert.equal(estaNaJanela(fimUtc), 'valido');
  // 1 min depois do término: muito tarde
  assert.equal(estaNaJanela(fimUtc + 60 * 1000), 'muito_tarde');
});
