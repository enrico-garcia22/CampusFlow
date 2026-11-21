import { Router } from 'express';
import { pool } from '../config/db.js';
import { exigirLogin } from '../middleware/autenticacao.js';
import { atualizarStatusReservas } from '../services/statusReservas.js';
import { validarPeriodo, dentroDoHorarioSala, paraSqlUtc } from '../utils/datas.js';
import { ordenarSalasRecomendadas } from '../utils/recomendacao.js';
import { ErroHttp } from '../utils/erros.js';

export const salasRouter = Router();
salasRouter.use(exigirLogin);

salasRouter.get('/', async (_req, res) => {
  await atualizarStatusReservas();
  const [salas] = await pool.execute(`
    SELECT s.id, s.nome, s.predio, s.capacidade,
           TIME_FORMAT(s.abre_as, '%H:%i') AS abre_as,
           TIME_FORMAT(s.fecha_as, '%H:%i') AS fecha_as,
           s.descricao,
           (SELECT r.status FROM reservas r
             WHERE r.sala_id = s.id
               AND r.status IN ('confirmada', 'em_uso')
               AND r.inicio_utc <= UTC_TIMESTAMP() AND r.fim_utc > UTC_TIMESTAMP()
             ORDER BY r.inicio_utc LIMIT 1) AS status_agora
    FROM salas s WHERE s.ativa = 1 ORDER BY s.id
  `);
  res.json({ salas: salas.map((s) => ({ ...s, estado_agora:
    s.status_agora === 'em_uso' ? 'em_uso' : s.status_agora === 'confirmada' ? 'reservada' : 'livre' })) });
});

salasRouter.get('/recomendadas', async (req, res) => {
  const { inicio, fim } = req.query;
  const pessoas = Number(req.query.pessoas);
  if (!Number.isInteger(pessoas) || pessoas < 1 || pessoas > 10000) {
    throw new ErroHttp(422, 'Quantidade de pessoas inválida.');
  }
  const { dataInicio, dataFim } = validarPeriodo(inicio, fim);
  await atualizarStatusReservas();
  const [salas] = await pool.execute(`
    SELECT s.id, s.nome, s.predio, s.capacidade,
           TIME_FORMAT(s.abre_as, '%H:%i') AS abre_as,
           TIME_FORMAT(s.fecha_as, '%H:%i') AS fecha_as,
           EXISTS (SELECT 1 FROM reservas r
             WHERE r.sala_id = s.id AND r.status IN ('confirmada','em_uso')
               AND r.inicio_utc < ? AND r.fim_utc > ?) AS possui_conflito
    FROM salas s WHERE s.ativa = 1 ORDER BY s.id
  `, [paraSqlUtc(dataFim), paraSqlUtc(dataInicio)]);
  const avaliadas = salas.map((s) => ({
    ...s,
    disponivel: !Boolean(s.possui_conflito),
    funciona_no_periodo: dentroDoHorarioSala(dataInicio, dataFim, s),
  }));
  const recomendadas = ordenarSalasRecomendadas(avaliadas, pessoas);
  res.json({ pessoas, inicio, fim, total: recomendadas.length, recomendadas });
});
