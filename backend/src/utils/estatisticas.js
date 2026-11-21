import { FUSO_CAMPUS, sqlUtcParaIso } from './datas.js';

// Percentuais derivados de agregações: valores nulos indicam amostra insuficiente.
export function percentual(parte, total) {
  if (!total) return null;
  return Math.round((Number(parte) / Number(total)) * 1000) / 10;
}

const quantidade = (valor) => Number(valor ?? 0);

// Não depende de conexão com o banco; facilita testes unitários da regra de negócio.
export function normalizarEstatisticaSala(linha) {
  const total_reservas = quantidade(linha.total_reservas);
  const confirmadas = quantidade(linha.confirmadas);
  const em_uso = quantidade(linha.em_uso);
  const concluidas = quantidade(linha.concluidas);
  const canceladas = quantidade(linha.canceladas);
  const faltas = quantidade(linha.faltas);
  const utilizadas = em_uso + concluidas;
  const minutos_reservados_com_checkin = quantidade(linha.minutos_reservados_com_checkin);
  const minutos_potencialmente_liberados = quantidade(linha.minutos_potencialmente_liberados);
  const pessoas_minutos_planejados = quantidade(linha.pessoas_minutos_planejados);
  const capacidade_minutos_planejados = quantidade(linha.capacidade_minutos_planejados);
  const pessoas_minutos_com_checkin = quantidade(linha.pessoas_minutos_com_checkin);
  const capacidade_minutos_com_checkin = quantidade(linha.capacidade_minutos_com_checkin);
  const comparaveis = utilizadas + faltas;

  return {
    sala_id: quantidade(linha.sala_id),
    sala_nome: linha.sala_nome,
    capacidade: quantidade(linha.capacidade),
    total_reservas,
    confirmadas,
    em_uso,
    concluidas,
    canceladas,
    faltas,
    utilizadas, // compatibilidade com a versão anterior
    taxa_comparecimento_percentual: percentual(utilizadas, comparaveis),
    taxa_ausencia_percentual: percentual(faltas, comparaveis),
    aproveitamento_planejado_percentual: percentual(pessoas_minutos_planejados, capacidade_minutos_planejados),
    aproveitamento_com_checkin_percentual: percentual(pessoas_minutos_com_checkin, capacidade_minutos_com_checkin),
    minutos_reservados_com_checkin,
    minutos_potencialmente_liberados,
    // Dados internos para agregar percentuais ponderados (não exportados na resposta final).
    _base: {
      pessoas_minutos_planejados,
      capacidade_minutos_planejados,
      pessoas_minutos_com_checkin,
      capacidade_minutos_com_checkin,
    },
  };
}

export function resumirEstatisticas(salas) {
  const soma = (campo) => salas.reduce((total, sala) => total + sala[campo], 0);
  const somaBase = (campo) => salas.reduce((total, sala) => total + sala._base[campo], 0);
  const utilizadas = soma('utilizadas');
  const faltas = soma('faltas');
  return {
    quantidade_salas: salas.length,
    total_reservas: soma('total_reservas'),
    confirmadas: soma('confirmadas'),
    em_uso: soma('em_uso'),
    concluidas: soma('concluidas'),
    utilizadas,
    canceladas: soma('canceladas'),
    faltas,
    taxa_comparecimento_percentual: percentual(utilizadas, utilizadas + faltas),
    taxa_ausencia_percentual: percentual(faltas, utilizadas + faltas),
    aproveitamento_planejado_percentual: percentual(
      somaBase('pessoas_minutos_planejados'), somaBase('capacidade_minutos_planejados')),
    aproveitamento_com_checkin_percentual: percentual(
      somaBase('pessoas_minutos_com_checkin'), somaBase('capacidade_minutos_com_checkin')),
    minutos_reservados_com_checkin: soma('minutos_reservados_com_checkin'),
    minutos_potencialmente_liberados: soma('minutos_potencialmente_liberados'),
  };
}

const formatoHora = new Intl.DateTimeFormat('pt-BR', {
  timeZone: FUSO_CAMPUS,
  hour: '2-digit',
  hourCycle: 'h23',
});

// Entradas agregadas pelo banco em horas UTC; agrupamento por hora local do campus.
export function demandaPorHorario(linhas) {
  const horas = Array.from({ length: 24 }, (_, hora) => ({
    horario: `${String(hora).padStart(2, '0')}:00`, total_reservas: 0,
  }));
  for (const linha of linhas) {
    const data = new Date(sqlUtcParaIso(linha.inicio_utc));
    if (Number.isNaN(data.getTime())) throw new Error('Data UTC inválida retornada pelo banco.');
    const horario = `${formatoHora.format(data)}:00`;
    const item = horas.find((h) => h.horario === horario);
    if (item) item.total_reservas += quantidade(linha.total);
  }
  return {
    demanda_por_hora: horas,
    horarios_mais_procurados: horas.filter((h) => h.total_reservas > 0)
      .sort((a, b) => b.total_reservas - a.total_reservas || a.horario.localeCompare(b.horario))
      .slice(0, 5),
  };
}

export function removerBasesInternas(salas) {
  return salas.map(({ _base, ...dadosPublicos }) => dadosPublicos);
}
