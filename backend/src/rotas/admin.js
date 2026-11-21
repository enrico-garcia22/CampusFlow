import { Router } from 'express';
import { pool } from '../config/db.js';
import { exigirLogin, exigirAdmin } from '../middleware/autenticacao.js';
import { atualizarStatusReservas, GRACE_SECONDS } from '../services/statusReservas.js';
import { FUSO_CAMPUS, sqlUtcParaIso } from '../utils/datas.js';
import { normalizarEstatisticaSala, resumirEstatisticas, demandaPorHorario, removerBasesInternas } from '../utils/estatisticas.js';

export const adminRouter = Router();
adminRouter.use(exigirLogin, exigirAdmin);

// Visão restrita ao administrador: dados necessários para futura notificação.
adminRouter.get('/reservas', async (_req, res) => {
  await atualizarStatusReservas();
  const [linhas] = await pool.execute(`
    SELECT r.id, r.sala_id, s.nome AS sala_nome, r.usuario_id,
           u.email AS responsavel_email, r.responsavel_nome,
           r.responsavel_telefone, r.inicio_utc, r.fim_utc, r.qtd_pessoas,
           r.titulo, r.descricao, r.nomes_participantes, r.status
    FROM reservas r
    JOIN salas s ON s.id = r.sala_id
    JOIN usuarios u ON u.id = r.usuario_id
    ORDER BY r.inicio_utc DESC LIMIT 500
  `);
  res.json({ reservas: linhas.map(({ inicio_utc, fim_utc, ...r }) => ({
    ...r, inicio: sqlUtcParaIso(inicio_utc), fim: sqlUtcParaIso(fim_utc),
  })) });
});

// Estatísticas sem dados pessoais: cancelamentos, presenças, capacidade e tempo liberado.
adminRouter.get('/estatisticas', async (_req, res) => {
  await atualizarStatusReservas();
  const [linhas] = await pool.execute(`
    SELECT s.id AS sala_id, s.nome AS sala_nome, s.capacidade,
           COUNT(r.id) AS total_reservas,
           SUM(CASE WHEN r.status = 'confirmada' THEN 1 ELSE 0 END) AS confirmadas,
           SUM(CASE WHEN r.status = 'em_uso' THEN 1 ELSE 0 END) AS em_uso,
           SUM(CASE WHEN r.status = 'concluida' THEN 1 ELSE 0 END) AS concluidas,
           SUM(CASE WHEN r.status = 'cancelada' THEN 1 ELSE 0 END) AS canceladas,
           SUM(CASE WHEN r.status = 'expirada' THEN 1 ELSE 0 END) AS faltas,
           SUM(CASE WHEN r.status IN ('em_uso', 'concluida')
             THEN TIMESTAMPDIFF(MINUTE, r.inicio_utc, r.fim_utc) ELSE 0 END)
             AS minutos_reservados_com_checkin,
           SUM(CASE WHEN r.status = 'expirada'
             THEN GREATEST(0, TIMESTAMPDIFF(MINUTE,
               DATE_ADD(r.inicio_utc, INTERVAL ${GRACE_SECONDS} SECOND), r.fim_utc))
             ELSE 0 END) AS minutos_potencialmente_liberados,
           SUM(CASE WHEN r.status IN ('confirmada', 'em_uso', 'concluida')
             THEN r.qtd_pessoas * TIMESTAMPDIFF(MINUTE, r.inicio_utc, r.fim_utc)
             ELSE 0 END) AS pessoas_minutos_planejados,
           SUM(CASE WHEN r.status IN ('confirmada', 'em_uso', 'concluida')
             THEN s.capacidade * TIMESTAMPDIFF(MINUTE, r.inicio_utc, r.fim_utc)
             ELSE 0 END) AS capacidade_minutos_planejados,
           SUM(CASE WHEN r.status IN ('em_uso', 'concluida')
             THEN r.qtd_pessoas * TIMESTAMPDIFF(MINUTE, r.inicio_utc, r.fim_utc)
             ELSE 0 END) AS pessoas_minutos_com_checkin,
           SUM(CASE WHEN r.status IN ('em_uso', 'concluida')
             THEN s.capacidade * TIMESTAMPDIFF(MINUTE, r.inicio_utc, r.fim_utc)
             ELSE 0 END) AS capacidade_minutos_com_checkin
    FROM salas s LEFT JOIN reservas r ON r.sala_id = s.id
    GROUP BY s.id, s.nome, s.capacidade ORDER BY s.id
  `);

  const [periodos] = await pool.execute(`
    SELECT DATE_FORMAT(inicio_utc, '%Y-%m-%d %H:00:00') AS inicio_utc,
           COUNT(*) AS total
    FROM reservas
    WHERE status <> 'cancelada'
    GROUP BY DATE_FORMAT(inicio_utc, '%Y-%m-%d %H:00:00')
  `);

  const salas = linhas.map(normalizarEstatisticaSala);
  const resumo_geral = resumirEstatisticas(salas);
  const { demanda_por_hora, horarios_mais_procurados } = demandaPorHorario(periodos);
  res.json({
    resumo_geral,
    por_sala: removerBasesInternas(salas),
    demanda_por_hora,
    horarios_mais_procurados,
    metodologia: {
      fuso_horarios: FUSO_CAMPUS,
      comparaveis: 'Taxas de comparecimento e ausência consideram em_uso, concluida e expirada; excluem confirmadas e canceladas.',
      aproveitamento_planejado: 'Média ponderada por duração e capacidade de reservas confirmadas, em uso ou concluídas.',
      aproveitamento_com_checkin: 'Média ponderada por duração e capacidade de reservas que tiveram check-in; não mede presença contínua.',
      minutos_reservados_com_checkin: 'Minutos agendados associados a reservas com check-in, não tempo efetivamente detectado na sala.',
      minutos_potencialmente_liberados: `Minutos após a tolerância de ${GRACE_SECONDS} segundos em reservas expiradas; não é prova de reocupação.`,
      demanda_por_hora: 'Horário de início das reservas não canceladas, incluindo as expiradas.',
    },
  });
});
