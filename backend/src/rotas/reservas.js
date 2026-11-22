import { Router } from 'express';
import { pool } from '../config/db.js';
import { exigirLogin, loginOpcional } from '../middleware/autenticacao.js';
import { atualizarStatusReservas } from '../services/statusReservas.js';
import { validarPeriodo, dentroDoHorarioSala, paraSqlUtc, sqlUtcParaIso } from '../utils/datas.js';
import { ErroHttp } from '../utils/erros.js';
import { gerarTokenReserva, hashTokenQr, gerarQrCodeSvg, gerarQrCodeDataUri, obterIpLocal } from '../utils/qrcode.js';
import { notificarReservaCriada } from '../services/emailService.js';

export const reservasRouter = Router();

function textoOpcional(valor, tamanhoMaximo, campo) {
  if (valor == null || valor === '') return null;
  if (typeof valor !== 'string' || valor.trim().length > tamanhoMaximo) {
    throw new ErroHttp(422, `${campo} deve ser texto com no máximo ${tamanhoMaximo} caracteres.`);
  }
  return valor.trim() || null;
}

/**
 * Retorna a URL base do frontend para montar links de check-in que funcionem
 * tanto no localhost quanto ao escanear com a câmera do celular na mesma rede Wi-Fi.
 */
function obterFrontendBase(req) {
  if (process.env.FRONTEND_URL && !process.env.FRONTEND_URL.includes('localhost')) {
    return process.env.FRONTEND_URL.replace(/\/+$/, '');
  }
  const host = req?.headers?.host;
  if (host && !host.startsWith('localhost') && !host.startsWith('127.0.0.1')) {
    const hostname = host.split(':')[0];
    return `http://${hostname}/CampusFlow/frontend`;
  }
  const ipLocal = obterIpLocal();
  if (ipLocal && ipLocal !== '127.0.0.1') {
    return `http://${ipLocal}/CampusFlow/frontend`;
  }
  return (process.env.FRONTEND_URL || 'http://localhost/CampusFlow/frontend').replace(/\/+$/, '');
}

// =========================================================================
// ROTA PÚBLICA DE CHECK-IN: NÃO exige login obrigatório (loginOpcional)
// Permite que qualquer aluno valide presença apontando a câmera do celular
// =========================================================================

