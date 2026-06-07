document.addEventListener('DOMContentLoaded', async () => {
  const root = document.getElementById('checkoutRoot');
  const params = new URLSearchParams(location.search);
  const parts = location.pathname.split('/').filter(Boolean);
  const username = params.get('username') || (parts[0] === 'checkout' && parts[1]) || 'demo';
  const productId = params.get('product') || (parts[0] === 'checkout' && parts[2]) || null;

  const empty = message => {
    if (root) root.innerHTML = `<div class="empty-state">${NB.escapeHtml(message)}</div>`;
  };

  function storeUrl(profile) {
    return `u?username=${encodeURIComponent(profile.username || username)}`;
  }

  function normalizePhone(phone) {
    return String(phone || '').replace(/[^0-9+]/g, '').trim();
  }

  function orderMessage({ profile, product, quantity, buyerName }) {
    return [
      `Halo kak, saya mau pesan dari ${profile.display_name || profile.username || 'toko'}:`,
      `Produk: ${product.name}`,
      `Jumlah: ${quantity}`,
      `Total: ${NB.money(Number(product.price || 0) * Number(quantity || 1))}`,
      buyerName ? `Nama: ${buyerName}` : ''
    ].filter(Boolean).join('\n');
  }

  function successView({ profile, product, quantity, total, buyerName, buyerPhone }) {
    const waText = `Halo kak, saya sudah checkout dan upload bukti pembayaran.\nProduk: ${product.name}\nJumlah: ${quantity}\nTotal: ${NB.money(total)}\nNama: ${buyerName}\nWA: ${buyerPhone}`;
    root.innerHTML = `
      <section class="checkout-success card-nb">
        <div class="success-icon"><i class="bi bi-check2-circle"></i></div>
        <h1>Pesanan berhasil dikirim</h1>
        <p>Order kamu masuk dengan status <b>pending</b>. Seller akan cek bukti pembayaran dan mengubah status jadi paid.</p>
        <div class="checkout-success-summary">
          <span>Produk</span><strong>${NB.escapeHtml(product.name)}</strong>
          <span>Jumlah</span><strong>${NB.escapeHtml(quantity)}</strong>
          <span>Total</span><strong>${NB.money(total)}</strong>
        </div>
        <div class="d-grid gap-2 mt-4">
          <a class="btn btn-nb" href="${NB.escapeHtml(NB.whatsappUrl(profile.whatsapp_number, waText))}" target="_blank" rel="noopener">
            <i class="bi bi-whatsapp me-1"></i>Konfirmasi ke Seller
          </a>
          <a class="btn btn-outline-nb" href="${storeUrl(profile)}">
            <i class="bi bi-arrow-left me-1"></i>Kembali ke Toko
          </a>
        </div>
      </section>
    `;
  }

  try {
    const profile = await NB.getProfileByUsername(username);
    if (!profile) {
      empty('Toko tidak ditemukan.');
      return;
    }

    const premium = NB.isPremium(profile);
    const products = (await NB.list('products', profile.user_id)).filter(item => item.is_active !== false);
    const product = products.find(item => String(item.id) === String(productId)) || products[0];
    const checkout = (await NB.list('checkout_settings', profile.user_id))[0] || {};

    if (!product) {
      empty('Produk tidak ditemukan atau belum aktif.');
      return;
    }

    const sellerPhone = profile.whatsapp_number || checkout.whatsapp_number;
    const canQris = premium && checkout.qris_enabled && checkout.qris_image_url;

    if (!canQris) {
      location.href = NB.whatsappUrl(sellerPhone, orderMessage({ profile, product, quantity: 1 }));
      return;
    }

    root.innerHTML = `
      <div class="checkout-backbar">
        <a class="btn btn-outline-nb" href="${storeUrl(profile)}">
          <i class="bi bi-arrow-left me-1"></i>Kembali ke Toko
        </a>
        <span><i class="bi bi-shield-check me-1"></i>Checkout aman via QRIS manual</span>
      </div>

      <section class="checkout-grid">
        <aside class="checkout-summary card-nb">
          <div class="checkout-store">
            <img src="${NB.escapeHtml(profile.avatar_url || 'assets/img/logo.jpg')}" alt="${NB.escapeHtml(profile.display_name || 'Toko')}">
            <div>
              <small>Toko</small>
              <strong>${NB.escapeHtml(profile.display_name || profile.username || 'NiagaBio Store')}</strong>
            </div>
          </div>
          <img src="${NB.escapeHtml(product.image_url || 'assets/img/placeholder-product.svg')}" class="checkout-product-img" alt="${NB.escapeHtml(product.name)}">
          <h1>${NB.escapeHtml(product.name)}</h1>
          ${product.description ? `<p>${NB.escapeHtml(product.description)}</p>` : ''}
          <div class="checkout-price-line">
            <span>Harga produk</span>
            <strong>${NB.money(product.price)}</strong>
          </div>
          <div class="checkout-price-line total-line">
            <span>Total</span>
            <strong id="totalPreview">${NB.money(product.price)}</strong>
          </div>
          <a class="btn btn-light w-100 mt-3" href="${storeUrl(profile)}">
            <i class="bi bi-shop me-1"></i>Lihat produk lain
          </a>
        </aside>

        <section class="checkout-form-card card-nb">
          <div class="checkout-head">
            <div>
              <p class="eyebrow mb-2">QRIS manual</p>
              <h2>Scan, bayar, lalu kirim bukti</h2>
              <p>Order akan masuk ke dashboard seller sebagai pending sampai dikonfirmasi paid.</p>
            </div>
            <img class="checkout-qris" src="${NB.escapeHtml(checkout.qris_image_url)}" alt="QRIS ${NB.escapeHtml(checkout.qris_name || profile.display_name || '')}">
          </div>

          <div class="checkout-note">
            <i class="bi bi-info-circle"></i>
            <div>
              <b>${NB.escapeHtml(checkout.qris_name || profile.display_name || 'QRIS Seller')}</b>
              <span>${NB.escapeHtml(checkout.payment_note || 'Pastikan nominal sesuai total pesanan sebelum kirim bukti.')}</span>
            </div>
          </div>

          <form id="orderForm" class="checkout-form">
            <div class="row g-3">
              <div class="col-md-6">
                <label class="form-label">Nama pembeli</label>
                <input id="buyerName" class="form-control" autocomplete="name" placeholder="Nama kamu" required>
              </div>
              <div class="col-md-6">
                <label class="form-label">No. WhatsApp</label>
                <input id="buyerPhone" class="form-control" inputmode="tel" placeholder="08xxxxxxxxxx" required>
              </div>
              <div class="col-md-6">
                <label class="form-label">Jumlah</label>
                <input id="qty" type="number" min="1" value="1" class="form-control" required>
              </div>
              <div class="col-md-6">
                <label class="form-label">Bukti pembayaran</label>
                <input id="proof" type="file" accept="image/*" class="form-control">
              </div>
            </div>
            <div class="checkout-actions">
              <button class="btn btn-nb" type="submit">
                <i class="bi bi-send me-1"></i>Kirim Pesanan
              </button>
              <a class="btn btn-outline-nb" href="${NB.escapeHtml(NB.whatsappUrl(sellerPhone, orderMessage({ profile, product, quantity: 1 })))}" target="_blank" rel="noopener">
                <i class="bi bi-whatsapp me-1"></i>Tanya Seller
              </a>
            </div>
          </form>
        </section>
      </section>
    `;

    const form = document.getElementById('orderForm');
    const qtyInput = document.getElementById('qty');
    const totalPreview = document.getElementById('totalPreview');
    const proofInput = document.getElementById('proof');
    const buyerNameInput = document.getElementById('buyerName');
    const buyerPhoneInput = document.getElementById('buyerPhone');

    const updateTotal = () => {
      const qty = Math.max(1, Number(qtyInput.value || 1));
      totalPreview.textContent = NB.money(Number(product.price || 0) * qty);
    };
    qtyInput.addEventListener('input', updateTotal);

    form.addEventListener('submit', async event => {
      event.preventDefault();
      const button = form.querySelector('button[type="submit"]');
      button.disabled = true;
      button.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Mengirim...';

      try {
        const quantity = Math.max(1, Number(qtyInput.value || 1));
        const buyerName = buyerNameInput.value.trim();
        const buyerPhone = normalizePhone(buyerPhoneInput.value);
        let proofUrl = '';

        if (proofInput.files[0]) {
          try {
            proofUrl = await NB.uploadFile(proofInput.files[0], 'proofs');
          } catch (uploadError) {
            console.warn('[NiagaBio] Bukti bayar gagal diupload:', uploadError.message);
            nbToast('Bukti gagal diupload. Order tetap dibuat, kamu bisa konfirmasi lewat WhatsApp.', 'warning');
          }
        }

        await NB.save('orders', {
          seller_id: profile.user_id,
          buyer_name: buyerName,
          buyer_phone: buyerPhone,
          product_id: product.id,
          product_name: product.name,
          quantity,
          total_price: Number(product.price || 0) * quantity,
          payment_method: 'qris_manual',
          payment_status: 'pending',
          proof_image_url: proofUrl,
          created_at: NB.now(),
          paid_at: null
        });

        successView({ profile, product, quantity, total: Number(product.price || 0) * quantity, buyerName, buyerPhone });
      } catch (error) {
        nbToast(error.message || 'Gagal membuat pesanan.', 'danger');
        button.disabled = false;
        button.innerHTML = '<i class="bi bi-send me-1"></i>Kirim Pesanan';
      }
    });
  } catch (error) {
    empty(`Gagal memuat checkout: ${error.message || 'error tidak diketahui'}`);
  }
});
