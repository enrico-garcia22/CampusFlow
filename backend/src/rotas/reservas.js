import { Router } from 'express';
import { pool } from '../config/db.js';
import { exigirLogin } from '../middleware/autenticacao.js';
import { atualizarStatusReservas } from '../services/statusReservas.js';
import { validarPeriodo, dentroDoHorarioSala, paraSqlUtc, sqlUtcParaIso } from '../utils/datas.js';
import { ErroHttp } from '../utils/erros.js';

export const reservasRouter = Router();
reservasRouter.use(exigirLogin);

function textoOpcional(valor, tamanhoMaximo, campo) {
  if (valor == null || valor === '') return null;
  if (typeof valor !== 'string' || valor.trim().length > tamanhoMaximo) {
    throw new ErroHttp(422, `${campo} deve ser texto com no máximo ${tamanhoMaximo} caracteres.`);
  }
  return valor.trim() || null;
}

// GET /api/reservas/minhas - histórico do usuário, inclusive canceladas/expiradas.
reservasRouter.get('/minhas', async (req, res) => {
  await atualizarStatusReservas();
  const [linhas] = await pool.execute(`
    SELECT r.id, r.sala_id, s.nome AS sala_nome, s.predio, r.inicio_utc, r.fim_utc,
           r.qtd_pessoas, r.titulo, r.descricao, r.nomes_participantes, r.status,
           r.criado_em
    FROM reservas r JOIN salas s ON s.id = r.sala_id
    WHERE r.usuario_id = ? ORDER BY r.inicio_utc DESC
  `, [req.usuario.id]);
  res.json({ reservas: linhas.map((r) => ({
    ...r,
    inicio: sqlUtcParaIso(r.inicio_utc),
    fim: sqlUtcParaIso(r.fim_utc),
    inicio_utc: undefined, fim_utc: undefined,
  })) });
});

// POST /api/reservas - só confirma depois de uma transação com bloqueio da sala.
reservasRouter.post('/', async (req, res) => {
  const body = req.body ?? {};
  const salaId = Number(body.sala_id);
  const pessoas = Number(body.pessoas);
  if (!Number.isInteger(salaId) || salaId <= 0) throw new ErroHttp(422, 'Sala inválida.');
  if (!Number.isInteger(pessoas) || pessoas <= 0) throw new ErroHttp(422, 'Informe quantidade positiva de participantes.');

  const { dataInicio, dataFim } = validarPeriodo(body.inicio, body.fim);
  const titulo = textoOpcional(body.titulo, 150, 'Título');
  const descricao = textoOpcional(body.descricao, 3000, 'Descrição');
  const nomes = textoOpcional(body.nomes_participantes, 3000, 'Nomes dos participantes');

  const conexao = await pool.getConnection();
  try {
    await conexao.beginTransaction();
    // O FOR UPDATE serializa reservas concorrentes para esta sala.
    const [salas] = await conexao.execute(`
      SELECT id, nome, predio, capacidade, abre_as, fecha_as, ativa
      FROM salas WHERE id = ? FOR UPDATE
    `, [salaId]);
    if (!salas.length || !salas[0].ativa) throw new ErroHttp(404, 'Sala não encontrada ou desativada.');
    const sala = salas[0];
    if (pessoas > sala.capacidade) throw new ErroHttp(422, `A sala comporta no máximo ${sala.capacidade} pessoas.`);
    if (!dentroDoHorarioSala(dataInicio, dataFim, sala)) {
      throw new ErroHttp(422, `A sala funciona das ${sala.abre_as.slice(0, 5)} às ${sala.fecha_as.slice(0, 5)}.`);
    }

    // Expirar reservas antigas antes de buscar conflito; usa a mesma transação.
    await atualizarStatusReservas(conexao, salaId);
    const [conflitos] = await conexao.execute(`
      SELECT id FROM reservas
      WHERE sala_id = ? AND status IN ('confirmada','em_uso')
        AND inicio_utc < ? AND fim_utc > ? LIMIT 1
    `, [salaId, paraSqlUtc(dataFim), paraSqlUtc(dataInicio)]);
    if (conflitos.length) {
      throw new ErroHttp(409, 'Já existe reserva para essa sala nesse intervalo. Escolha outro horário ou sala.');
    }

    // Nome/telefone são obtidos da sessão. O RA só é copiado como hash irreversível.
    const [resultado] = await conexao.execute(`
      INSERT INTO reservas (
        usuario_id, sala_id, inicio_utc, fim_utc, qtd_pessoas,
        responsavel_nome, responsavel_ra, responsavel_telefone,
        titulo, descricao, nomes_participantes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [req.usuario.id, salaId, paraSqlUtc(dataInicio), paraSqlUtc(dataFim), pessoas,
        req.usuario.nome_completo, req.usuario.ra_hash, req.usuario.telefone,
        titulo, descricao, nomes]);
    await conexao.commit();
    res.status(201).json({
      mensagem: 'Reserva confirmada e salva no banco de dados.',
      reserva: {
        id: resultado.insertId, sala_id: sala.id, sala_nome: sala.nome,
        inicio: dataInicio.toISOString(), fim: dataFim.toISOString(),
        pessoas, status: 'confirmada',
      },
      integracoes_pendentes: ['envio_de_email', 'geracao_de_qr_code'],
    });
  } catch (erro) {
    await conexao.rollback();
    throw erro;
  } finally {
    conexao.release();
  }
});

// POST /api/reservas/:id/cancelar - permitido ao titular antes do início.
reservasRouter.post('/:id/cancelar', async (req, res) => {
  const reservaId = Number(req.params.id);
  if (!Number.isInteger(reservaId) || reservaId < 1) throw new ErroHttp(422, 'Reserva inválida.');
  const conexao = await pool.getConnection();
  try {
    // Descobre a sala, depois bloqueia a sala ANTES da reserva (mesma ordem de criação).
    const [base] = await conexao.execute('SELECT sala_id FROM reservas WHERE id = ? AND usuario_id = ?',
      [reservaId, req.usuario.id]);
    if (!base.length) throw new ErroHttp(404, 'Reserva não encontrada.');
    await conexao.beginTransaction();
    await conexao.execute('SELECT id FROM salas WHERE id = ? FOR UPDATE', [base[0].sala_id]);
    const [dados] = await conexao.execute(`
      SELECT id, status, inicio_utc FROM reservas
      WHERE id = ? AND usuario_id = ? FOR UPDATE
    `, [reservaId, req.usuario.id]);
    if (!dados.length) throw new ErroHttp(404, 'Reserva não encontrada.');
    if (dados[0].status !== 'confirmada') throw new ErroHttp(409, 'Só é possível cancelar reservas ainda confirmadas.');
    const [resultado] = await conexao.execute(`
      UPDATE reservas SET status = 'cancelada'
      WHERE id = ? AND status = 'confirmada' AND inicio_utc > UTC_TIMESTAMP()
    `, [reservaId]);
    if (resultado.affectedRows !== 1) throw new ErroHttp(409, 'Não é possível cancelar após o início da reserva.');
    await conexao.commit();
    res.json({ mensagem: 'Reserva cancelada.', id: reservaId, status: 'cancelada' });
  } catch (erro) {
    await conexao.rollback();
    throw erro;
  } finally {
    conexao.release();
  }
});
