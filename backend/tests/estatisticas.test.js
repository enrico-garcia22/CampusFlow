import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizarEstatisticaSala, resumirEstatisticas, demandaPorHorario,
  removerBasesInternas,
} from '../src/utils/estatisticas.js';

const base = {
  sala_id: 1, sala_nome: 'Sala 101', capacidade: 15,
  total_reservas: 5, confirmadas: 1, em_uso: 1, concluidas: 1,
  canceladas: 1, faltas: 1,
  minutos_reservados_com_checkin: 120,
  minutos_potencialmente_liberados: 110,
  pessoas_minutos_planejados: 1440,
  capacidade_minutos_planejados: 1800,
  pessoas_minutos_com_checkin: 900,
  capacidade_minutos_com_checkin: 1200,
};

test('conta cancelamentos, faltas e check-ins e calcula taxas corretas', () => {
  const sala = normalizarEstatisticaSala(base);
  assert.equal(sala.total_reservas, 5);
  assert.equal(sala.utilizadas, 2);
  assert.equal(sala.faltas, 1);
  assert.equal(sala.canceladas, 1);
  assert.equal(sala.taxa_comparecimento_percentual, 66.7);
  assert.equal(sala.taxa_ausencia_percentual, 33.3);
  assert.equal(sala.aproveitamento_planejado_percentual, 80);
  assert.equal(sala.aproveitamento_com_checkin_percentual, 75);
  assert.equal(sala.minutos_potencialmente_liberados, 110);
});

test('não inventa percentuais quando não existem reservas comparáveis', () => {
  const vazio = normalizarEstatisticaSala({ sala_id: 2, sala_nome: 'Sala 102', capacidade: 30 });
  assert.equal(vazio.taxa_ausencia_percentual, null);
  assert.equal(vazio.taxa_comparecimento_percentual, null);
  assert.equal(vazio.aproveitamento_planejado_percentual, null);
  assert.equal(vazio.utilizadas, 0);
  assert.equal(vazio.faltas, 0);
});

test('resumo agrega percentuais ponderados, não médias de percentuais', () => {
  const sala1 = normalizarEstatisticaSala(base);
  const sala2 = normalizarEstatisticaSala({
    ...base, sala_id: 2, sala_nome: 'Sala 102', capacidade: 30,
    total_reservas: 1, confirmadas: 0, em_uso: 0, concluidas: 1,
    canceladas: 0, faltas: 0,
    pessoas_minutos_planejados: 300, capacidade_minutos_planejados: 600,
    pessoas_minutos_com_checkin: 300, capacidade_minutos_com_checkin: 600,
  });
  const geral = resumirEstatisticas([sala1, sala2]);
  assert.equal(geral.total_reservas, 6);
  assert.equal(geral.utilizadas, 3);
  assert.equal(geral.taxa_comparecimento_percentual, 75);
  assert.equal(geral.aproveitamento_planejado_percentual, 72.5);
  assert.ok(!('_base' in removerBasesInternas([sala1])[0]));
});

test('horários são convertidos do UTC para o fuso do campus', () => {
  const result = demandaPorHorario([
    { inicio_utc: '2026-12-15 17:00:00', total: 3 }, // 14:00 no campus
    { inicio_utc: '2026-12-16 17:00:00', total: 2 },
    { inicio_utc: '2026-12-15 18:00:00', total: 1 },
  ]);
  assert.equal(result.demanda_por_hora.find((x) => x.horario === '14:00').total_reservas, 5);
  assert.deepEqual(result.horarios_mais_procurados[0], { horario: '14:00', total_reservas: 5 });
});
