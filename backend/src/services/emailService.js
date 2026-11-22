import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import tls from 'node:tls';
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
 * Cliente SMTP nativo em Node.js (sem dependências externas)
 * Suporta STARTTLS (porta 587), SSL direto (porta 465) e autenticação AUTH LOGIN.
 */
function enviarEmailSmtp({ host, port = 587, secure = false, user, pass, from, to, subject, html }) {
  return new Promise((resolve, reject) => {
    let socket;
    let stage = 'INIT';
    let respostaBuffer = '';

    const timeoutTimer = setTimeout(() => {
      if (socket) socket.destroy();
      reject(new Error(`Timeout na comunicação SMTP com ${host}:${port}`));
    }, 20000);

    function cleanup() {
      clearTimeout(timeoutTimer);
      if (socket && !socket.destroyed) socket.end();
    }

    function sendCommand(cmd) {
      if (socket && !socket.destroyed) {
        socket.write(`${cmd}\r\n`);
      }
    }

    function handleData(chunk) {
      respostaBuffer += chunk.toString('utf8');
      const linhas = respostaBuffer.split(/\r?\n/);
      respostaBuffer = linhas.pop() || '';

      for (const linha of linhas) {
        if (!linha.trim()) continue;
        const codigo = parseInt(linha.slice(0, 3), 10);
        const ehContinuacao = linha.charAt(3) === '-';
        if (ehContinuacao) continue;

        processarResposta(codigo, linha);
      }
    }

    function processarResposta(codigo, linha) {
      if (codigo >= 400) {
        cleanup();
        return reject(new Error(`Erro SMTP no estágio [${stage}]: ${linha}`));
      }

      switch (stage) {
        case 'INIT':
          if (codigo === 220) {
            stage = 'EHLO';
            sendCommand('EHLO localhost');
          }
          break;

        case 'EHLO':
          if (codigo === 250) {
            if (!secure && port === 587) {
              stage = 'STARTTLS';
              sendCommand('STARTTLS');
            } else if (user && pass) {
              stage = 'AUTH_LOGIN';
              sendCommand('AUTH LOGIN');
            } else {
              stage = 'MAIL_FROM';
              sendCommand(`MAIL FROM:<${from}>`);
            }
          }
          break;

        case 'STARTTLS':
          if (codigo === 220) {
            socket.removeAllListeners('data');
            const tlsSocket = tls.connect({
              socket,
              host,
              servername: host,
              rejectUnauthorized: false,
            });
            socket = tlsSocket;
            socket.on('data', handleData);
            socket.on('error', (err) => { cleanup(); reject(err); });

            stage = 'EHLO_AFTER_TLS';
            sendCommand('EHLO localhost');
          }
          break;

        case 'EHLO_AFTER_TLS':
          if (codigo === 250) {
            if (user && pass) {
              stage = 'AUTH_LOGIN';
              sendCommand('AUTH LOGIN');
            } else {
              stage = 'MAIL_FROM';
              sendCommand(`MAIL FROM:<${from}>`);
            }
          }
          break;

        case 'AUTH_LOGIN':
          if (codigo === 334) {
            stage = 'AUTH_USER';
            sendCommand(Buffer.from(user).toString('base64'));
          }
          break;

        case 'AUTH_USER':
          if (codigo === 334) {
            stage = 'AUTH_PASS';
            sendCommand(Buffer.from(pass).toString('base64'));
          }
          break;

        case 'AUTH_PASS':
          if (codigo === 235 || codigo === 250) {
            stage = 'MAIL_FROM';
            sendCommand(`MAIL FROM:<${from}>`);
          }
          break;

        case 'MAIL_FROM':
          if (codigo === 250) {
            stage = 'RCPT_TO';
            sendCommand(`RCPT TO:<${to}>`);
          }
          break;

        case 'RCPT_TO':
          if (codigo === 250) {
            stage = 'DATA';
            sendCommand('DATA');
          }
          break;

        case 'DATA':
          if (codigo === 354) {
            stage = 'SEND_BODY';
            const encodedSubject = `=?UTF-8?B?${Buffer.from(subject, 'utf8').toString('base64')}?=`;
            const mime = [
              `From: ${from}`,
              `To: ${to}`,
              `Subject: ${encodedSubject}`,
              'MIME-Version: 1.0',
              'Content-Type: text/html; charset=UTF-8',
              'Content-Transfer-Encoding: 8bit',
              `Date: ${new Date().toUTCString()}`,
              '',
              html,
              '',
              '.',
            ].join('\r\n');

            sendCommand(mime);
          }
          break;

        case 'SEND_BODY':
          if (codigo === 250) {
            stage = 'QUIT';
            sendCommand('QUIT');
            cleanup();
            resolve({ sucesso: true });
          }
          break;

        default:
          break;
      }
    }

    try {
      if (secure || port === 465) {
        socket = tls.connect({ host, port, servername: host, rejectUnauthorized: false });
      } else {
        socket = net.connect({ host, port });
      }

      socket.on('data', handleData);
      socket.on('error', (err) => { cleanup(); reject(err); });
    } catch (err) {
      cleanup();
      reject(err);
    }
  });
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
    .header h1 { margin: 0 0 6px 0; font-size: 24px; font-weight: 700; letter-spacing: -0.5px; }
    .header p { margin: 0; font-size: 14px; opacity: 0.9; }
    .content { padding: 28px 24px; }
    .greeting { font-size: 16px; margin-bottom: 20px; line-height: 1.5; }
    .info-box { background: #f8fafc; border-left: 4px solid #2563eb; padding: 18px; border-radius: 6px; margin-bottom: 24px; }
    .info-row { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 14px; }
    .info-row:last-child { margin-bottom: 0; }
    .info-label { color: #64748b; font-weight: 500; }
    .info-value { color: #0f172a; font-weight: 600; text-align: right; }
    .qr-section { text-align: center; background: #ffffff; border: 2px dashed #cbd5e1; border-radius: 12px; padding: 24px; margin: 24px 0; }
    .qr-container { display: inline-block; padding: 12px; background: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.06); }
    .qr-hint { font-size: 13px; color: #475569; margin-top: 14px; line-height: 1.5; }
    .btn-action { display: inline-block; background: #2563eb; color: #ffffff !important; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; font-size: 15px; margin-top: 14px; }
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
        <div style="margin-top: 16px;">
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
 * Envia o e-mail real via SMTP (se configurado no .env) e grava cópia na pasta outbox para desenvolvimento.
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

    // 1. Grava na pasta outbox local para histórico e desenvolvimento
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

    console.log(`[Notificação] E-mail com QR Code gerado para Reserva #${reservaId}. Arquivo local: outbox/${nomeArquivoHtml}`);

    // 2. Envio REAL por SMTP caso configurado no .env
    const smtpHost = process.env.SMTP_HOST;
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;

    if (smtpHost && smtpUser && smtpPass && usuario.email) {
      console.log(`[Notificação] Enviando e-mail real para ${usuario.email} via SMTP (${smtpHost})...`);
      try {
        await enviarEmailSmtp({
          host: smtpHost,
          port: Number(process.env.SMTP_PORT || 587),
          secure: process.env.SMTP_SECURE === 'true',
          user: smtpUser,
          pass: smtpPass,
          from: process.env.SMTP_FROM || `"CampusFlow" <${smtpUser}>`,
          to: usuario.email,
          subject: `Confirmação de Reserva #${reservaId} (${sala.nome}) - CampusFlow`,
          html,
        });
        console.log(`[Notificação] ✓ E-mail entregue com sucesso para ${usuario.email}!`);
      } catch (smtpErr) {
        console.error(`[Notificação] ✗ Falha ao enviar e-mail via SMTP para ${usuario.email}:`, smtpErr.message);
      }
    } else {
      console.log(`[Notificação] ℹ Variáveis SMTP (SMTP_HOST, SMTP_USER, SMTP_PASS) não configuradas no .env. E-mail salvo apenas na pasta outbox/.`);
    }

    return { sucesso: true, outboxPath: caminhoHtml, checkinUrl };
  } catch (erro) {
    console.error(`[Notificação] Falha ao processar notificação da Reserva #${reservaId}:`, erro);
    return { sucesso: false, erro: erro.message };
  }
}