reservasRouter.post('/checkin', loginOpcional, async (req, res) => {
  const token = typeof req.body?.token === 'string' ? req.body.token.trim() : '';
  if (!token) throw new ErroHttp(422, 'Token de QR Code não informado.');

  const anonId = typeof req.body?.anon_id === 'string' ? req.body.anon_id.trim() : null;
  const nomeInformado = typeof req.body?.nome === 'string' ? req.body.nome.trim() : null;

  const tokenHash = hashTokenQr(token);
  await atualizarStatusReservas();

  const conexao = await pool.getConnection();
  try {
    await conexao.beginTransaction();

    const [reservas] = await conexao.execute(`
      SELECT r.id, r.sala_id, r.usuario_id, r.inicio_utc, r.fim_utc,
             r.qtd_pessoas, r.status, r.titulo,
             s.nome AS sala_nome, s.predio, s.capacidade
      FROM reservas r
      JOIN salas s ON s.id = r.sala_id
      WHERE r.qr_token_hash = ?
      FOR UPDATE
    `, [tokenHash]);

    if (!reservas.length) {
      throw new ErroHttp(404, 'QR Code inválido ou reserva não encontrada.');
    }

    const r = reservas[0];

    if (r.status === 'cancelada') {
      throw new ErroHttp(409, 'Esta reserva foi cancelada pelo organizador.');
    }
    if (r.status === 'expirada') {
      throw new ErroHttp(409, 'A reserva expirou por ausência de check-in dentro da tolerância de 10 minutos.');
    }
    if (r.status === 'concluida') {
      throw new ErroHttp(409, 'O horário agendado para esta reserva já foi concluído.');
    }

    const agoraUtcMs = Date.now();
    const inicioUtcMs = new Date(sqlUtcParaIso(r.inicio_utc)).getTime();
    const fimUtcMs = new Date(sqlUtcParaIso(r.fim_utc)).getTime();
    const toleranciaAntecipadaMs = 15 * 60 * 1000;

    if (agoraUtcMs < inicioUtcMs - toleranciaAntecipadaMs) {
      const minutosFaltando = Math.ceil((inicioUtcMs - agoraUtcMs) / 60000);
      throw new ErroHttp(422, `Check-in antecipado indisponível. A validação abre 15 minutos antes do início (em cerca de ${minutosFaltando} min).`);
    }

    if (agoraUtcMs > fimUtcMs) {
      throw new ErroHttp(409, 'O período da reserva já foi encerrado.');
    }

    let primeiroCheckin = false;
    if (r.status === 'confirmada') {
      await conexao.execute(`
        UPDATE reservas
        SET status = 'em_uso', confirmado_em_utc = UTC_TIMESTAMP()
        WHERE id = ?
      `, [r.id]);

      // Se o validador não estiver autenticado, registra o organizador da sala como referência
      const validadorId = req.usuario ? req.usuario.id : r.usuario_id;
      await conexao.execute(`
        INSERT INTO checkins (reserva_id, validado_por_usuario_id, registrado_em_utc, metodo)
        VALUES (?, ?, UTC_TIMESTAMP(), 'qr')
        ON DUPLICATE KEY UPDATE registrado_em_utc = registrado_em_utc
      `, [r.id, validadorId]);

      primeiroCheckin = true;
    }

    // Garante compatibilidade da tabela presencas para registros anônimos
    await conexao.execute(`
      CREATE TABLE IF NOT EXISTS presencas (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        reserva_id INT UNSIGNED NOT NULL,
        usuario_id INT UNSIGNED NULL,
        dispositivo_hash VARCHAR(64) NULL,
        nome_informado VARCHAR(150) NULL,
        registrado_em_utc DATETIME NOT NULL,
        UNIQUE KEY uq_presencas_reserva_usuario (reserva_id, usuario_id),
        KEY idx_presencas_reserva (reserva_id)
      ) ENGINE=InnoDB
    `).catch(() => {});

    await conexao.execute(`
      ALTER TABLE presencas MODIFY COLUMN usuario_id INT UNSIGNED NULL
    `).catch(() => {});
    await conexao.execute(`
      ALTER TABLE presencas ADD COLUMN dispositivo_hash VARCHAR(64) NULL AFTER usuario_id
    `).catch(() => {});
    await conexao.execute(`
      ALTER TABLE presencas ADD COLUMN nome_informado VARCHAR(150) NULL AFTER dispositivo_hash
    `).catch(() => {});

    // Registra presença do aluno (autenticado ou anônimo via câmera do celular)
    if (req.usuario) {
      await conexao.execute(`
        INSERT INTO presencas (reserva_id, usuario_id, dispositivo_hash, nome_informado, registrado_em_utc)
        VALUES (?, ?, ?, ?, UTC_TIMESTAMP())
        ON DUPLICATE KEY UPDATE registrado_em_utc = registrado_em_utc
      `, [r.id, req.usuario.id, anonId || null, req.usuario.nome_completo || null]);
    } else {
      let jaPresente = false;
      if (anonId) {
        const [existentes] = await conexao.execute(`
          SELECT id FROM presencas WHERE reserva_id = ? AND dispositivo_hash = ? LIMIT 1
        `, [r.id, anonId]).catch(() => [[]]);
        if (existentes.length > 0) jaPresente = true;
      }

      if (!jaPresente) {
        await conexao.execute(`
          INSERT INTO presencas (reserva_id, usuario_id, dispositivo_hash, nome_informado, registrado_em_utc)
          VALUES (?, NULL, ?, ?, UTC_TIMESTAMP())
        `, [r.id, anonId || null, nomeInformado || 'Participante (Câmera)']).catch(async () => {
          // Fallback caso usuario_id ainda tenha restrição NOT NULL no banco
          await conexao.execute(`
            INSERT INTO presencas (reserva_id, usuario_id, registrado_em_utc)
            VALUES (?, ?, UTC_TIMESTAMP())
            ON DUPLICATE KEY UPDATE registrado_em_utc = registrado_em_utc
          `, [r.id, r.usuario_id]);
        });
      }
    }

    const [contagem] = await conexao.execute(`
      SELECT COUNT(*) AS total FROM presencas WHERE reserva_id = ?
    `, [r.id]).catch(() => [[{ total: 1 }]]);

    const totalPresentes = Number(contagem[0]?.total ?? 1);

    await conexao.commit();

    res.json({
      sucesso: true,
      mensagem: primeiroCheckin
        ? 'Check-in realizado! A sala agora está em uso e sua presença foi confirmada.'
        : 'Presença confirmada com sucesso!',
      status: 'em_uso',
      reserva: {
        id: r.id,
        sala_nome: r.sala_nome,
        predio: r.predio,
        capacidade: r.capacidade,
        inicio: sqlUtcParaIso(r.inicio_utc),
        fim: sqlUtcParaIso(r.fim_utc),
        participantes_estimados: r.qtd_pessoas,
        participantes_presentes: totalPresentes,
        taxa_aproveitamento_estimado_percentual: r.qtd_pessoas > 0
          ? Math.round((totalPresentes / r.qtd_pessoas) * 100) : null,
        taxa_ocupacao_sala_percentual: r.capacidade > 0
          ? Math.round((totalPresentes / r.capacidade) * 100) : null,
      },
      autenticado: Boolean(req.usuario),
      participante: req.usuario ? {
        id: req.usuario.id,
        nome: req.usuario.nome_completo,
        registrado_em: new Date().toISOString(),
      } : {
        nome: nomeInformado || 'Participante (Sem login)',
        registrado_em: new Date().toISOString(),
      },
    });
  } catch (erro) {
    await conexao.rollback();
    throw erro;
  } finally {
    conexao.release();
  }
});

