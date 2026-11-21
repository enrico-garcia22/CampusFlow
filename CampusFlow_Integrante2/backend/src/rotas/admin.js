import { Router } from 'express';
import { pool } from '../config/db.js';
import { exigirLogin, exigirAdmin } from '../middleware/autenticacao.js';
import { atualizarStatusReservas } from '../services/statusReservas.js';
import { sqlUtcParaIso } from '../utils/datas.js';

export const adminRouter = Router();
adminRouter.use(exigirLogin, exigirAdmin);

// Visão restrita ao administrador: dados necessários para futura notificação.
adminRouter.get('/reservas', async (_req, res) => {
  await atualizarStatusReservas();
  const [linhas] = await pool.execute(`
    SELECT r.id, r.sala_id, s.nome AS sala_nome, r.usuario_id,
           u.email AS responsavel_email, r.responsavel_nome, r.responsavel_ra,
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

adminRouter.get('/estatisticas', async (_req, res) => {
  await atualizarStatusReservas();
  const [linhas] = await pool.execute(`
    SELECT s.id AS sala_id, s.nome AS sala_nome,
           COUNT(r.id) AS total_reservas,
           SUM(CASE WHEN r.status = 'expirada' THEN 1 ELSE 0 END) AS faltas,
           SUM(CASE WHEN r.status IN ('em_uso','concluida') THEN 1 ELSE 0 END) AS utilizadas
    FROM salas s LEFT JOIN reservas r ON r.sala_id = s.id
    GROUP BY s.id, s.nome ORDER BY s.id
  `);
  res.json({ por_sala: linhas.map((x) => ({
    ...x, total_reservas: Number(x.total_reservas),
    faltas: Number(x.faltas), utilizadas: Number(x.utilizadas),
  })) });
});
