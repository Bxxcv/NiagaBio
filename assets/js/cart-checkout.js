// STAGE23: Checkout multi-item dari keranjang. Reuse /api/payment/create
// dan /api/payment/status APA ADANYA (tidak diubah) - keduanya cukup diberi
// order_id dari row "primary" (row yang bawa platform_fee > 0, hasil dari
// create_public_order_batch). Order row lain dalam order_group_id yang sama
// otomatis ikut ke-settle bareng lewat apply_buatqris_payment_event.
//
// Catatan batasan (disengaja, demi scope terkendali): TIDAK ada auto-resume
// kalau buyer reload halaman saat QR masih pending (checkout.js single-item
// yang lama juga punya fitur ini tapi lewat NB.get yang ternyata tidak ada -
// jadi fitur itu di source lama sebenarnya sudah tidak jalan). Kalau reload,
// buyer tinggal buka lagi dari keranjang.
document.addEventListener('DOMContentLoaded', async () => {
  const root = document.getElementById('checkoutRoot');
  const params = new URLSearchParams(location.search);
  const username = params.get('username') || 'demo';
  let pollTimer = null;
  let paymentLocked = false;

  const empty = message => {
    if (root) root.innerHTML = `<div class="empty-state">${NB.escapeHtml(message)}</div>`;
  };

  function storeUrl(profile) {
    return `/seller/u?username=${encodeURIComponent(profile.username || username)}`;
  }

  function normalizePhone(phone) {
    return String(phone || '').replace(/[^0-9]/g, '').trim();
  }

  function money(value) {
    return NB.money(Math.max(0, Number(value || 0)));
  }

  function clearPolling() {
    if (pollTimer) clearTimeout(pollTimer);
    pollTimer = null;
  }

  function findPrimary(orderRows) {
    return orderRows.find(row => Number(row.platform_fee || 0) > 0) || orderRows[0];
  }

  function groupTotals(orderRows) {
    return orderRows.reduce((acc, row) => {
      acc.productSubtotal += Number(row.total_price || 0);
      acc.platformFee += Number(row.platform_fee || 0);
      acc.withdrawalReserve += Number(row.withdrawal_reserve || 0);
      return acc;
    }, { productSubtotal: 0, platformFee: 0, withdrawalReserve: 0 });
  }

  function renderExpired({ profile, orderRows }) {
    clearPolling();
    const totals = groupTotals(orderRows);
    const grandTotal = totals.productSubtotal + totals.platformFee + totals.withdrawalReserve;
    root.innerHTML = `
      <section class="checkout-success card-nb checkout-payment-state checkout-payment-state--warning">
        <div class="success-icon"><i class="bi bi-clock-history"></i></div>
        <h1>Pembayaran kedaluwarsa</h1>
        <p>QRIS untuk order ini sudah tidak aktif. Silakan kembali ke toko dan checkout ulang dari keranjang.</p>
        <div class="checkout-success-summary">
          <span>Jumlah item</span><strong>${orderRows.length}</strong>
          <span>Total order</span><strong>${money(grandTotal)}</strong>
        </div>
        <a class="nb-btn nb-btn--outline" href="${NB.safeHref(storeUrl(profile))}"><i class="bi bi-arrow-left me-1"></i>Kembali ke Toko</a>
      </section>
    `;
  }

  async function renderPaid({ profile, orderRows, buyerName, buyerPhone, buyerTotal }) {
    clearPolling();
    NBCart.clear(profile.user_id);

    let customSettings = {};
    try {
      const rows = await NB.list('checkout_settings', profile.user_id);
      customSettings = rows[0] || {};
    } catch (err) {
      // Diamkan - kalau gagal fetch, tampilkan layar sukses standar saja.
    }
    const successMessage = String(customSettings.success_message || '').trim();
    const redirectUrl = String(customSettings.success_redirect_url || '').trim();
    const groupId = orderRows[0]?.order_group_id || '';
    const trackUrl = `${location.origin}/track.html?order=${encodeURIComponent(groupId)}`;

    const itemLines = orderRows.map(row => `${row.quantity} x ${row.product_name}`).join('\n');
    const waText = `Halo kak, pembayaran order NiagaBio sudah berhasil.\n${itemLines}\nTotal: ${money(buyerTotal)}\nNama: ${buyerName}\nWA: ${buyerPhone}`;

    root.innerHTML = `
      <section class="checkout-success card-nb checkout-payment-state">
        <div class="success-icon"><i class="bi bi-check2-circle"></i></div>
        <h1>Pembayaran berhasil</h1>
        <p>Semua pesanan kamu (${orderRows.length} item) sudah tercatat sebagai <strong>PAID</strong>. Seller bisa langsung memproses pesanan.</p>
        ${successMessage ? `<div class="checkout-seller-note"><i class="bi bi-chat-left-text me-1"></i>${NB.escapeHtml(successMessage)}</div>` : ''}
        <div class="checkout-success-summary">
          ${orderRows.map(row => `<span>${NB.escapeHtml(row.product_name)}</span><strong>${row.quantity} x ${money(Number(row.total_price || 0) / Math.max(row.quantity, 1))}</strong>`).join('')}
          <span>Total dibayar</span><strong>${money(buyerTotal)}</strong>
        </div>
        <div class="checkout-note mt-3">
          <i class="bi bi-signpost-2"></i>
          <div><b>Simpan link lacak pesanan ini.</b><span>Kamu bisa cek status pesanan kapan saja tanpa perlu akun.</span></div>
        </div>
        <div class="d-grid gap-2 mt-4">
          <a class="nb-btn nb-btn--commerce" href="${NB.safeHref(trackUrl)}"><i class="bi bi-truck me-1"></i>Lacak Pesanan Saya</a>
          ${redirectUrl ? `<a class="nb-btn nb-btn--outline" href="${NB.safeHref(redirectUrl)}" target="_blank" rel="noopener"><i class="bi bi-box-arrow-up-right me-1"></i>Lanjut ke Langkah Berikutnya</a>` : ''}
          <a class="nb-btn nb-btn--outline" href="${NB.safeHref(NB.whatsappUrl(profile.whatsapp_number, waText))}" target="_blank" rel="noopener"><i class="bi bi-whatsapp me-1"></i>Kirim Konfirmasi WhatsApp</a>
          <a class="nb-btn nb-btn--outline" href="${NB.safeHref(storeUrl(profile))}"><i class="bi bi-shop me-1"></i>Kembali ke Toko</a>
        </div>
      </section>
    `;
  }

  function renderPayment({ profile, orderRows, payment, buyerName, buyerPhone }) {
    const primary = findPrimary(orderRows);
    const totals = groupTotals(orderRows);
    const qrSource = payment.qr_url || payment.qris_image || '';
    const qrFallback = payment.qr_url ? (payment.qris_image || '') : '';
    const expiresText = payment.expires_at ? new Date(payment.expires_at).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }) : 'Mengikuti masa aktif provider';

    root.innerHTML = `
      <div class="checkout-backbar">
        <a class="nb-btn nb-btn--outline" href="${NB.safeHref(storeUrl(profile))}"><i class="bi bi-arrow-left me-1"></i>Kembali ke Toko</a>
        <span><i class="bi bi-shield-check me-1"></i>Pembayaran aman via BuatQris</span>
      </div>

      <section class="checkout-grid checkout-payment-grid">
        <aside class="checkout-summary card-nb">
          <div class="checkout-store">
            <img src="${NB.safeImageUrl(profile.avatar_url || 'assets/img/niagabio-logo.svg', 'assets/img/niagabio-logo.svg')}" alt="${NB.escapeHtml(profile.display_name || 'Toko')}">
            <div><small>Toko</small><strong>${NB.escapeHtml(profile.display_name || profile.username || 'NiagaBio Store')}</strong></div>
          </div>
          ${orderRows.map(row => `<div class="checkout-price-line"><span>${NB.escapeHtml(row.product_name)} x${row.quantity}</span><strong>${money(row.total_price)}</strong></div>`).join('')}
          <div class="checkout-price-line"><span>Biaya layanan NiagaBio</span><strong>${money(totals.platformFee)}</strong></div>
          <div class="checkout-price-line"><span>Cadangan withdrawal</span><strong>${money(totals.withdrawalReserve)}</strong></div>
          <div class="checkout-price-line total-line"><span>Total pembayaran</span><strong>${money(payment.total_amount || (totals.productSubtotal + totals.platformFee + totals.withdrawalReserve))}</strong></div>
          ${Number(payment.gateway_fee || 0) > 0 ? `<div class="checkout-note"><i class="bi bi-info-circle"></i><div><b>Total di atas sudah final.</b><span>Estimasi potongan payment gateway ${money(payment.gateway_fee)} dipotong dari penerimaan penjual/platform saat settlement, bukan ditambahkan ke total yang kamu bayar.</span></div></div>` : ''}
        </aside>

        <section class="checkout-form-card card-nb checkout-payment-card">
          <div class="checkout-head">
            <div>
              <p class="eyebrow mb-2">QRIS</p>
              <h2>Scan untuk membayar</h2>
              <p>Setelah pembayaran berhasil, status semua item di keranjang ini akan diperbarui otomatis.</p>
            </div>
            ${qrSource ? `<img class="checkout-qris checkout-qris--large" src="${NB.safeImageUrl(qrSource, 'assets/img/niagabio-logo.svg')}" alt="QRIS pembayaran" onerror="if(this.dataset.fb){this.src=this.dataset.fb;this.dataset.fb=''}" data-fb="${NB.safeImageUrl(qrFallback || 'assets/img/niagabio-logo.svg')}">` : ''}
          </div>

          <div class="checkout-payment-order">
            <div><span>Nomor order</span><strong>${NB.escapeHtml(primary.id)}</strong></div>
            <div><span>Total</span><strong>${money(payment.total_amount || primary.buyer_total)}</strong></div>
          </div>

          <div class="checkout-note">
            <i class="bi bi-info-circle"></i>
            <div><b>Jangan tutup halaman ini.</b><span>Kamu bisa membuka halaman pembayaran provider sebagai alternatif. Status juga akan dicek otomatis.</span></div>
          </div>

          <div class="checkout-payment-actions">
            ${payment.payment_url ? `<a class="nb-btn nb-btn--commerce" href="${NB.safeHref(payment.payment_url)}" target="_blank" rel="noopener"><i class="bi bi-box-arrow-up-right me-1"></i>Buka Halaman Pembayaran</a>` : ''}
            ${payment.qr_url && !qrSource ? `<a class="nb-btn nb-btn--outline" href="${NB.safeHref(payment.qr_url)}" target="_blank" rel="noopener"><i class="bi bi-qr-code me-1"></i>Buka QR</a>` : ''}
            <button type="button" class="nb-btn nb-btn--soft" id="checkPaymentBtn"><i class="bi bi-arrow-repeat me-1"></i>Cek Status</button>
          </div>

          <div class="checkout-payment-status" id="paymentStatus" role="status"><i class="bi bi-hourglass-split"></i> Menunggu pembayaran…</div>
          <div class="checkout-payment-expiry">Masa aktif: ${NB.escapeHtml(expiresText)}</div>
        </section>
      </section>
    `;

    const statusEl = document.getElementById('paymentStatus');
    const checkButton = document.getElementById('checkPaymentBtn');
    let attempts = 0;

    const checkStatus = async manual => {
      if (paymentLocked) return;
      if (manual) {
        checkButton.disabled = true;
        checkButton.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Mengecek';
      }
      try {
        const response = await fetch('/api/payment/status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ order_id: primary.id, access_token: payment.access_token || '' })
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || 'Status pembayaran gagal dicek.');
        const status = String(data.status || data.payment?.status || 'pending').toLowerCase();
        if (status === 'success') {
          paymentLocked = true;
          const buyerTotal = Number(payment.total_amount || primary.buyer_total);
          await renderPaid({ profile, orderRows, buyerName, buyerPhone, buyerTotal });
          return;
        }
        if (status === 'expired' || status === 'failed' || status === 'cancelled') {
          paymentLocked = true;
          renderExpired({ profile, orderRows });
          return;
        }
        statusEl.innerHTML = '<i class="bi bi-hourglass-split"></i> Menunggu pembayaran…';
        attempts += 1;
        if (attempts < 90) pollTimer = setTimeout(() => checkStatus(false), 7000);
      } catch (error) {
        statusEl.innerHTML = `<i class="bi bi-exclamation-triangle"></i> ${NB.escapeHtml(error.message || 'Gagal mengecek status.')}`;
      } finally {
        if (manual && checkButton) {
          checkButton.disabled = false;
          checkButton.innerHTML = '<i class="bi bi-arrow-repeat me-1"></i>Cek Status';
        }
      }
    };

    checkButton?.addEventListener('click', () => checkStatus(true));
    checkStatus(false);
  }

  function renderReview({ profile, cartItems, products }) {
    const rows = cartItems.map(item => {
      const product = products.find(p => String(p.id) === item.product_id);
      return product ? { product, quantity: item.quantity } : null;
    }).filter(Boolean);

    if (!rows.length) {
      root.innerHTML = `
        <section class="checkout-form-card card-nb text-center py-5">
          <i class="bi bi-cart-x" style="font-size:2rem"></i>
          <h2 class="mt-3">Keranjang kosong</h2>
          <p>Yuk pilih produk dulu dari toko.</p>
          <a class="nb-btn nb-btn--commerce" href="${NB.safeHref(storeUrl(profile))}">Kembali ke Toko</a>
        </section>
      `;
      return;
    }

    const subtotal = rows.reduce((sum, row) => sum + Number(row.product.price || 0) * row.quantity, 0);

    root.innerHTML = `
      <div class="checkout-backbar">
        <a class="nb-btn nb-btn--outline" href="${NB.safeHref(storeUrl(profile))}"><i class="bi bi-arrow-left me-1"></i>Kembali ke Toko</a>
        <span><i class="bi bi-shield-check me-1"></i>Checkout Keranjang</span>
      </div>
      <section class="checkout-grid">
        <aside class="checkout-summary card-nb">
          <div class="checkout-store"><img src="${NB.safeImageUrl(profile.avatar_url || 'assets/img/niagabio-logo.svg', 'assets/img/niagabio-logo.svg')}" alt="${NB.escapeHtml(profile.display_name || 'Toko')}"><div><small>Toko</small><strong>${NB.escapeHtml(profile.display_name || profile.username || 'NiagaBio Store')}</strong></div></div>
          ${rows.map(row => `<div class="checkout-price-line"><span>${NB.escapeHtml(row.product.name)} x${row.quantity}</span><strong>${money(Number(row.product.price || 0) * row.quantity)}</strong></div>`).join('')}
          <div class="checkout-price-line total-line"><span>Total produk</span><strong id="subtotalPreview">${money(subtotal)}</strong></div>
        </aside>

        <section class="checkout-form-card card-nb">
          <div class="checkout-head"><div><p class="eyebrow mb-2">Checkout</p><h2>Data pembeli</h2><p>Isi data di bawah, lalu NiagaBio akan membuat QRIS pembayaran otomatis untuk semua item ini.</p></div></div>
          <form id="orderForm" class="checkout-form">
            <div class="row g-3">
              <div class="col-md-6"><label class="form-label">Nama pembeli</label><input id="buyerName" class="form-control" autocomplete="name" placeholder="Nama kamu" required></div>
              <div class="col-md-6"><label class="form-label">No. WhatsApp</label><input id="buyerPhone" class="form-control" inputmode="tel" placeholder="08xxxxxxxxxx" required></div>
            </div>
            <div class="checkout-note mt-4"><i class="bi bi-receipt"></i><div><b>Biaya pembayaran transparan</b><span>Biaya layanan NiagaBio dan cadangan withdrawal dikenakan sekali untuk seluruh keranjang, akan tampil sebelum QRIS dibuat.</span></div></div>
            <div class="checkout-actions"><button class="nb-btn nb-btn--commerce" type="submit"><i class="bi bi-qr-code me-1"></i>Lanjut ke Pembayaran QRIS</button></div>
          </form>
        </section>
      </section>
    `;

    const form = document.getElementById('orderForm');
    const buyerNameInput = document.getElementById('buyerName');
    const buyerPhoneInput = document.getElementById('buyerPhone');

    form.addEventListener('submit', async event => {
      event.preventDefault();
      const button = form.querySelector('button[type="submit"]');
      button.disabled = true;
      button.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Menyiapkan order…';

      try {
        const buyerName = buyerNameInput.value.trim();
        const buyerPhone = normalizePhone(buyerPhoneInput.value);

        const orderRows = await NB.createOrderGroup({
          seller_id: profile.user_id,
          items: rows.map(row => ({ product_id: row.product.id, quantity: row.quantity })),
          buyer_name: buyerName,
          buyer_phone: buyerPhone,
          payment_method: 'qris_buatqris',
          proof_image_url: ''
        });

        const primary = findPrimary(orderRows);

        button.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Membuat QRIS…';
        const paymentResponse = await fetch('/api/payment/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ order_id: primary.id })
        });
        const payment = await paymentResponse.json().catch(() => ({}));
        if (!paymentResponse.ok) throw new Error(payment.error || 'Gagal membuat QRIS pembayaran.');

        renderPayment({ profile, orderRows, payment, buyerName, buyerPhone });
      } catch (error) {
        nbToast(error.message || 'Gagal membuat pembayaran.', 'danger');
        button.disabled = false;
        button.innerHTML = '<i class="bi bi-qr-code me-1"></i>Lanjut ke Pembayaran QRIS';
      }
    });
  }

  try {
    const profile = await NB.getProfileByUsername(username);
    if (!profile) return empty('Toko tidak ditemukan.');

    const cartItems = NBCart.getItems(profile.user_id);
    if (!cartItems.length) {
      root.innerHTML = `
        <section class="checkout-form-card card-nb text-center py-5">
          <i class="bi bi-cart-x" style="font-size:2rem"></i>
          <h2 class="mt-3">Keranjang kosong</h2>
          <p>Yuk pilih produk dulu dari toko.</p>
          <a class="nb-btn nb-btn--commerce" href="${NB.safeHref(storeUrl(profile))}">Kembali ke Toko</a>
        </section>
      `;
      return;
    }

    const products = (await NB.list('products', profile.user_id)).filter(item => item.is_active !== false);

    // Buang item cart yang produknya sudah tidak aktif/dihapus.
    const validIds = new Set(products.map(p => String(p.id)));
    const invalidCount = cartItems.filter(item => !validIds.has(item.product_id)).length;
    if (invalidCount > 0) {
      cartItems.filter(item => !validIds.has(item.product_id)).forEach(item => NBCart.remove(profile.user_id, item.product_id));
      nbToast(`${invalidCount} produk di keranjang sudah tidak tersedia dan dihapus otomatis.`, 'warning');
    }

    renderReview({ profile, cartItems: NBCart.getItems(profile.user_id), products });
  } catch (error) {
    empty(`Gagal memuat checkout: ${error.message || 'terjadi masalah'}`);
  }
});
