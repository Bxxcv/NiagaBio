// STAGE23/24: Lacak pesanan tanpa akun. Verifikasi ringan pakai
// order_group_id + no. WhatsApp pembeli. Lihat get_order_group_tracking di
// migration 36 - RPC ini SENGAJA tidak mengembalikan data finansial
// internal seller (seller_earning/platform_earning/gateway_fee).
//
// STAGE24 (revisi dari feedback Rid):
// - Auto-refresh (polling tiap 8 detik) selama halaman terbuka, jadi status
//   berubah tanpa perlu reload manual.
// - Nomor WhatsApp yang berhasil dipakai disimpan di localStorage (per
//   order_group_id), jadi buka link tracking lagi / reload tidak perlu
//   ngetik nomor WA ulang.
// - Status pakai warna jelas (kuning/biru/hijau/merah), bukan cuma dot abu².
//
// Catatan sengaja: kita TIDAK pakai Supabase Realtime (postgres_changes)
// untuk ini. RLS `orders` memang sengaja tidak membuka SELECT ke anon (biar
// data finansial seller tidak bocor), jadi realtime native untuk anon juga
// akan diblok RLS dan tidak berguna. Polling ulang RPC yang sudah aman ini
// jauh lebih simpel & tidak menambah permukaan akses baru.
document.addEventListener('DOMContentLoaded', () => {
  const root = document.getElementById('trackRoot');
  const params = new URLSearchParams(location.search);
  const prefillOrder = params.get('order') || '';
  const POLL_MS = 8000;
  let pollTimer = null;
  let currentOrderId = '';
  let currentPhone = '';

  const ORDER_STATUS_META = {
    pending: { text: 'Pesanan Diterima', icon: 'bi-receipt', step: 0, tone: 'warning' },
    processing: { text: 'Sedang Diproses', icon: 'bi-gear-fill', step: 1, tone: 'warning' },
    ready: { text: 'Siap Dikirim / Diambil', icon: 'bi-box-seam-fill', step: 2, tone: 'info' },
    completed: { text: 'Selesai', icon: 'bi-check-circle-fill', step: 3, tone: 'success' },
    cancelled: { text: 'Dibatalkan', icon: 'bi-x-circle-fill', step: -1, tone: 'danger' }
  };
  const PAYMENT_STATUS_LABEL = {
    pending: 'Menunggu Pembayaran',
    paid: 'Sudah Dibayar',
    cancelled: 'Dibatalkan'
  };
  const STEP_LABELS = ['Diterima', 'Diproses', 'Siap', 'Selesai'];

  function money(value) {
    return NB.money(Math.max(0, Number(value || 0)));
  }

  function rememberKey(orderId) {
    return `nb_track_${orderId}`;
  }

  function rememberPhone(orderId, phone) {
    try { localStorage.setItem(rememberKey(orderId), phone); } catch (_) { /* noop */ }
  }

  function recallPhone(orderId) {
    try { return localStorage.getItem(rememberKey(orderId)) || ''; } catch (_) { return ''; }
  }

  function clearPolling() {
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = null;
  }

  function renderForm(message) {
    clearPolling();
    root.innerHTML = `
      <div class="checkout-backbar">
        <span><i class="bi bi-truck me-1"></i>Lacak Pesanan NiagaBio</span>
      </div>
      <section class="checkout-grid" style="grid-template-columns:1fr;max-width:520px;margin:0 auto;">
        <section class="checkout-form-card card-nb">
          <div class="checkout-head"><div><p class="eyebrow mb-2">Lacak Pesanan</p><h2>Cek status pesanan kamu</h2><p>Masukkan Order ID (dari link konfirmasi) dan nomor WhatsApp yang dipakai saat checkout.</p></div></div>
          ${message ? `<div class="checkout-note checkout-note--danger"><i class="bi bi-exclamation-triangle"></i><div>${NB.escapeHtml(message)}</div></div>` : ''}
          <form id="trackForm" class="checkout-form">
            <div class="row g-3">
              <div class="col-12"><label class="form-label">Order ID</label><input id="orderIdInput" class="form-control" placeholder="cth. 3f1b9c2a-..." value="${NB.escapeHtml(prefillOrder)}" required></div>
              <div class="col-12"><label class="form-label">No. WhatsApp saat checkout</label><input id="phoneInput" class="form-control" inputmode="tel" placeholder="08xxxxxxxxxx" value="${NB.escapeHtml(recallPhone(prefillOrder))}" required></div>
            </div>
            <div class="checkout-actions"><button class="nb-btn nb-btn--commerce" type="submit"><i class="bi bi-search me-1"></i>Lacak Pesanan</button></div>
          </form>
        </section>
      </section>
    `;

    document.getElementById('trackForm').addEventListener('submit', async event => {
      event.preventDefault();
      const button = event.target.querySelector('button[type="submit"]');
      const orderId = document.getElementById('orderIdInput').value.trim();
      const phone = document.getElementById('phoneInput').value.trim();
      button.disabled = true;
      button.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Mencari…';
      try {
        const rows = await NB.getOrderGroupTracking(orderId, phone);
        if (!rows.length) throw new Error('Order tidak ditemukan atau nomor WhatsApp tidak cocok.');
        rememberPhone(orderId, phone);
        currentOrderId = orderId;
        currentPhone = phone;
        renderResult(rows);
        startPolling();
      } catch (error) {
        renderForm(error.message || 'Order tidak ditemukan atau nomor WhatsApp tidak cocok.');
      }
    });

    // Auto-submit kalau order id dari URL + nomor WA sudah pernah diingat
    // di device ini (lihat rememberPhone) - buyer tidak perlu ngetik ulang.
    if (prefillOrder && recallPhone(prefillOrder)) {
      document.getElementById('trackForm').requestSubmit();
    }
  }

  function statusBadgeTop(meta) {
    return `<span class="nb-track-toplabel nb-track-toplabel--${meta.tone}"><i class="bi ${meta.icon} me-1"></i>${meta.text}</span>`;
  }

  function statusStepper(orderStatus) {
    const current = ORDER_STATUS_META[orderStatus] || ORDER_STATUS_META.pending;
    if (current.step === -1) {
      return `<div class="nb-track-cancelled"><i class="bi bi-x-circle-fill"></i> Pesanan dibatalkan</div>`;
    }
    return `
      <div class="nb-track-steps">
        ${STEP_LABELS.map((label, index) => `
          <div class="nb-track-step ${index <= current.step ? 'is-done' : ''} ${index === current.step ? 'is-current' : ''}">
            <span class="nb-track-dot"></span>
            <span class="nb-track-step-label">${label}</span>
          </div>
        `).join('')}
      </div>
    `;
  }

  function renderResult(rows, isRefresh) {
    lastSignature = statusSignature(rows);
    const first = rows[0];
    const productSubtotal = rows.reduce((sum, row) => sum + Number(row.total_price || 0), 0);
    const platformFee = rows.reduce((sum, row) => sum + Number(row.platform_fee || 0), 0);
    const withdrawalReserve = rows.reduce((sum, row) => sum + Number(row.withdrawal_reserve || 0), 0);
    const grandTotal = productSubtotal + platformFee + withdrawalReserve;
    const paymentLabel = PAYMENT_STATUS_LABEL[first.payment_status] || first.payment_status;

    root.innerHTML = `
      <div class="checkout-backbar">
        <button type="button" class="nb-btn nb-btn--outline" id="trackAgainBtn"><i class="bi bi-arrow-left me-1"></i>Lacak Order Lain</button>
        <span><i class="bi bi-shop me-1"></i>${NB.escapeHtml(first.seller_display_name || first.seller_username || 'Toko NiagaBio')}</span>
      </div>
      <section class="checkout-grid" style="grid-template-columns:1fr;max-width:640px;margin:0 auto;">
        <section class="checkout-form-card card-nb">
          <div class="checkout-head"><div><p class="eyebrow mb-2">Status Pesanan</p><h2>Pembayaran: ${NB.escapeHtml(paymentLabel)}</h2><p class="nb-track-refresh-note"><i class="bi bi-arrow-repeat me-1"></i>Halaman ini otomatis memperbarui status tiap ${POLL_MS / 1000} detik.</p></div></div>
          ${rows.map(row => {
            const meta = ORDER_STATUS_META[row.order_status] || ORDER_STATUS_META.pending;
            return `
            <div class="nb-track-item-block">
              <div class="checkout-price-line"><span>${NB.escapeHtml(row.product_name)} x${row.quantity}</span><strong>${money(row.total_price)}</strong></div>
              ${statusBadgeTop(meta)}
              ${statusStepper(row.order_status)}
            </div>
          `;
          }).join('')}
          <div class="checkout-price-line"><span>Biaya layanan NiagaBio</span><strong>${money(platformFee)}</strong></div>
          <div class="checkout-price-line"><span>Cadangan withdrawal</span><strong>${money(withdrawalReserve)}</strong></div>
          <div class="checkout-price-line total-line"><span>Total</span><strong>${money(grandTotal)}</strong></div>
        </section>
      </section>
    `;

    document.getElementById('trackAgainBtn').addEventListener('click', () => renderForm());
  }

  function statusSignature(rows) {
    return rows.map(row => `${row.order_id}:${row.payment_status}:${row.order_status}`).join('|');
  }

  let lastSignature = '';

  function startPolling() {
    clearPolling();
    pollTimer = setInterval(async () => {
      try {
        const rows = await NB.getOrderGroupTracking(currentOrderId, currentPhone);
        if (!rows.length) return;
        const signature = statusSignature(rows);
        if (signature === lastSignature) return; // tidak ada perubahan -> jangan render ulang (hindari flicker)
        renderResult(rows, true);
      } catch (_) {
        // Diamkan kalau polling gagal sesekali (network blip) - jangan
        // ganggu tampilan yang sudah ada, coba lagi di interval berikutnya.
      }
    }, POLL_MS);
  }

  renderForm();
});