// =========================================================================
// ROTAS PROTEGIDAS: Exigem login do usuário titular ou administrador
// =========================================================================

// GET /api/reservas/minhas - histórico do usuário
reservasRouter.get('/minhas', exigirLogin, async (req, res) => {
  await atualizarStatusReservas();
  const [linhas] = await pool.execute(`
    SELECT r.id, r.sala_id, s.nome AS sala_nome, s.predio, s.capacidade,
           r.inicio_utc, r.fim_utc, r.qtd_pessoas, r.titulo, r.descricao,
           r.nomes_participantes, r.status, r.qr_token_hash, r.criado_em,
           (SELECT COUNT(*) FROM presencas p WHERE p.reserva_id = r.id) AS total_presentes
    FROM reservas r JOIN salas s ON s.id = r.sala_id
    WHERE r.usuario_id = ? ORDER BY r.inicio_utc DESC
  `, [req.usuario.id]).catch(async (e) => {
    if (e.code === 'ER_NO_SUCH_TABLE') {
      return pool.execute(`
        SELECT r.id, r.sala_id, s.nome AS sala_nome, s.predio, s.capacidade,
               r.inicio_utc, r.fim_utc, r.qtd_pessoas, r.titulo, r.descricao,
               r.nomes_participantes, r.status, r.qr_token_hash, r.criado_em,
               0 AS total_presentes
        FROM reservas r JOIN salas s ON s.id = r.sala_id
        WHERE r.usuario_id = ? ORDER BY r.inicio_utc DESC
      `, [req.usuario.id]);
    }
    throw e;
  });

  res.json({ reservas: linhas.map((r) => ({
    ...r,
    inicio: sqlUtcParaIso(r.inicio_utc),
    fim: sqlUtcParaIso(r.fim_utc),
    tem_qr: Boolean(r.qr_token_hash),
    total_presentes: Number(r.total_presentes ?? 0),
    inicio_utc: undefined, fim_utc: undefined, qr_token_hash: undefined,
  })) });
});

// GET /api/reservas/:id/qrcode - obtém o QR Code e detalhes para projeção/leitura
reservasRouter.get('/:id/qrcode', exigirLogin, async (req, res) => {
  const reservaId = Number(req.params.id);
  if (!Number.isInteger(reservaId) || reservaId < 1) throw new ErroHttp(422, 'Reserva inválida.');

  await atualizarStatusReservas();
  const [linhas] = await pool.execute(`
    SELECT r.id, r.sala_id, s.nome AS sala_nome, s.predio, s.capacidade,
           r.usuario_id, r.inicio_utc, r.fim_utc, r.qtd_pessoas, r.titulo,
           r.status, r.qr_token_hash, r.confirmado_em_utc
    FROM reservas r
    JOIN salas s ON s.id = r.sala_id
    WHERE r.id = ?
  `, [reservaId]);

  if (!linhas.length) throw new ErroHttp(404, 'Reserva não encontrada.');
  const r = linhas[0];
  const ehDono = req.usuario.id === r.usuario_id;
  const ehAdmin = req.usuario.perfil === 'admin';
  if (!ehDono && !ehAdmin) {
    throw new ErroHttp(403, 'Apenas o titular da reserva ou administrador pode visualizar o QR Code.');
  }

  const [presencas] = await pool.execute(`
    SELECT COUNT(*) AS total FROM presencas WHERE reserva_id = ?
  `, [reservaId]).catch(() => [[{ total: 0 }]]);

  const totalPresentes = Number(presencas[0]?.total ?? 0);

  const token = gerarTokenReserva({
    usuarioId: r.usuario_id,
    salaId: r.sala_id,
    inicioUtc: r.inicio_utc,
    fimUtc: r.fim_utc,
  });

  const frontendBase = obterFrontendBase(req);
  const checkinUrl = `${frontendBase}/pages/checkin.html?token=${encodeURIComponent(token)}`;
  const qrSvg = gerarQrCodeSvg(checkinUrl, { tamanho: 280 });
  const qrDataUri = gerarQrCodeDataUri(checkinUrl, { tamanho: 280 });

  res.json({
    reserva_id: r.id,
    sala: { id: r.sala_id, nome: r.sala_nome, predio: r.predio, capacidade: r.capacidade },
    inicio: sqlUtcParaIso(r.inicio_utc),
    fim: sqlUtcParaIso(r.fim_utc),
    status: r.status,
    participantes_estimados: r.qtd_pessoas,
    participantes_presentes: totalPresentes,
    taxa_presenca_estimada_percentual: r.qtd_pessoas > 0 ? Math.round((totalPresentes / r.qtd_pessoas) * 100) : null,
    taxa_ocupacao_sala_percentual: r.capacidade > 0 ? Math.round((totalPresentes / r.capacidade) * 100) : null,
    checkin_url: checkinUrl,
    qr_svg: qrSvg,
    qr_data_uri: qrDataUri,
  });
});

