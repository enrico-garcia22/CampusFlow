import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FUSO_CAMPUS } from '../utils/datas.js';
import { gerarQrCodeSvg } from '../utils/qrcode.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const OUTBOX_DIR = path.resolve(__dirname, '../../outbox');

function formatarDataHoraCampus(dataIsoOuDate) {
  const data = typeof dataIsoOuDate === 'string' ? new Date(dataIsoOuDate) : dataIsoOuDate;
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: FUSO_CAMPUS,
    dateStyle: 'full',
    timeStyle: 'short',
  }).format(data);
}

function formatarHoraCampus(dataIsoOuDate) {
  const data = typeof dataIsoOuDate === 'string' ? new Date(dataIsoOuDate) : dataIsoOuDate;
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: FUSO_CAMPUS,
    timeStyle: 'short',
  }).format(data);
}

/**
 * Constrói o HTML do e-mail com QR Code incorporado
 */
export function construirHtmlEmailConfirmacao({
  reservaId,
  usuarioNome,
  salaNome,
  predio,
  inicio,
  fim,
  pessoas,
  titulo,
  descricao,
  checkinUrl,
  qrSvg,
}) {
  const dataExtenso = formatarDataHoraCampus(inicio);
  const horaFim = formatarHoraCampus(fim);

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Confirmação de Reserva e QR Code - CampusFlow</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; color: #1e293b; margin: 0; padding: 24px; }
    .card { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
    .header { background: #1e3a8a; color: #ffffff; padding: 28px 24px; text-align: center; }
    .header h1 { margin: 0 0 6px 0; font-size: 22px; font-weight: 700; letter-spacing: -0.5px; }
    .header p { margin: 0; font-size: 14px; opacity: 0.9; }
    .content { padding: 28px 24px; }
    .greeting { font-size: 16px; margin-bottom: 20px; }
    .info-box { background: #f8fafc; border-left: 4px solid #2563eb; padding: 16px; border-radius: 6px; margin-bottom: 24px; }
    .info-row { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 14px; }
    .info-row:last-child { margin-bottom: 0; }
    .info-label { color: #64748b; font-weight: 500; }
    .info-value { color: #0f172a; font-weight: 600; text-align: right; }
    .qr-section { text-align: center; background: #ffffff; border: 2px dashed #cbd5e1; border-radius: 12px; padding: 24px; margin: 24px 0; }
    .qr-container { display: inline-block; padding: 12px; background: #ffffff; border-radius: 8px; }
    .qr-hint { font-size: 13px; color: #475569; margin-top: 14px; line-height: 1.5; }
    .btn-action { display: inline-block; background: #2563eb; color: #ffffff !important; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; font-size: 14px; margin-top: 14px; }
    .alert { background: #eff6ff; border: 1px solid #bfdbfe; color: #1d4ed8; padding: 14px; border-radius: 8px; font-size: 13px; line-height: 1.5; margin-top: 20px; }
    .footer { text-align: center; padding: 20px; font-size: 12px; color: #94a3b8; border-top: 1px solid #f1f5f9; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h1>CampusFlow</h1>
      <p>Confirmação de Reserva &middot; Código de Presença</p>
    </div>
    <div class="content">
      <div class="greeting">
        Olá, <strong>${usuarioNome}</strong>! Sua reserva <strong>#${reservaId}</strong> foi registrada com sucesso.
      </div>

      <div class="info-box">
        <div class="info-row">
          <span class="info-label">Espaço:</span>
          <span class="info-value">${salaNome} (${predio})</span>
        </div>
        <div class="info-row">
          <span class="info-label">Horário:</span>
          <span class="info-value">${dataExtenso} até às ${horaFim}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Capacidade planejada:</span>
          <span class="info-value">${pessoas} participantes</span>
        </div>
        ${titulo ? `<div class="info-row"><span class="info-label">Atividade:</span><span class="info-value">${titulo}</span></div>` : ''}
        ${descricao ? `<div class="info-row"><span class="info-label">Descrição:</span><span class="info-value">${descricao}</span></div>` : ''}
      </div>

      <div class="qr-section">
        <div class="qr-container">
          ${qrSvg}
        </div>
        <div class="qr-hint">
          <strong>Como validar a presença:</strong><br>
          No dia e horário da reserva, exiba este QR Code ou projete-o na sala para que os participantes escaneiem com a câmera do celular.
        </div>
        <div>
          <a href="${checkinUrl}" class="btn-action" target="_blank" rel="noopener">Link Direto de Check-in</a>
        </div>
      </div>

      <div class="alert">
        <strong>Importante:</strong> Para comprovar o uso efetivo da sala e evitar que a reserva seja marcada como <em>expirada</em> por falta de comparecimento, realize o check-in até 10 minutos após o início do horário.
      </div>
    </div>
    <div class="footer">
      CampusFlow &middot; Sistema de Gestão Inteligente de Espaços Acadêmicos<br>
      Este e-mail foi gerado automaticamente pela automação do sistema.
    </div>
  </div>
</body>
</html>`;
}

/**
 * Notifica o organizador sobre a reserva criada com o QR Code.
 * Desacoplado do banco de dados (grava na pasta outbox para ambiente local).
 */
export async function notificarReservaCriada({
  reservaId,
  usuario,
  sala,
  inicio,
  fim,
  pessoas,
  token,
  titulo,
  descricao,
}) {
  try {
    const frontendBase = process.env.FRONTEND_URL || 'http://localhost/CampusFlow/frontend';
    const checkinUrl = `${frontendBase}/pages/checkin.html?token=${encodeURIComponent(token)}`;
    const qrSvg = gerarQrCodeSvg(checkinUrl, { tamanho: 240 });

    const html = construirHtmlEmailConfirmacao({
      reservaId,
      usuarioNome: usuario.nome_completo || usuario.nome_usuario,
      salaNome: sala.nome,
      predio: sala.predio,
      inicio,
      fim,
      pessoas,
      titulo,
      descricao,
      checkinUrl,
      qrSvg,
    });

    // Garante que o diretório de outbox exista
    if (!fs.existsSync(OUTBOX_DIR)) {
      fs.mkdirSync(OUTBOX_DIR, { recursive: true });
    }

    const timestamp = Date.now();
    const nomeArquivoHtml = `email-reserva-${reservaId}-${timestamp}.html`;
    const caminhoHtml = path.join(OUTBOX_DIR, nomeArquivoHtml);

    const metadata = {
      reservaId,
      destinatario: {
        id: usuario.id,
        nome: usuario.nome_completo,
        email: usuario.email,
      },
      sala: { id: sala.id, nome: sala.nome, predio: sala.predio },
      inicio,
      fim,
      pessoas,
      token,
      checkinUrl,
      criadoEm: new Date().toISOString(),
      arquivoHtml: nomeArquivoHtml,
    };

    fs.writeFileSync(caminhoHtml, html, 'utf8');
    fs.writeFileSync(
      path.join(OUTBOX_DIR, `email-reserva-${reservaId}-${timestamp}.json`),
      JSON.stringify(metadata, null, 2),
      'utf8'
    );

    console.log(`[Notificação] E-mail com QR Code gerado para a Reserva #${reservaId}. Arquivo: outbox/${nomeArquivoHtml}`);

    return { sucesso: true, outboxPath: caminhoHtml, checkinUrl };
  } catch (erro) {
    console.error(`[Notificação] Falha ao gerar e-mail para a Reserva #${reservaId}:`, erro);
    return { sucesso: false, erro: erro.message };
  }
}
