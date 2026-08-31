document.addEventListener('DOMContentLoaded', async () => {
  const root = document.getElementById('checkoutRoot');
  const params = new URLSearchParams(location.search);
  const parts = location.pathname.split('/').filter(Boolean);
  const username = params.get('username') || (parts[0] === 'checkout' && parts[1]) || 'demo';
  const productId = params.get('product') || (parts[0] === 'checkout' && parts[2]) || null;
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

  function renderExpired({ profile, product, order }) {
    clearPolling();
    root.innerHTML = `
      <section class="checkout-success card-nb checkout-payment-state checkout-payment-state--warning">
        <div class="success-icon"><i class="bi bi-clock-history"></i></div>
        <h1>Pembayaran kedaluwarsa</h1>
        <p>QRIS untuk order ini sudah tidak aktif. Silakan kembali ke toko dan buat checkout baru.</p>
        <div class="checkout-success-summary">
          <span>Produk</span><strong>${NB.escapeHtml(product.name)}</strong>
          <span>Total order</span><strong>${money(order.buyer_total)}</strong>
        </div>
        <a class="nb-btn nb-btn--outline" href="${NB.safeHref(storeUrl(profile))}"><i class="bi bi-arrow-left me-1"></i>Kembali ke Toko</a>
      </section>
    `;
  }

  function renderPaid({ profile, product, quantity, order, buyerName, buyerPhone }) {
    clearPolling();
    const waText = `Halo kak, pembayaran order NiagaBio sudah berhasil.\nProduk: ${product.name}\nJumlah: ${quantity}\nTotal: ${money(order.buyer_total)}\nNama: ${buyerName}\nWA: ${buyerPhone}`;
    root.innerHTML = `
      <section class="checkout-success card-nb checkout-payment-state">
        <div class="success-icon"><i class="bi bi-check2-circle"></i></div>
        <h1>Pembayaran berhasil</h1>
        <p>Order kamu sudah tercatat sebagai <strong>PAID</strong>. Seller bisa langsung memproses pesanan.</p>
        <div class="checkout-success-summary">
          <span>Produk</span><strong>${NB.escapeHtml(product.name)}</strong>
          <span>Jumlah</span><strong>${NB.escapeHtml(quantity)}</strong>
          <span>Total dibayar</span><strong>${money(order.buyer_total)}</strong>
        </div>
        <div class="d-grid gap-2 mt-4">
          <a class="nb-btn nb-btn--commerce" href="${NB.safeHref(NB.whatsappUrl(profile.whatsapp_number, waText))}" target="_blank" rel="noopener"><i class="bi bi-whatsapp me-1"></i>Kirim Konfirmasi WhatsApp</a>
          <a class="nb-btn nb-btn--outline" href="${NB.safeHref(storeUrl(profile))}"><i class="bi bi-shop me-1"></i>Kembali ke Toko</a>
        </div>
      </section>
    `;
  }

  function renderPayment({ profile, product, order, payment, buyerName, buyerPhone }) {
    const qrSource = payment.qris_image || payment.qr_url || '';
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
          <img src="${NB.safeImageUrl(product.image_url || 'assets/img/placeholder-product.svg')}" class="checkout-product-img" alt="${NB.escapeHtml(product.name)}">
          <h1>${NB.escapeHtml(product.name)}</h1>
          ${product.description ? `<p>${NB.escapeHtml(product.description)}</p>` : ''}
          <div class="checkout-price-line"><span>Subtotal produk</span><strong>${money(order.total_price)}</strong></div>
          <div class="checkout-price-line"><span>Biaya layanan NiagaBio</span><strong>${money(order.platform_fee)}</strong></div>
          <div class="checkout-price-line"><span>Cadangan withdrawal</span><strong>${money(order.withdrawal_reserve)}</strong></div>
          ${Number(payment.gateway_fee || 0) > 0 ? `<div class="checkout-price-line"><span>Biaya payment gateway</span><strong>${money(payment.gateway_fee)}</strong></div>` : ''}
          <div class="checkout-price-line total-line"><span>Total pembayaran</span><strong>${money(payment.total_amount || order.buyer_total)}</strong></div>
        </aside>

        <section class="checkout-form-card card-nb checkout-payment-card">
          <div class="checkout-head">
            <div>
              <p class="eyebrow mb-2">QRIS</p>
              <h2>Scan untuk membayar</h2>
              <p>Setelah pembayaran berhasil, status order akan diperbarui otomatis.</p>
            </div>
            ${qrSource ? `<img class="checkout-qris checkout-qris--large" src="${NB.safeImageUrl(qrSource, 'assets/img/niagabio-logo.svg')}" alt="QRIS pembayaran">` : ''}
          </div>

          <div class="checkout-payment-order">
            <div><span>Nomor order</span><strong>${NB.escapeHtml(order.id)}</strong></div>
            <div><span>Total</span><strong>${money(payment.total_amount || order.buyer_total)}</strong></div>
          </div>

          <div class="checkout-note">
            <i class="bi bi-info-circle"></i>
            <div><b>Jangan tutup halaman ini.</b><span>Kamu bisa membuka halaman pembayaran provider sebagai alternatif. Status juga akan dicek otomatis.</span></div>
          </div>

          <div class="checkout-payment-actions">
            ${payment.payment_url ? `<a class="nb-btn nb-btn--commerce" href="${NB.safeHref(payment.payment_url)}" target="_blank" rel="noopener"><i class="bi bi-box-arrow-up-right me-1"></i>Buka Halaman Pembayaran</a>` : ''}
            ${payment.qr_url && !payment.qris_image ? `<a class="nb-btn nb-btn--outline" href="${NB.safeHref(payment.qr_url)}" target="_blank" rel="noopener"><i class="bi bi-qr-code me-1"></i>Buka QR</a>` : ''}
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
          body: JSON.stringify({ order_id: order.id })
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || 'Status pembayaran gagal dicek.');
        const status = String(data.status || data.payment?.status || 'pending').toLowerCase();
        if (status === 'success') {
          paymentLocked = true;
          const latestOrder = { ...order, buyer_total: Number(payment.total_amount || order.buyer_total) };
          renderPaid({ profile, product, quantity: order.quantity, order: latestOrder, buyerName, buyerPhone });
          return;
        }
        if (status === 'expired' || status === 'failed' || status === 'cancelled') {
          paymentLocked = true;
          renderExpired({ profile, product, order });
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

  try {
    const profile = await NB.getProfileByUsername(username);
    if (!profile) return empty('Toko tidak ditemukan.');

    const products = (await NB.list('products', profile.user_id)).filter(item => item.is_active !== false);
    const product = products.find(item => String(item.id) === String(productId)) || products[0];
    if (!product) return empty('Produk tidak ditemukan atau belum aktif.');

    // Attempt to restore from sessionStorage if order_id exists
    const savedOrderKey = Object.keys(sessionStorage)
      .find(key => key.startsWith('nb_order_'));
    if (savedOrderKey) {
      try {
        const saved = JSON.parse(sessionStorage.getItem(savedOrderKey));
        if (saved && saved.orderId) {
          // Verify order exists and matches current context
          const existingOrder = await NB.get('orders', saved.orderId);
          if (existingOrder && existingOrder.status === 'pending' && existingOrder.payment_method === 'qris_buatqris') {
            // Fetch payment data
            const paymentResponse = await fetch('/api/payment/status', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ order_id: saved.orderId })
            });
            const paymentBody = await paymentResponse.json().catch(() => ({}));
            // API returns { ok, status, payment: tx } — normalize to flat shape
            // that renderPayment expects (same shape as /api/payment/create response)
            if (paymentResponse.ok && paymentBody.status === 'pending') {
              const tx = paymentBody.payment || {};
              const payment = {
                transaction_id:  tx.provider_transaction_id || '',
                status:          'pending',
                qr_url:          tx.qr_url          || '',
                qris_image:      tx.qris_image       || '',
                payment_url:     tx.payment_url      || '',
                gateway_fee:     Number(tx.gateway_fee              || existingOrder.gateway_fee      || 0),
                total_amount:    Number(tx.provider_total_amount    || existingOrder.buyer_total      || 0),
                expires_at:      tx.expires_at       || existingOrder.payment_expires_at || null,
                is_test:         Boolean(tx.is_test)
              };
              renderPayment({
                profile,
                product,
                order: existingOrder,
                payment,
                buyerName: saved.buyerName,
                buyerPhone: saved.buyerPhone
              });
              return;
            }
          }
        }
      } catch (e) {
        console.warn('Failed to restore order from sessionStorage', e);
      }
      // Clean up invalid/expired saved order
      sessionStorage.removeItem(savedOrderKey);
    }

    root.innerHTML = `
      <div class="checkout-backbar">
        <a class="nb-btn nb-btn--outline" href="${NB.safeHref(storeUrl(profile))}"><i class="bi bi-arrow-left me-1"></i>Kembali ke Toko</a>
        <span><i class="bi bi-shield-check me-1"></i>Checkout NiagaBio</span>
      </div>
      <section class="checkout-grid">
        <aside class="checkout-summary card-nb">
          <div class="checkout-store"><img src="${NB.safeImageUrl(profile.avatar_url || 'assets/img/niagabio-logo.svg', 'assets/img/niagabio-logo.svg')}" alt="${NB.escapeHtml(profile.display_name || 'Toko')}"><div><small>Toko</small><strong>${NB.escapeHtml(profile.display_name || profile.username || 'NiagaBio Store')}</strong></div></div>
          <img src="${NB.safeImageUrl(product.image_url || 'assets/img/placeholder-product.svg')}" class="checkout-product-img" alt="${NB.escapeHtml(product.name)}">
          <h1>${NB.escapeHtml(product.name)}</h1>
          ${product.description ? `<p>${NB.escapeHtml(product.description)}</p>` : ''}
          <div class="checkout-price-line"><span>Harga satuan</span><strong>${money(product.price)}</strong></div>
          <div class="checkout-price-line total-line"><span>Total produk</span><strong id="subtotalPreview">${money(product.price)}</strong></div>
        </aside>

        <section class="checkout-form-card card-nb">
          <div class="checkout-head"><div><p class="eyebrow mb-2">Checkout</p><h2>Data pembeli</h2><p>Isi data di bawah, lalu NiagaBio akan membuat QRIS pembayaran otomatis.</p></div></div>
          <form id="orderForm" class="checkout-form">
            <div class="row g-3">
              <div class="col-md-6"><label class="form-label">Nama pembeli</label><input id="buyerName" class="form-control" autocomplete="name" placeholder="Nama kamu" required></div>
              <div class="col-md-6"><label class="form-label">No. WhatsApp</label><input id="buyerPhone" class="form-control" inputmode="tel" placeholder="08xxxxxxxxxx" required></div>
              <div class="col-md-6"><label class="form-label">Jumlah</label><input id="qty" type="number" min="1" value="1" class="form-control" required></div>
            </div>
            <div class="checkout-note mt-4"><i class="bi bi-receipt"></i><div><b>Biaya pembayaran transparan</b><span>Biaya layanan NiagaBio dan cadangan withdrawal akan tampil sebelum QRIS dibuat.</span></div></div>
            <div class="checkout-actions"><button class="nb-btn nb-btn--commerce" type="submit"><i class="bi bi-qr-code me-1"></i>Lanjut ke Pembayaran QRIS</button></div>
          </form>
        </section>
      </section>
    `;

    const form = document.getElementById('orderForm');
    const qtyInput = document.getElementById('qty');
    const subtotalPreview = document.getElementById('subtotalPreview');
    const buyerNameInput = document.getElementById('buyerName');
    const buyerPhoneInput = document.getElementById('buyerPhone');

    const updateSubtotal = () => {
      const qty = Math.max(1, Number(qtyInput.value || 1));
      subtotalPreview.textContent = money(Number(product.price || 0) * qty);
    };
    qtyInput.addEventListener('input', updateSubtotal);

    form.addEventListener('submit', async event => {
      event.preventDefault();
      const button = form.querySelector('button[type="submit"]');
      button.disabled = true;
      button.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Menyiapkan order…';

      try {
        const quantity = Math.max(1, Number(qtyInput.value || 1));
        const buyerName = buyerNameInput.value.trim();
        const buyerPhone = normalizePhone(buyerPhoneInput.value);

        const order = await NB.createPublicOrder({
          seller_id: profile.user_id,
          buyer_name: buyerName,
          buyer_phone: buyerPhone,
          product_id: product.id,
          quantity,
          payment_method: 'qris_buatqris',
          proof_image_url: ''
        });

        // Persist order_id in sessionStorage for resumption
        sessionStorage.setItem(`nb_order_${order.id}`, JSON.stringify({
          orderId: order.id,
          sellerId: profile.user_id,
          productId: product.id,
          quantity,
          buyerName,
          buyerPhone,
          createdAt: new Date().toISOString()
        }));

        button.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Membuat QRIS…';
        const paymentResponse = await fetch('/api/payment/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ order_id: order.id })
        });
        const payment = await paymentResponse.json().catch(() => ({}));
        if (!paymentResponse.ok) throw new Error(payment.error || 'Gagal membuat QRIS pembayaran.');

        renderPayment({ profile, product, order, payment, buyerName, buyerPhone });
      } catch (error) {
        nbToast(error.message || 'Gagal membuat pembayaran.', 'danger');
        button.disabled = false;
        button.innerHTML = '<i class="bi bi-qr-code me-1"></i>Lanjut ke Pembayaran QRIS';
      }
    });
  } catch (error) {
    empty(`Gagal memuat checkout: ${error.message || 'terjadi masalah'}`);
  }
});
