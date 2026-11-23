/* Histórico real: apenas reservas da conta autenticada. */
(() => {
  'use strict';
  document.addEventListener('DOMContentLoaded', async () => {
    const api = window.CF_API, CF = window.CF, util = window.CF_RESERVAS;
    if (!api.read()) { location.replace('../index.html'); return; }
    const $ = (id) => document.getElementById(id);
    const list = $('bookingList'), search = $('reservationSearch'), status = $('statusFilter'), count = $('reservationCount');
    const error = $('historyError'), dialog = $('confirmDialog'), confirm = $('confirmAction');
    const qrModal = $('qrModal'), qrContent = $('qrModalContent'), qrStats = $('qrModalStats');
    const closeQr = $('closeQrModal'), copyBtn = $('copyCheckinLink');

    let records = [], pendingId = null, currentCheckinUrl = '';
    const safe = CF.safeText;

    function render() {
      const q = search.value.trim().toLocaleLowerCase('pt-BR');
      const filtered = records.filter((r) => [r.sala_nome, r.predio, r.titulo, r.descricao, r.id].join(' ').toLocaleLowerCase('pt-BR').includes(q) && (!status.value || r.status === status.value));
      count.textContent = `${filtered.length} ${filtered.length === 1 ? 'reserva encontrada' : 'reservas encontradas'}`;
      if (!filtered.length) {
        list.innerHTML = '<div class="empty-state"><span class="empty-icon" aria-hidden="true">▦</span><h2>Nenhuma reserva encontrada</h2><p>Faça uma reserva ou altere os filtros.</p><a class="btn btn-primary" href="reservar-sala.html">Nova reserva</a></div>';
        return;
      }
      list.innerHTML = filtered.map((r) => {
        const badge = r.status === 'confirmada' || r.status === 'em_uso' ? 'badge-green' : r.status === 'cancelada' || r.status === 'expirada' ? 'badge-red' : 'badge-neutral';
        const cancel = util.cancelarPermitido(r)
          ? `<button type="button" class="btn btn-danger btn-sm" data-cancelar-id="${Number(r.id)}">Cancelar reserva</button>`
          : '<span class="muted small">Sem cancelamento</span>';
        const qrBtn = (r.status === 'confirmada' || r.status === 'em_uso')
          ? `<button type="button" class="btn btn-outline btn-sm" data-qr-id="${Number(r.id)}" style="display:inline-flex;align-items:center;gap:4px;">▣ Ver QR Code</button>`
          : '';

        const presencaInfo = r.status === 'em_uso' || r.status === 'concluida'
          ? `<span>👥 ${Number(r.total_presentes || 0)} presentes de ${Number(r.qtd_pessoas)} estimados</span>`
          : `<span>♙ ${Number(r.qtd_pessoas)} participantes planejados</span>`;

        return `<article class="panel booking-record">
          <div class="booking-record-head">
            <div>
              <h2>${safe(r.sala_nome)}</h2>
              <span class="muted small">${safe(r.predio)}${r.titulo ? ` · ${safe(r.titulo)}` : ''}</span>
            </div>
            <span class="badge ${badge}">${safe(util.statusNomes[r.status] || r.status)}</span>
          </div>
          <div class="booking-record-meta">
            <span>▦ Início: ${safe(util.dataHora(r.inicio))}</span>
            <span>◷ Fim: ${safe(util.dataHora(r.fim))}</span>
            ${presencaInfo}
          </div>
          <div class="booking-record-actions">
            <span class="record-ref">Reserva #${Number(r.id)}</span>
            <div style="display:flex;gap:8px;align-items:center;">
              ${qrBtn}
              ${cancel}
            </div>
          </div>
        </article>`;
      }).join('');

      list.querySelectorAll('[data-cancelar-id]').forEach((btn) => btn.addEventListener('click', () => {
        pendingId = Number(btn.dataset.cancelarId);
        dialog.showModal();
      }));

      list.querySelectorAll('[data-qr-id]').forEach((btn) => btn.addEventListener('click', async () => {
        const id = Number(btn.dataset.qrId);
        btn.disabled = true;
        try {
          qrContent.innerHTML = '<p class="muted">Carregando QR Code…</p>';
          qrStats.innerHTML = '';
          qrModal.showModal();
          const info = await api.obterQrCode(id);
          currentCheckinUrl = info.checkin_url;
          qrContent.innerHTML = `<div style="background:#fff;padding:12px;border-radius:8px;border:1px solid #e2e8f0;display:inline-block;">${info.qr_svg}</div>`;
          qrStats.innerHTML = `
            <div><span>Sala:</span><strong>${safe(info.sala.nome)} (${safe(info.sala.predio)})</strong></div>
            <div><span>Período:</span><strong>${safe(util.dataHora(info.inicio))} às ${safe(util.dataHora(info.fim))}</strong></div>
            <div><span>Presentes confirmados:</span><strong>${info.participantes_presentes} de ${info.participantes_estimados} previstos (${info.taxa_presenca_estimada_percentual ?? 0}% da estimativa)</strong></div>
            <div><span>Situação:</span><strong style="text-transform:capitalize;">${safe(info.status)}</strong></div>
          `;
        } catch (err) {
          qrContent.innerHTML = `<p class="form-error">${safe(err.message)}</p>`;
        } finally {
          btn.disabled = false;
        }
      }));
    }

    async function carregar() {
      error.hidden = true; count.textContent = 'Carregando reservas…';
      try {
        records = await api.minhasReservas();
        if (!Array.isArray(records)) throw new Error('Formato do histórico inválido.');
        render();
      } catch (err) {
        error.hidden = false; error.textContent = err.message; count.textContent = 'Falha ao carregar reservas'; list.textContent = '';
        if (err.status === 401) location.replace('../index.html');
      }
    }

    $('dismissAction').addEventListener('click', () => { pendingId = null; dialog.close(); });
    dialog.addEventListener('close', () => { pendingId = null; });
    confirm.addEventListener('click', async () => {
      const id = pendingId;
      if (!id) return;
      confirm.disabled = true;
      try {
        await api.cancelarReserva(id);
        dialog.close();
        CF.toast(`Reserva #${id} cancelada.`);
        await carregar();
      } catch (err) {
        dialog.close();
        CF.toast(err.message, 'error');
        await carregar();
        if (err.status === 401) location.replace('../index.html');
      } finally {
        confirm.disabled = false;
      }
    });

    closeQr?.addEventListener('click', () => qrModal.close());
    copyBtn?.addEventListener('click', async () => {
      if (!currentCheckinUrl) return;
      try {
        await navigator.clipboard.writeText(currentCheckinUrl);
        CF.toast('Link de check-in copiado para a área de transferência!');
      } catch {
        prompt('Copie o link abaixo:', currentCheckinUrl);
      }
    });

    search.addEventListener('input', render);
    status.addEventListener('change', render);
    $('refreshBookings').addEventListener('click', carregar);

    try {
      const user = await api.me();
      CF.setupShell(user);
      await carregar();
    } catch (err) {
      error.hidden = false; error.textContent = err.message;
      if (err.status === 401) location.replace('../index.html');
    }
  });
})();
