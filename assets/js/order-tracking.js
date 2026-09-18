// STAGE23/24/25: Lacak pesanan tanpa akun.
//
// STAGE25 (revisi dari feedback Rid - "riwayat order seperti Shopee"):
// - Alur utama sekarang: masukin nomor WA -> lihat SEMUA pesanan (lintas
//   toko) -> klik satu -> lihat detail status. Pakai RPC get_orders_by_phone
//   (migration 37). Baca catatan trade-off keamanan di file migration itu:
//   lookup riwayat cuma pakai nomor WA, tidak ada order_group_id rahasia
//   lagi di langkah ini.
// - Link langsung dari email/WA konfirmasi (?order=xxx) tetap jalur cepat:
//   begitu nomor WA cocok, langsung ke detail order itu, tidak usah lewat
//   daftar riwayat dulu.
// - FIX bug STAGE24: auto-submit sebelumnya ikut jalan lagi tiap kali
//   render ulang (termasuk pas klik "kembali") sehingga terlihat seperti
//   tombol "tidak melakukan apa-apa". Sekarang auto-submit cuma sekali di
//   initial load (lihat flag isInitialLoad).
//
// Sengaja TIDAK pakai Supabase Realtime (postgres_changes): RLS `orders`
// memang sengaja menutup SELECT untuk anon (data finansial seller tidak
// boleh bocor), jadi realtime native juga akan diblok RLS yang sama.
// Polling ke RPC yang sudah aman jauh lebih simpel & tidak menambah
// permukaan akses baru.
document.addEventListener('DOMContentLoaded', () => {
  const root = document.getElementById('trackRoot');
  const params = new URLSearchParams(location.search);
  const prefillOrder = params.get('order') || '';
  const POLL_MS = 8000;
  let pollTimer = null;
  let currentOrderId = '';
  let currentPhone = '';
  let lastSignature = '';
  let isInitialLoad = true;

  const ORDER_STATUS_META = {
    pending: { text: 'Pesanan Diterima', icon: 'bi-receipt', step: 0, tone: 'warning' },
    processing: { text: 'Sedang Diproses', icon: 'bi-gear-fill', step: 1, tone: 'warning' },
    ready: { text: 'Siap Dikirim / Diambil', icon: 'bi-box-seam-fill', step: 2, tone: 'info' },
    completed: { text: 'Selesai', icon: 'bi-check-circle-fill', step: 3, tone: 'success' },
    cancelled: { text: 'Dibatalkan', icon: 'bi-x-circle-fill', step: -1, tone: 'danger' }
  };
  const PAYMENT_STATUS_LABEL = { pending: 'Menunggu Pembayaran', paid: 'Sudah Dibayar', cancelled: 'Dibatalkan' };
  const STEP_LABELS = ['Diterima', 'Diproses', 'Siap', 'Selesai'];
  const GLOBAL_PHONE_KEY = 'nb_track_phone_global';

  function money(value) { return NB.money(Math.max(0, Number(value || 0))); }

  function rememberGlobalPhone(phone) {
    try { localStorage.setItem(GLOBAL_PHONE_KEY, phone); } catch (_) { /* noop */ }
  }
  function recallGlobalPhone() {
    try { return localStorage.getItem(GLOBAL_PHONE_KEY) || ''; } catch (_) { return ''; }
  }
  function rememberOrderPhone(orderId, phone) {
    try { localStorage.setItem(`nb_track_${orderId}`, phone); } catch (_) { /* noop */ }
  }
  function recallOrderPhone(orderId) {
    try { return localStorage.getItem(`nb_track_${orderId}`) || ''; } catch (_) { return ''; }
  }

  function clearPolling() {
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = null;
  }

  function statusSignature(rows) {
    return rows.map(row => `${row.order_id}:${row.payment_status}:${row.order_status}`).join('|');
  }

  // ---------- Langkah 1: form nomor WA (riwayat) ----------
  function renderPhoneForm(message) {
    clearPolling();
    root.innerHTML = `
      <div class="checkout-backbar"><span><i class="bi bi-truck me-1"></i>Pesanan Saya</span></div>
      <section class="checkout-grid" style="grid-template-columns:1fr;max-width:480px;margin:0 auto;">
        <section class="checkout-form-card card-nb">
          <div class="checkout-head"><div><p class="eyebrow mb-2">Lacak Pesanan</p><h2>Lihat semua pesananmu</h2><p>Masukkan nomor WhatsApp yang kamu pakai saat checkout untuk melihat riwayat pesanan dari semua toko.</p></div></div>
          ${message ? `<div class="checkout-note checkout-note--danger"><i class="bi bi-exclamation-triangle"></i><div>${NB.escapeHtml(message)}</div></div>` : ''}
          <form id="phoneForm" class="checkout-form">
            <div class="row g-3">
              <div class="col-12"><label class="form-label">No. WhatsApp saat checkout</label><input id="historyPhoneInput" class="form-control" inputmode="tel" placeholder="08xxxxxxxxxx" value="${NB.escapeHtml(recallGlobalPhone())}" required></div>
            </div>
            <div class="checkout-actions"><button class="nb-btn nb-btn--commerce" type="submit"><i class="bi bi-search me-1"></i>Lihat Pesanan Saya</button></div>
          </form>
        </section>
      </section>
    `;

    document.getElementById('phoneForm').addEventListener('submit', async event => {
      event.preventDefault();
      const button = event.target.querySelector('button[type="submit"]');
      const phone = document.getElementById('historyPhoneInput').value.trim();
      button.disabled = true;
      button.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Mencari…';
      try {
        const rows = await NB.getOrdersByPhone(phone);
        rememberGlobalPhone(phone);
        renderHistoryList(rows, phone);
      } catch (error) {
        renderPhoneForm(error.message || 'Gagal memuat riwayat pesanan.');
      }
    });
  }

  // ---------- Langkah 2: daftar riwayat (ala "Pesanan Saya" Shopee) ----------
  function renderHistoryList(rows, phone) {
    clearPolling();
    if (!rows.length) {
      root.innerHTML = `
        <div class="checkout-backbar"><button type="button" class="nb-btn nb-btn--outline" id="historyBackBtn"><i class="bi bi-arrow-left me-1"></i>Kembali</button></div>
        <section class="checkout-form-card card-nb text-center py-5" style="max-width:480px;margin:0 auto;">
          <i class="bi bi-inbox" style="font-size:2rem"></i>
          <h2 class="mt-3">Belum ada pesanan</h2>
          <p>Tidak ada riwayat pesanan untuk nomor WhatsApp ini.</p>
        </section>
      `;
      document.getElementById('historyBackBtn').addEventListener('click', () => renderPhoneForm());
      return;
    }

    root.innerHTML = `
      <div class="checkout-backbar">
        <button type="button" class="nb-btn nb-btn--outline" id="historyBackBtn"><i class="bi bi-arrow-left me-1"></i>Ganti Nomor</button>
        <span><i class="bi bi-bag-check me-1"></i>${rows.length} pesanan</span>
      </div>
      <section class="checkout-grid" style="grid-template-columns:1fr;max-width:640px;margin:0 auto;">
        <div class="nb-track-history-list">
          ${rows.map(row => {
            const meta = ORDER_STATUS_META[row.order_status] || ORDER_STATUS_META.pending;
            return `
            <button type="button" class="nb-track-history-card" data-group="${NB.escapeHtml(row.order_group_id)}">
              <div class="nb-track-history-top">
                <strong>${NB.escapeHtml(row.seller_display_name || row.seller_username || 'Toko NiagaBio')}</strong>
                <span class="nb-track-toplabel nb-track-toplabel--${meta.tone}"><i class="bi ${meta.icon} me-1"></i>${meta.text}</span>
              </div>
              <p class="nb-track-history-items">${NB.escapeHtml(row.items_summary || '-')}</p>
              <div class="nb-track-history-bottom">
                <span>${new Date(row.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                <strong>${money(row.total_amount)}</strong>
              </div>
            </button>
          `;
          }).join('')}
        </div>
      </section>
    `;

    document.getElementById('historyBackBtn').addEventListener('click', () => renderPhoneForm());
    root.querySelectorAll('[data-group]').forEach(card => {
      card.addEventListener('click', async () => {
        try {
          const detail = await NB.getOrderGroupTracking(card.dataset.group, phone);
          if (!detail.length) throw new Error('Detail pesanan tidak ditemukan.');
          currentOrderId = card.dataset.group;
          currentPhone = phone;
          renderResult(detail, () => renderHistoryList(rows, phone));
          startPolling();
        } catch (error) {
          nbToast?.(error.message || 'Gagal memuat detail pesanan.', 'danger');
        }
      });
    });
  }

  // ---------- Langkah 3: detail 1 order group ----------
  function statusBadgeTop(meta) {
    return `<span class="nb-track-toplabel nb-track-toplabel--${meta.tone}"><i class="bi ${meta.icon} me-1"></i>${meta.text}</span>`;
  }

  function statusStepper(orderStatus) {
    const current = ORDER_STATUS_META[orderStatus] || ORDER_STATUS_META.pending;
    if (current.step === -1) return `<div class="nb-track-cancelled"><i class="bi bi-x-circle-fill"></i> Pesanan dibatalkan</div>`;
    return `
      <div class="nb-track-steps">
        ${STEP_LABELS.map((label, index) => `
          <div class="nb-track-step ${index <= current.step ? 'is-done' : ''} ${index === current.step ? 'is-current' : ''}">
            <span class="nb-track-dot"></span><span class="nb-track-step-label">${label}</span>
          </div>
        `).join('')}
      </div>
    `;
  }

  function renderResult(rows, onBack) {
    lastSignature = statusSignature(rows);
    const first = rows[0];
    const productSubtotal = rows.reduce((sum, row) => sum + Number(row.total_price || 0), 0);
    const platformFee = rows.reduce((sum, row) => sum + Number(row.platform_fee || 0), 0);
    const withdrawalReserve = rows.reduce((sum, row) => sum + Number(row.withdrawal_reserve || 0), 0);
    const grandTotal = productSubtotal + platformFee + withdrawalReserve;
    const paymentLabel = PAYMENT_STATUS_LABEL[first.payment_status] || first.payment_status;

    root.innerHTML = `
      <div class="checkout-backbar">
        <button type="button" class="nb-btn nb-btn--outline" id="trackBackBtn"><i class="bi bi-arrow-left me-1"></i>Kembali</button>
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

    document.getElementById('trackBackBtn').addEventListener('click', () => {
      clearPolling();
      if (onBack) onBack(); else renderPhoneForm();
    });
  }

  function startPolling() {
    clearPolling();
    pollTimer = setInterval(async () => {
      try {
        const rows = await NB.getOrderGroupTracking(currentOrderId, currentPhone);
        if (!rows.length) return;
        const signature = statusSignature(rows);
        if (signature === lastSignature) return; // status tidak berubah -> jangan render ulang (hindari flicker)
        renderResult(rows, null);
        startPolling();
      } catch (_) {
        // Diamkan kalau polling gagal sesekali (network blip).
      }
    }, POLL_MS);
  }

  // ---------- Entry point ----------
  // Link langsung dari konfirmasi checkout (?order=xxx): kalau nomor WA
  // untuk order ini sudah pernah diingat di device ini, langsung ke detail
  // - tidak usah lewat form/daftar riwayat dulu (jalur cepat).
  if (isInitialLoad && prefillOrder && recallOrderPhone(prefillOrder)) {
    isInitialLoad = false;
    const phone = recallOrderPhone(prefillOrder);
    currentOrderId = prefillOrder;
    currentPhone = phone;
    NB.getOrderGroupTracking(prefillOrder, phone)
      .then(rows => {
        if (!rows.length) throw new Error('Order tidak ditemukan.');
        rememberOrderPhone(prefillOrder, phone);
        renderResult(rows, () => renderPhoneForm());
        startPolling();
      })
      .catch(() => renderPhoneForm());
  } else if (isInitialLoad && prefillOrder) {
    // Ada order id dari link tapi belum ada nomor WA tersimpan untuk order
    // ini - minta nomor WA khusus untuk order itu, lalu langsung ke detail.
    isInitialLoad = false;
    root.innerHTML = `
      <section class="checkout-grid" style="grid-template-columns:1fr;max-width:480px;margin:2rem auto;">
        <section class="checkout-form-card card-nb">
          <div class="checkout-head"><div><p class="eyebrow mb-2">Lacak Pesanan</p><h2>Konfirmasi nomor WhatsApp</h2><p>Masukkan nomor WhatsApp yang kamu pakai saat checkout untuk melihat status pesanan ini.</p></div></div>
          <form id="quickPhoneForm" class="checkout-form">
            <div class="row g-3"><div class="col-12"><input id="quickPhoneInput" class="form-control" inputmode="tel" placeholder="08xxxxxxxxxx" required></div></div>
            <div class="checkout-actions"><button class="nb-btn nb-btn--commerce" type="submit"><i class="bi bi-search me-1"></i>Lihat Status</button></div>
          </form>
        </section>
      </section>
    `;
    document.getElementById('quickPhoneForm').addEventListener('submit', async event => {
      event.preventDefault();
      const phone = document.getElementById('quickPhoneInput').value.trim();
      try {
        const rows = await NB.getOrderGroupTracking(prefillOrder, phone);
        if (!rows.length) throw new Error('Order tidak ditemukan atau nomor WhatsApp tidak cocok.');
        rememberOrderPhone(prefillOrder, phone);
        currentOrderId = prefillOrder;
        currentPhone = phone;
        renderResult(rows, () => renderPhoneForm());
        startPolling();
      } catch (error) {
        nbToast?.(error.message || 'Order tidak ditemukan atau nomor WhatsApp tidak cocok.', 'danger');
      }
    });
  } else {
    isInitialLoad = false;
    renderPhoneForm();
  }
});
