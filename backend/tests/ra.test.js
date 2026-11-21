import test from 'node:test';
import assert from 'node:assert/strict';
import { raValido, hashRa, indiceRa, conferirRa, validarConfiguracaoRa } from '../src/utils/ra.js';

const anterior = process.env.RA_PEPPER;
process.env.RA_PEPPER = 'ab'.repeat(32);

test('exige nove dígitos ASCII e conserva zeros à esquerda', () => {
  assert.equal(raValido('012345678'), true);
  for (const invalido of ['12345678', '1234567890', '12345678a', '123-45678', '１２３４５６７８９', 123456789, null]) {
    assert.equal(raValido(invalido), false);
  }
});

test('hash bcrypt do RA não é texto puro e só confere com valor original', async () => {
  const hash = await hashRa('012345678');
  assert.match(hash, /^\$2[aby]\$/);
  assert.notEqual(hash, '012345678');
  assert.equal(await conferirRa('012345678', hash), true);
  assert.equal(await conferirRa('012345679', hash), false);
  assert.equal(await conferirRa('12345678', hash), false);
});

test('índice é determinístico para mesmo RA, e diferente para outro', () => {
  assert.match(indiceRa('012345678'), /^[0-9a-f]{64}$/);
  assert.equal(indiceRa('012345678'), indiceRa('012345678'));
  assert.notEqual(indiceRa('012345678'), indiceRa('012345679'));
});

test('rejeita chave de RA ausente/insegura', () => {
  process.env.RA_PEPPER = 'senha-fraca';
  assert.throws(() => validarConfiguracaoRa(), /RA_PEPPER/);
  process.env.RA_PEPPER = 'ab'.repeat(32);
});

test.after(() => {
  if (anterior === undefined) delete process.env.RA_PEPPER;
  else process.env.RA_PEPPER = anterior;
});
