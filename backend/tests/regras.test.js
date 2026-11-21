import test from 'node:test';
import assert from 'node:assert/strict';
import { validarPeriodo, dentroDoHorarioSala, paraSqlUtc } from '../src/utils/datas.js';
import { ordenarSalasRecomendadas } from '../src/utils/recomendacao.js';

const agora = new Date('2026-11-19T12:00:00Z');

test('aceita período futuro coerente e converte para UTC', () => {
  const { dataInicio, dataFim } = validarPeriodo(
    '2026-11-20T14:00:00-03:00', '2026-11-20T16:00:00-03:00', agora);
  assert.equal(paraSqlUtc(dataInicio), '2026-11-20 17:00:00');
  assert.equal(paraSqlUtc(dataFim), '2026-11-20 19:00:00');
});

test('rejeita horário final anterior ao inicial', () => {
  assert.throws(() => validarPeriodo(
    '2026-11-20T16:00:00-03:00', '2026-11-20T15:00:00-03:00', agora), /posterior/);
});

test('respeita abertura e fechamento da sala', () => {
  const sala = { abre_as: '07:00:00', fecha_as: '22:00:00' };
  assert.equal(dentroDoHorarioSala(
    new Date('2026-11-20T14:00:00-03:00'), new Date('2026-11-20T16:00:00-03:00'), sala), true);
  assert.equal(dentroDoHorarioSala(
    new Date('2026-11-20T21:00:00-03:00'), new Date('2026-11-20T23:00:00-03:00'), sala), false);
});

test('sugere a menor sala que acomode o grupo sem conflitos', () => {
  const salas = [15, 50, 30, 25].map((capacidade, indice) => ({
    id: indice + 1, capacidade, disponivel: true, funciona_no_periodo: true,
  }));
  const resultado = ordenarSalasRecomendadas(salas, 12);
  assert.equal(resultado[0].capacidade, 15);
  assert.equal(resultado[0].percentual_aproveitamento, 80);
  assert.equal(resultado[0].vagas_nao_utilizadas, 3);
});

test('ignora salas com conflito ou capacidade insuficiente', () => {
  const salas = [
    { id: 1, capacidade: 10, disponivel: true, funciona_no_periodo: true },
    { id: 2, capacidade: 20, disponivel: false, funciona_no_periodo: true },
    { id: 3, capacidade: 30, disponivel: true, funciona_no_periodo: true },
  ];
  assert.deepEqual(ordenarSalasRecomendadas(salas, 15).map((x) => x.id), [3]);
});
