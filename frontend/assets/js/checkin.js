/* Validação de Presença por QR Code — CampusFlow
 * Suporta check-in sem login (câmera do celular, QR direto) e com login.
 */
(() => {
  'use strict';
  document.addEventListener('DOMContentLoaded', async () => {
    const api = window.CF_API;
    const CF = window.CF;
    const util = window.CF_RESERVAS;
    const $ = (id) => document.getElementById(id);

    const loadingState       = $('loadingState');
    const readyToConfirm     = $('readyToConfirm');
    const successState       = $('successState');
    const errorState         = $('errorState');
    const manualState        = $('manualState');

    const userInfoText       = $('userInfoText');
    const nomeAnonBox        = $('nomeAnonBox');
    const nomeAnonInput      = $('nomeAnonInput');
    const btnConfirmarPresenca = $('btnConfirmarPresenca');
    const successTitle       = $('successTitle');
    const successSubtitle    = $('successSubtitle');
    const attendeesCount     = $('attendeesCount');
    const successDetails     = $('successDetails');
    const errorMessage       = $('errorMessage');
    const btnTentarNovamente = $('btnTentarNovamente');
    const manualToken        = $('manualToken');
    const btnValidarManual   = $('btnValidarManual');
    const btnIniciarCamera   = $('btnIniciarCamera');
    const scannerContainer   = $('scannerContainer');
    const scannerVideo       = $('scannerVideo');

    const params = new URLSearchParams(window.location.search);
    const token = params.get('token')?.trim() || '';

    // ID anônimo persistente para evitar presenças duplicadas sem login
    let anonId = sessionStorage.getItem('campusflow.anon_id');
    if (!anonId) {
      anonId = Array.from(crypto.getRandomValues(new Uint8Array(16))).map(b => b.toString(16).padStart(2, '0')).join('');
      sessionStorage.setItem('campusflow.anon_id', anonId);
    }

    function exibirPainel(painelAtivo) {
      [loadingState, readyToConfirm, successState, errorState, manualState].forEach((p) => {
        if (p) p.hidden = p !== painelAtivo;
      });
    }

    // Tenta identificar o usuário logado (opcional, não bloqueia o fluxo)
    let currentUser = null;
    try {
      const session = api.read();
      if (session) {
        currentUser = await api.me().catch(() => null);
        if (currentUser && CF.setupShell) {
          try { CF.setupShell(currentUser); } catch {}
        }
      }
    } catch {}

    // -----------------------------------------------------------------------
    // Fluxo com token na URL (escanear pelo celular abre direto neste estado)
    // -----------------------------------------------------------------------
    if (token) {
      if (currentUser) {
        userInfoText.textContent = `Identificado como: ${currentUser.nome_completo || currentUser.nome_usuario} (${currentUser.email})`;
        nomeAnonBox.hidden = true;
      } else {
        userInfoText.textContent = 'Você não está logado. Sua presença será registrada de forma anônima.';
        nomeAnonBox.hidden = false;
      }
      exibirPainel(readyToConfirm);

    // -----------------------------------------------------------------------
    // Fluxo sem token: exibe scanner
    // -----------------------------------------------------------------------
    } else {
      exibirPainel(manualState);
      configurarScanner();
    }

    // -----------------------------------------------------------------------
    // Execução do Check-in (autenticado ou anônimo)
    // -----------------------------------------------------------------------
    async function executarCheckin(tokenAValidar) {
      exibirPainel(loadingState);
      try {
        const nome = nomeAnonInput?.value?.trim() || undefined;
        const resposta = await api.checkin(tokenAValidar, { anonId, nome });
        exibirSucesso(resposta);
      } catch (err) {
        exibirErro(err.message || 'Falha ao registrar presença.');
      }
    }

    function exibirSucesso(resposta) {
      const r = resposta.reserva;
      successTitle.textContent = resposta.mensagem || 'Presença Confirmada!';
      successSubtitle.textContent = `Sala: ${r.sala_nome} (${r.predio})`;

      const presentes = Number(r.participantes_presentes ?? 1);
      const estimados = Number(r.participantes_estimados ?? 0);

      attendeesCount.textContent = `${presentes} participante${presentes === 1 ? '' : 's'} presente${presentes === 1 ? '' : 's'}`;

      const taxaPresenca = r.taxa_aproveitamento_estimado_percentual != null
        ? `${r.taxa_aproveitamento_estimado_percentual}% da estimativa`
        : 'Estimativa não informada';

      const taxaOcupacao = r.taxa_ocupacao_sala_percentual != null
        ? `${r.taxa_ocupacao_sala_percentual}% da capacidade da sala`
        : '';

      successDetails.innerHTML = `
        <div><span>Espaço:</span><strong>${CF.safeText(r.sala_nome)} &middot; ${CF.safeText(r.predio)}</strong></div>
        <div><span>Horário:</span><strong>${CF.safeText(util?.dataHora?.(r.inicio) || r.inicio)} às ${CF.safeText(util?.dataHora?.(r.fim) || r.fim)}</strong></div>
        <div><span>Participantes presentes:</span><strong>${presentes} de ${estimados} previstos (${taxaPresenca})</strong></div>
        ${taxaOcupacao ? `<div><span>Ocupação da sala:</span><strong>${taxaOcupacao}</strong></div>` : ''}
        <div><span>Situação:</span><strong style="color:#16a34a;text-transform:uppercase;">Em uso (Confirmada)</strong></div>
        ${!resposta.autenticado ? `<div><span>Registrado como:</span><strong>${CF.safeText(resposta.participante?.nome || 'Anônimo')}</strong></div>` : ''}
      `;

      exibirPainel(successState);
      if (CF.toast) CF.toast('Presença registrada com sucesso!', 'success');
    }

    function exibirErro(msg) {
      errorMessage.textContent = msg;
      exibirPainel(errorState);
    }

    btnConfirmarPresenca?.addEventListener('click', () => executarCheckin(token));

    btnTentarNovamente?.addEventListener('click', () => {
      if (token) executarCheckin(token);
      else { exibirPainel(manualState); configurarScanner(); }
    });

    btnValidarManual?.addEventListener('click', () => {
      const t = manualToken?.value?.trim();
      if (!t) { if (CF.toast) CF.toast('Digite ou cole o código do token.', 'error'); return; }
      executarCheckin(t);
    });

    // -----------------------------------------------------------------------
    // Scanner de câmera com BarcodeDetector (Chrome/Edge/Android) + fallback
    // -----------------------------------------------------------------------
    let streamAtivo = null;
    let intervaloDetector = null;

    function pararCamera() {
      if (intervaloDetector) { clearInterval(intervaloDetector); intervaloDetector = null; }
      if (streamAtivo) { streamAtivo.getTracks().forEach((t) => t.stop()); streamAtivo = null; }
      if (scannerContainer) scannerContainer.hidden = true;
      if (btnIniciarCamera) btnIniciarCamera.textContent = '📷 Abrir Câmera para Escanear';
    }

    function configurarScanner() {
      if (!btnIniciarCamera) return;

      btnIniciarCamera.addEventListener('click', async () => {
        if (streamAtivo) { pararCamera(); return; }

        try {
          if (!navigator.mediaDevices?.getUserMedia) {
            throw new Error('Câmera não suportada neste navegador. Use Chrome ou Safari atualizados.');
          }

          streamAtivo = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
          });

          scannerContainer.hidden = false;
          btnIniciarCamera.textContent = '⏹ Parar Câmera';
          scannerVideo.srcObject = streamAtivo;
          await scannerVideo.play();

          if ('BarcodeDetector' in window) {
            const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
            intervaloDetector = setInterval(async () => {
              if (!streamAtivo) { clearInterval(intervaloDetector); return; }
              try {
                const barcodes = await detector.detect(scannerVideo);
                if (barcodes.length > 0) {
                  const valor = barcodes[0].rawValue;
                  pararCamera();

                  // Extrai token do URL se o QR aponta para a página de check-in
                  try {
                    const url = new URL(valor);
                    const qToken = url.searchParams.get('token');
                    if (qToken) {
                      // Preenche o campo de nome antes de confirmar, se não estiver logado
                      if (!currentUser) {
                        nomeAnonBox.hidden = false;
                        userInfoText.textContent = 'QR Code lido com sucesso! Confirme sua presença abaixo.';
                      }
                      exibirPainel(readyToConfirm);
                      // Redireciona para a URL completa para garantir que o fluxo completo seja executado
                      window.history.replaceState({}, '', `?token=${encodeURIComponent(qToken)}`);
                      btnConfirmarPresenca.onclick = () => executarCheckin(qToken);
                      return;
                    }
                  } catch {}

                  // Token puro escaneado
                  executarCheckin(valor);
                }
              } catch {}
            }, 400);
          } else {
            // Fallback para navegadores sem BarcodeDetector
            if (CF?.toast) CF.toast('Câmera ativa! Aponte para o QR Code. Se não detectar automaticamente, cole o token abaixo.', 'info');
          }
        } catch (err) {
          pararCamera();
          if (CF?.toast) CF.toast(err.message, 'error');
        }
      }, { once: false });
    }
  });
})();
