/* Validação de Presença por QR Code - CampusFlow */
(() => {
  'use strict';
  document.addEventListener('DOMContentLoaded', async () => {
    const api = window.CF_API, CF = window.CF, util = window.CF_RESERVAS;
    const $ = (id) => document.getElementById(id);

    const loadingState = $('loadingState');
    const unauthWarning = $('unauthWarning');
    const readyToConfirm = $('readyToConfirm');
    const successState = $('successState');
    const errorState = $('errorState');
    const manualState = $('manualState');

    const userInfoText = $('userInfoText');
    const btnConfirmarPresenca = $('btnConfirmarPresenca');
    const successTitle = $('successTitle');
    const successSubtitle = $('successSubtitle');
    const attendeesCount = $('attendeesCount');
    const successDetails = $('successDetails');
    const errorMessage = $('errorMessage');
    const btnTentarNovamente = $('btnTentarNovamente');

    const manualToken = $('manualToken');
    const btnValidarManual = $('btnValidarManual');
    const btnIniciarCamera = $('btnIniciarCamera');
    const scannerContainer = $('scannerContainer');
    const scannerVideo = $('scannerVideo');

    const params = new URLSearchParams(window.location.search);
    const token = params.get('token')?.trim() || '';

    function exibirPainel(painelAtivo) {
      [loadingState, unauthWarning, readyToConfirm, successState, errorState, manualState].forEach((p) => {
        if (p) p.hidden = p !== painelAtivo;
      });
    }

    const session = api.read();

    if (!session) {
      sessionStorage.setItem('campusflow.post_login_redirect', window.location.href);
      exibirPainel(unauthWarning);
      return;
    }

    let currentUser = null;
    try {
      currentUser = await api.me();
      CF.setupShell(currentUser);
    } catch {
      sessionStorage.setItem('campusflow.post_login_redirect', window.location.href);
      exibirPainel(unauthWarning);
      return;
    }

    if (!token) {
      exibirPainel(manualState);
      configurarLeitorManual();
      return;
    }

    userInfoText.textContent = `Identificado como: ${currentUser.nome_completo || currentUser.nome_usuario} (${currentUser.email})`;
    exibirPainel(readyToConfirm);

    async function executarCheckin(tokenAValidar) {
      exibirPainel(loadingState);
      try {
        const resposta = await api.checkin(tokenAValidar);
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
      const capacidade = Number(r.capacidade ?? 0);

      attendeesCount.textContent = `${presentes} participante${presentes === 1 ? '' : 's'} presente${presentes === 1 ? '' : 's'}`;

      const taxaPresenca = r.taxa_aproveitamento_estimado_percentual != null
        ? `${r.taxa_aproveitamento_estimado_percentual}% da estimativa`
        : 'Estimativa não informada';

      const taxaOcupacao = r.taxa_ocupacao_sala_percentual != null
        ? `${r.taxa_ocupacao_sala_percentual}% da capacidade da sala`
        : '';

      successDetails.innerHTML = `
        <div><span>Espaço:</span><strong>${CF.safeText(r.sala_nome)} &middot; ${CF.safeText(r.predio)}</strong></div>
        <div><span>Horário:</span><strong>${CF.safeText(util.dataHora(r.inicio))} às ${CF.safeText(util.dataHora(r.fim))}</strong></div>
        <div><span>Participantes presentes:</span><strong>${presentes} de ${estimados} previstos (${taxaPresenca})</strong></div>
        ${capacidade > 0 ? `<div><span>Ocupação da sala:</span><strong>${taxaOcupacao} (${capacidade} lugares totais)</strong></div>` : ''}
        <div><span>Situação da sala:</span><strong style="color:#16a34a;text-transform:uppercase;">Em uso (Confirmada)</strong></div>
      `;

      exibirPainel(successState);
      CF.toast('Presença registrada com sucesso!', 'success');
    }

    function exibirErro(msg) {
      errorMessage.textContent = msg;
      exibirPainel(errorState);
    }

    btnConfirmarPresenca.addEventListener('click', () => {
      executarCheckin(token);
    });

    btnTentarNovamente.addEventListener('click', () => {
      if (token) executarCheckin(token);
      else exibirPainel(manualState);
    });

    function configurarLeitorManual() {
      btnValidarManual.addEventListener('click', () => {
        const t = manualToken.value.trim();
        if (!t) {
          CF.toast('Digite ou cole o código do token.', 'error');
          return;
        }
        executarCheckin(t);
      });

      let streamAtivo = null;

      btnIniciarCamera.addEventListener('click', async () => {
        if (streamAtivo) {
          streamAtivo.getTracks().forEach((t) => t.stop());
          streamAtivo = null;
          scannerContainer.hidden = true;
          btnIniciarCamera.textContent = 'Abrir Câmera para Escanear';
          return;
        }

        try {
          if (!('mediaDevices' in navigator) || !navigator.mediaDevices.getUserMedia) {
            throw new Error('Acesso à câmera não suportado neste navegador.');
          }

          scannerContainer.hidden = false;
          btnIniciarCamera.textContent = 'Parar Câmera';
          streamAtivo = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment' },
          });
          scannerVideo.srcObject = streamAtivo;
          await scannerVideo.play();

          if ('BarcodeDetector' in window) {
            const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
            const intervalo = setInterval(async () => {
              if (!streamAtivo) { clearInterval(intervalo); return; }
              try {
                const barcodes = await detector.detect(scannerVideo);
                if (barcodes.length > 0) {
                  const valor = barcodes[0].rawValue;
                  clearInterval(intervalo);
                  streamAtivo.getTracks().forEach((t) => t.stop());
                  streamAtivo = null;
                  scannerContainer.hidden = true;

                  try {
                    const url = new URL(valor);
                    const qToken = url.searchParams.get('token');
                    if (qToken) {
                      executarCheckin(qToken);
                      return;
                    }
                  } catch {}

                  executarCheckin(valor);
                }
              } catch {}
            }, 300);
          } else {
            CF.toast('Câmera ativa. Aponte para o QR Code ou cole o token se seu navegador não suportar detecção nativa.');
          }
        } catch (err) {
          scannerContainer.hidden = true;
          CF.toast(err.message, 'error');
        }
      });
    }
  });
})();