// POST /api/reservas - criação com bloqueio de concorrência e geração de QR Code
reservasRouter.post('/', exigirLogin, async (req, res) => {
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

    await atualizarStatusReservas(conexao, salaId);
    const [conflitos] = await conexao.execute(`
      SELECT id FROM reservas
      WHERE sala_id = ? AND status IN ('confirmada','em_uso')
        AND inicio_utc < ? AND fim_utc > ? LIMIT 1
    `, [salaId, paraSqlUtc(dataFim), paraSqlUtc(dataInicio)]);
    if (conflitos.length) {
      throw new ErroHttp(409, 'Já existe reserva para essa sala nesse intervalo. Escolha outro horário ou sala.');
    }

    const inicioUtcStr = paraSqlUtc(dataInicio);
    const fimUtcStr = paraSqlUtc(dataFim);

    const qrToken = gerarTokenReserva({
      usuarioId: req.usuario.id,
      salaId,
      inicioUtc: inicioUtcStr,
      fimUtc: fimUtcStr,
    });
    const qrTokenHash = hashTokenQr(qrToken);

    const [resultado] = await conexao.execute(`
      INSERT INTO reservas (
        usuario_id, sala_id, inicio_utc, fim_utc, qtd_pessoas,
        responsavel_nome, responsavel_ra, responsavel_telefone,
        titulo, descricao, nomes_participantes, qr_token_hash
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [req.usuario.id, salaId, inicioUtcStr, fimUtcStr, pessoas,
        req.usuario.nome_completo, req.usuario.ra_hash, req.usuario.telefone,
        titulo, descricao, nomes, qrTokenHash]);
    await conexao.commit();

    const frontendBase = obterFrontendBase(req);
    const checkinUrl = `${frontendBase}/pages/checkin.html?token=${encodeURIComponent(qrToken)}`;

    // Disparo assíncrono de e-mail com dados e QR Code incorporado
    setImmediate(() => {
      notificarReservaCriada({
        reservaId: resultado.insertId,
        usuario: req.usuario,
        sala,
        inicio: dataInicio.toISOString(),
        fim: dataFim.toISOString(),
        pessoas,
        token: qrToken,
        titulo,
        descricao,
      }).catch((err) => console.error('[Notificação] Erro ao enviar e-mail:', err));
    });

    res.status(201).json({
      mensagem: 'Reserva confirmada e salva no banco de dados. QR Code gerado.',
      reserva: {
        id: resultado.insertId, sala_id: sala.id, sala_nome: sala.nome,
        inicio: dataInicio.toISOString(), fim: dataFim.toISOString(),
        pessoas, status: 'confirmada',
        qr_token: qrToken,
        checkin_url: checkinUrl,
      },
    });
  } catch (erro) {
    await conexao.rollback();
    throw erro;
  } finally {
    conexao.release();
  }
});

// POST /api/reservas/:id/cancelar
reservasRouter.post('/:id/cancelar', exigirLogin, async (req, res) => {
  const reservaId = Number(req.params.id);
  if (!Number.isInteger(reservaId) || reservaId < 1) throw new ErroHttp(422, 'Reserva inválida.');
  const conexao = await pool.getConnection();
  try {
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
