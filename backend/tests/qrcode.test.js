import test from 'node:test';
import assert from 'node:assert/strict';
import { gerarTokenQr, hashTokenQr, gerarQrCodeSvg, gerarQrCodeDataUri } from '../src/utils/qrcode.js';

test('gerarTokenQr produz string hexadecimal segura de 64 caracteres', () => {
  const token1 = gerarTokenQr();
  const token2 = gerarTokenQr();
  assert.equal(typeof token1, 'string');
  assert.equal(token1.length, 64);
  assert.match(token1, /^[0-9a-f]{64}$/);
  assert.notEqual(token1, token2);
});

test('hashTokenQr calcula SHA-256 determinístico', () => {
  const token = 'a'.repeat(64);
  const hash1 = hashTokenQr(token);
  const hash2 = hashTokenQr(token);
  assert.equal(hash1.length, 64);
  assert.match(hash1, /^[0-9a-f]{64}$/);
  assert.equal(hash1, hash2);

  // Espaços são normalizados
  assert.equal(hashTokenQr(`  ${token}  `), hash1);
  assert.throws(() => hashTokenQr(''), /inválido/);
});

test('gerarQrCodeSvg produz SVG com dimensões e caminho válidos', () => {
  const url = 'http://localhost/CampusFlow/frontend/pages/checkin.html?token=test1234567890';
  const svg = gerarQrCodeSvg(url);
  assert.ok(svg.startsWith('<svg'));
  assert.ok(svg.endsWith('</svg>'));
  assert.ok(svg.includes('viewBox='));
  assert.ok(svg.includes('<path d="M'));
  assert.ok(svg.includes('fill="#0f172a"'));
});

test('gerarQrCodeDataUri produz data URI em base64 válida', () => {
  const url = 'http://localhost/CampusFlow/frontend/pages/checkin.html?token=xyz';
  const dataUri = gerarQrCodeDataUri(url);
  assert.ok(dataUri.startsWith('data:image/svg+xml;base64,'));
  const base64 = dataUri.replace('data:image/svg+xml;base64,', '');
  const decoded = Buffer.from(base64, 'base64').toString('utf8');
  assert.ok(decoded.startsWith('<svg'));
});
