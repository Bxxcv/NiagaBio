document.addEventListener('DOMContentLoaded', async () => {
  const params = new URLSearchParams(location.search);
  const parts = location.pathname.split('/').filter(Boolean);
  const username = params.get('username') || (parts[0] === 'checkout' && parts[1]) || 'demo';
  const productId = params.get('product') || (parts[0] === 'checkout' && parts[2]) || null;

  try {
    const profile = await NB.getProfileByUsername(username);
    if (!profile) {
      checkoutRoot.innerHTML = '<div class="empty-state">Toko tidak ditemukan.</div>';
      return;
    }

    const premium = NB.isPremium(profile);
    const products = await NB.list('products', profile.user_id);
    const product = products.find(item => item.id === productId) || products[0];
    const checkout = (await NB.list('checkout_settings', profile.user_id))[0] || {};

    if (!product) {
      checkoutRoot.innerHTML = '<div class="empty-state">Produk tidak ditemukan.</div>';
      return;
    }

    if (!premium || !checkout.qris_enabled) {
      location.href = NB.whatsappUrl(profile.whatsapp_number || checkout.whatsapp_number, `Halo kak, saya mau pesan ${product.name}`);
      return;
    }

    const storeUrl = `u?username=${encodeURIComponent(profile.username || username)}`;

    checkoutRoot.innerHTML = `
      <div class="mb-3">
        <a class="btn btn-outline-nb" href="${storeUrl}"><i class="bi bi-arrow-left me-1"></i>Kembali ke Toko</a>
      </div>
      <div class="row g-4 align-items-start">
        <div class="col-lg-5">
          <div class="card-nb p-4">
            <img src="${NB.escapeHtml(product.image_url || 'assets/img/placeholder-product.svg')}" class="w-100 rounded-4 mb-3" alt="">
            <h1 class="h4 fw-bold">${NB.escapeHtml(product.name)}</h1>
            <p class="text-muted">${NB.escapeHtml(product.description || '')}</p>
            <div class="h3 text-green fw-black">${NB.money(product.price)}</div>
          </div>
        </div>
        <div class="col-lg-7">
          <div class="card-nb p-4">
            <h2 class="h4 fw-bold mb-3">Checkout QRIS Manual</h2>
            <p class="text-muted">Scan QRIS seller, lalu upload bukti pembayaran. Seller akan konfirmasi paid dari dashboard.</p>
            ${checkout.qris_image_url ? `<img class="qris-preview mb-3" src="${NB.escapeHtml(checkout.qris_image_url)}" alt="QRIS">` : '<div class="alert alert-warning">Seller belum upload QRIS. Gunakan WhatsApp.</div>'}
            <p class="small mb-4"><b>Nama QRIS:</b> ${NB.escapeHtml(checkout.qris_name || profile.display_name)}<br><b>Catatan:</b> ${NB.escapeHtml(checkout.payment_note || '-')}</p>
            <form id="orderForm">
              <div class="row g-3">
                <div class="col-md-6"><label class="form-label">Nama pembeli</label><input id="buyerName" class="form-control" required></div>
                <div class="col-md-6"><label class="form-label">No. WhatsApp</label><input id="buyerPhone" class="form-control" required></div>
                <div class="col-md-6"><label class="form-label">Jumlah</label><input id="qty" type="number" min="1" value="1" class="form-control" required></div>
                <div class="col-md-6"><label class="form-label">Upload bukti bayar</label><input id="proof" type="file" accept="image/*" class="form-control"></div>
              </div>
              <button class="btn btn-nb w-100 mt-4" type="submit">Kirim Pesanan</button>
              <a class="btn btn-outline-nb w-100 mt-2" href="${NB.whatsappUrl(profile.whatsapp_number || checkout.whatsapp_number, `Halo kak, saya mau pesan ${product.name}`)}">Order via WhatsApp</a>
              <a class="btn btn-light w-100 mt-2" href="${storeUrl}"><i class="bi bi-arrow-left me-1"></i>Kembali ke Toko</a>
            </form>
          </div>
        </div>
      </div>
    `;

    orderForm.addEventListener('submit', async event => {
      event.preventDefault();
      const button = orderForm.querySelector('button[type="submit"]');
      button.disabled = true;

      try {
        let proofUrl = '';
        if (proof.files[0]) {
          try {
            proofUrl = await NB.uploadFile(proof.files[0], 'proofs');
          } catch (uploadError) {
            console.warn('[NiagaBio] Bukti bayar gagal diupload:', uploadError.message);
            nbToast('Bukti bayar gagal diupload, tapi pesanan tetap dibuat.', 'warning');
          }
        }

        await NB.save('orders', {
          seller_id: profile.user_id,
          buyer_name: buyerName.value.trim(),
          buyer_phone: buyerPhone.value.trim(),
          product_id: product.id,
          product_name: product.name,
          quantity: Number(qty.value || 1),
          total_price: Number(product.price || 0) * Number(qty.value || 1),
          payment_method: 'qris_manual',
          payment_status: 'pending',
          proof_image_url: proofUrl,
          created_at: NB.now(),
          paid_at: null
        });

        nbToast('Pesanan masuk. Tunggu seller konfirmasi paid.');
        orderForm.reset();
      } catch (error) {
        nbToast(error.message || 'Gagal membuat pesanan.', 'danger');
      } finally {
        button.disabled = false;
      }
    });
  } catch (error) {
    checkoutRoot.innerHTML = `<div class="empty-state">Gagal memuat checkout: ${NB.escapeHtml(error.message || 'Unknown error')}</div>`;
  }
});
