document.addEventListener('DOMContentLoaded', async () => {
  const params = new URLSearchParams(location.search);
  const username = params.get('username') || location.pathname.split('/').filter(Boolean).pop() || 'demo';

  try {
    const profile = await NB.getProfileByUsername(username);
    if (!profile) {
      publicRoot.innerHTML = '<div class="empty-state">Toko tidak ditemukan.</div>';
      return;
    }

    const premium = NB.isPremium(profile);
    const products = (await NB.list('products', profile.user_id)).filter(product => product.is_active !== false);
    const links = (await NB.list('custom_links', profile.user_id)).filter(link => link.is_active !== false);
    const socials = await NB.list('social_links', profile.user_id);
    const gallery = premium ? await NB.list('gallery', profile.user_id) : [];
    const checkout = (await NB.list('checkout_settings', profile.user_id))[0] || {};

    document.body.classList.add(`theme-${profile.theme_name || 'service'}`);

    publicRoot.innerHTML = `
      <div class="public-card">
        <div class="public-hero" style="background:linear-gradient(135deg,var(--theme-a,#0f9f68),#08764d)">
          <img class="public-avatar mb-3" src="${NB.escapeHtml(profile.avatar_url || 'assets/img/logo.jpg')}" alt="">
          <h1 class="h3 fw-black mb-1">${NB.escapeHtml(profile.display_name)}</h1>
          <p class="mb-3 opacity-75">${NB.escapeHtml(profile.bio || '')}</p>
          <div class="d-flex justify-content-center gap-2 flex-wrap">
            ${socials.map(social => `<a class="btn btn-light btn-sm rounded-pill" href="${NB.escapeHtml(social.url)}" target="_blank"><i class="bi ${NB.socialIcon(social.platform)}"></i></a>`).join('')}
          </div>
        </div>
        <div class="public-body">
          <div id="linksBox" class="mb-4"></div>
          <div class="d-flex align-items-center justify-content-between mb-3">
            <h2 class="h5 fw-bold mb-0">Katalog Produk</h2>
            ${premium ? '<span class="badge-soft">Search aktif</span>' : ''}
          </div>
          ${premium ? '<input id="productSearch" class="form-control mb-3" placeholder="Cari produk atau kategori...">' : ''}
          <div id="productsBox" class="row g-3"></div>
          ${premium && gallery.length ? '<div id="galleryBox" class="mt-4"></div>' : ''}
          ${!premium ? '<div class="text-center small text-muted mt-4">Made with NiagaBio</div>' : ''}
        </div>
      </div>
    `;

    linksBox.innerHTML = links.map(link => `
      <a class="public-link" href="${NB.escapeHtml(link.url)}" target="_blank">
        <i class="bi ${NB.escapeHtml(link.icon || 'bi-link-45deg')}"></i>${NB.escapeHtml(link.title)}
      </a>
    `).join('');

    function renderProducts(list) {
      productsBox.innerHTML = list.map(product => `
        <div class="col-6">
          <div class="product-card">
            <img src="${NB.escapeHtml(product.image_url || 'assets/img/placeholder-product.svg')}" alt="">
            <div class="pbody">
              <div class="fw-bold small">${NB.escapeHtml(product.name)}</div>
              <div class="price small mb-2">${NB.money(product.price)}</div>
              <button class="btn btn-nb btn-sm w-100" data-buy="${product.id}">Beli</button>
            </div>
          </div>
        </div>
      `).join('') || '<div class="col-12"><div class="empty-state">Belum ada produk.</div></div>';

      document.querySelectorAll('[data-buy]').forEach(button => {
        button.addEventListener('click', () => buy(list.find(product => product.id === button.dataset.buy)));
      });
    }

    function renderGallery() {
      const box = document.getElementById('galleryBox');
      if (!box) return;
      box.innerHTML = `
        <h2 class="h5 fw-bold mb-3">Gallery</h2>
        <div class="row g-3">
          ${gallery.map(item => `
            <div class="col-6">
              <div class="product-card">
                <img src="${NB.escapeHtml(item.image_url)}" alt="">
                <div class="pbody"><div class="small fw-semibold">${NB.escapeHtml(item.caption || 'Gallery')}</div></div>
              </div>
            </div>
          `).join('')}
        </div>
      `;
    }

    function buy(product) {
      if (!product) return;
      const mode = checkout.checkout_mode || 'whatsapp';
      if (premium && checkout.qris_enabled && (mode === 'qris_manual' || mode === 'qris_whatsapp')) {
        location.href = `checkout.html?username=${encodeURIComponent(profile.username)}&product=${encodeURIComponent(product.id)}`;
        return;
      }

      const text = `Halo kak, saya mau pesan:\nProduk: ${product.name}\nHarga: ${NB.money(product.price)}\nJumlah: 1`;
      location.href = NB.whatsappUrl(profile.whatsapp_number || checkout.whatsapp_number, text);
    }

    renderProducts(products);
    renderGallery();

    const search = document.getElementById('productSearch');
    if (search) {
      search.addEventListener('input', () => {
        const query = search.value.toLowerCase();
        renderProducts(products.filter(product => `${product.name} ${product.category} ${product.description}`.toLowerCase().includes(query)));
      });
    }
  } catch (error) {
    publicRoot.innerHTML = `<div class="empty-state">Gagal memuat toko: ${NB.escapeHtml(error.message || 'Unknown error')}</div>`;
  }
});
