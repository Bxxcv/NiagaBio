// STAGE23: Lacak pesanan tanpa akun. Verifikasi ringan pakai
// order_group_id (dari link otomatis setelah checkout, atau diketik manual)
// + no. WhatsApp pembeli. Lihat get_order_group_tracking di migration 36 -
// RPC ini SENGAJA tidak mengembalikan data finansial internal seller
// (seller_earning/platform_earning/gateway_fee).
document.addEventListener('DOMContentLoaded', () => {
  const root = document.getElementById('trackRoot');
  const params = new URLSearchParams(location.search);
  const prefillOrder = params.get('order') || '';

  const ORDER_STATUS_LABEL = {
    pending: { text: 'Pesanan Diterima', icon: 'bi-receipt', step: 0 },
    processing: { text: 'Sedang Diproses', icon: 'bi-gear-fill', step: 1 },
    ready: { text: 'Siap Dikirim / Diambil', icon: 'bi-box-seam-fill', step: 2 },
    completed: { text: 'Selesai', icon: 'bi-check-circle-fill', step: 3 },
    cancelled: { text: 'Dibatalkan', icon: 'bi-x-circle-fill', step: -1 }
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

  function renderForm(message) {
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
              <div class="col-12"><label class="form-label">No. WhatsApp saat checkout</label><input id="phoneInput" class="form-control" inputmode="tel" placeholder="08xxxxxxxxxx" required></div>
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
        renderResult(rows);
      } catch (error) {
        renderForm(error.message || 'Order tidak ditemukan atau nomor WhatsApp tidak cocok.');
      }
    });
  }

  function statusStepper(orderStatus) {
    const current = ORDER_STATUS_LABEL[orderStatus] || ORDER_STATUS_LABEL.pending;
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

  function renderResult(rows) {
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
          <div class="checkout-head"><div><p class="eyebrow mb-2">Status Pesanan</p><h2>Pembayaran: ${NB.escapeHtml(paymentLabel)}</h2></div></div>
          ${rows.map(row => `
            <div class="nb-track-item-block">
              <div class="checkout-price-line"><span>${NB.escapeHtml(row.product_name)} x${row.quantity}</span><strong>${money(row.total_price)}</strong></div>
              ${statusStepper(row.order_status)}
            </div>
          `).join('')}
          <div class="checkout-price-line"><span>Biaya layanan NiagaBio</span><strong>${money(platformFee)}</strong></div>
          <div class="checkout-price-line"><span>Cadangan withdrawal</span><strong>${money(withdrawalReserve)}</strong></div>
          <div class="checkout-price-line total-line"><span>Total</span><strong>${money(grandTotal)}</strong></div>
        </section>
      </section>
    `;

    document.getElementById('trackAgainBtn').addEventListener('click', () => renderForm());
  }

  renderForm();
});
