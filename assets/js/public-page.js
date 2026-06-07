document.addEventListener('DOMContentLoaded', async () => {
  const root = document.getElementById('publicRoot');

  try {
    const settings = await NB.getSettings();
    const maintenanceEnabled = settings.maintenance_mode === true || settings.maintenance_mode === 'true' || settings.maintenance_mode === 1;
    if (maintenanceEnabled) {
      const loggedUser = await NB.currentUser();
      const loggedProfile = loggedUser ? await NB.getProfile(loggedUser.id) : null;
      const isAdmin = String(loggedProfile?.role || '').toLowerCase() === 'admin';
      if (!isAdmin) {
        sessionStorage.setItem('nb_maintenance_message', settings.maintenance_message || 'Website sedang maintenance.');
        location.replace('maintenance');
        return;
      }
    }
  } catch (error) {
    console.warn('[NiagaBio] Public maintenance guard dilewati:', error.message);
  }

  const params = new URLSearchParams(location.search);
  const pathLast = location.pathname.split('/').filter(Boolean).pop();
  const pathUsername = pathLast && !['u', 'u.html'].includes(pathLast) ? pathLast : '';
  let username = params.get('username') || params.get('u') || pathUsername || 'demo';
  const hasExplicitUsername = Boolean(params.get('username') || params.get('u') || pathUsername);

  const demoProfile = {
    user_id: 'demo-user',
    username: 'demo',
    display_name: 'Niaga Store',
    bio: 'Contoh halaman toko NiagaBio untuk katalog produk dan order WhatsApp.',
    avatar_url: 'assets/img/logo.jpg',
    whatsapp_number: '6281234567890',
    plan: 'premium',
    status: 'active',
    plan_end_date: '2099-12-31T00:00:00Z',
    theme_name: 'service'
  };

  const demoProducts = [
    {
      id: 'demo-product-1',
      name: 'Hoodie Basic',
      price: 120000,
      description: 'Hoodie nyaman untuk harian.',
      image_url: 'assets/img/placeholder-product.svg',
      category: 'Fashion',
      is_active: true,
      is_featured: true
    },
    {
      id: 'demo-product-2',
      name: 'Kaos Oversize',
      price: 85000,
      description: 'Kaos bahan adem dan cutting oversize.',
      image_url: 'assets/img/placeholder-product.svg',
      category: 'Fashion',
      is_active: true,
      is_featured: true
    },
    {
      id: 'demo-product-3',
      name: 'Paket Stiker UMKM',
      price: 45000,
      description: 'Stiker custom untuk packaging.',
      image_url: 'assets/img/placeholder-product.svg',
      category: 'Bisnis',
      is_active: true,
      is_featured: false
    }
  ];

  const demoLinks = [
    { title: 'Katalog Lengkap', url: '#', icon: 'bi-bag', is_active: true },
    { title: 'Order via WhatsApp', url: 'https://wa.me/6281234567890', icon: 'bi-whatsapp', is_active: true }
  ];

  const demoSocials = [
    { platform: 'instagram', url: 'https://instagram.com/' },
    { platform: 'whatsapp', url: 'https://wa.me/6281234567890' },
    { platform: 'tiktok', url: 'https://tiktok.com/' }
  ];

  const demoGallery = [
    { image_url: 'assets/img/placeholder-product.svg', caption: 'Contoh gallery produk' }
  ];

  function safeTheme(themeName) {
    const allowed = (NB.themes || []).map(theme => theme.id);
    return allowed.includes(themeName) ? themeName : 'service';
  }

  function productImage(url) {
    return NB.escapeHtml(url || 'assets/img/placeholder-product.svg');
  }

  function themeLabel(themeName) {
    const found = (NB.themes || []).find(theme => theme.id === themeName);
    return found ? found.name : 'Niaga Clean';
  }

  function socialButton(social) {
    return `
      <a class="public-social" href="${NB.escapeHtml(social.url)}" target="_blank" rel="noopener" aria-label="${NB.escapeHtml(social.platform)}">
        <i class="bi ${NB.socialIcon(social.platform)}"></i>
      </a>
    `;
  }

  function linkButton(link) {
    const icon = link.icon && link.icon !== 'bi-link-45deg'
      ? link.icon
      : NB.detectLinkIcon(link.url, link.title);

    return `
      <a class="public-link" href="${NB.escapeHtml(link.url)}" target="_blank" rel="noopener">
        <span><i class="bi ${NB.escapeHtml(icon)}"></i></span>
        <strong>${NB.escapeHtml(link.title)}</strong>
        <i class="bi bi-arrow-up-right public-link-arrow"></i>
      </a>
    `;
  }

  function productCard(product) {
    return `
      <article class="public-product-card ${product.is_featured ? 'is-featured' : ''}">
        <div class="public-product-media">
          <img src="${productImage(product.image_url)}" alt="${NB.escapeHtml(product.name)}">
          ${product.category ? `<span class="public-product-category">${NB.escapeHtml(product.category)}</span>` : ''}
        </div>
        <div class="public-product-body">
          <h3>${NB.escapeHtml(product.name)}</h3>
          ${product.description ? `<p>${NB.escapeHtml(product.description)}</p>` : ''}
          <div class="public-product-foot">
            <strong>${NB.money(product.price)}</strong>
            <button class="public-buy-btn" type="button" data-buy="${NB.escapeHtml(product.id)}">Beli</button>
          </div>
        </div>
      </article>
    `;
  }

  function galleryCard(item) {
    return `
      <figure class="public-gallery-card">
        <img src="${productImage(item.image_url)}" alt="${NB.escapeHtml(item.caption || 'Gallery')}">
        ${item.caption ? `<figcaption>${NB.escapeHtml(item.caption)}</figcaption>` : ''}
      </figure>
    `;
  }

  function makePublicUrl(profile) {
    const origin = location.origin;
    return `${origin}/u?username=${encodeURIComponent(profile.username || 'demo')}`;
  }

  function renderShell({ profile, themeName, premium, products, links, socials, gallery }) {
    const activeProducts = products.length;
    const activeLinks = links.length + socials.length;
    const publicUrl = makePublicUrl(profile);
    const year = new Date().getFullYear();

    root.innerHTML = `
      <section class="public-shell public-theme-${themeName}" data-theme="${themeName}">
        <div class="public-bg-orb public-bg-orb-one"></div>
        <div class="public-bg-orb public-bg-orb-two"></div>

        <div class="public-card public-card-${themeName}">
          <header class="public-hero">
            <div class="public-theme-chip">
              <i class="bi bi-palette2"></i>
              ${NB.escapeHtml(themeLabel(themeName))}
            </div>

            <img class="public-avatar" src="${NB.escapeHtml(profile.avatar_url || 'assets/img/logo.jpg')}" alt="${NB.escapeHtml(profile.display_name)}">

            <div class="public-identity">
              <p class="public-kicker">@${NB.escapeHtml(profile.username || 'toko')}</p>
              <h1>${NB.escapeHtml(profile.display_name || 'NiagaBio Store')}</h1>
              <p>${NB.escapeHtml(profile.bio || 'Katalog produk dan link penting toko.')}</p>
            </div>

            <div class="public-socials">
              ${socials.length ? socials.map(socialButton).join('') : ''}
            </div>
          </header>

          <div class="public-body">
            <section class="public-stats" aria-label="Statistik toko">
              <div>
                <strong>${activeProducts}</strong>
                <span>Produk</span>
              </div>
              <div>
                <strong>${activeLinks}</strong>
                <span>Link</span>
              </div>
              <div>
                <strong>${premium ? 'Premium' : 'Free'}</strong>
                <span>Paket</span>
              </div>
            </section>

            ${links.length ? `
              <section class="public-section public-link-section">
                <div class="public-section-head">
                  <h2>Link Penting</h2>
                  <span>Tap untuk buka</span>
                </div>
                <div class="public-links">
                  ${links.map(linkButton).join('')}
                </div>
              </section>
            ` : ''}

            <section class="public-section public-products-section">
              <div class="public-section-head">
                <h2>Katalog Produk</h2>
                <span>${premium ? 'Search aktif' : 'Basic catalog'}</span>
              </div>

              ${premium ? `
                <label class="public-search-wrap">
                  <i class="bi bi-search"></i>
                  <input id="productSearch" type="search" placeholder="Cari produk, kategori, atau deskripsi...">
                </label>
              ` : ''}

              <div id="productsBox" class="public-products-grid"></div>
            </section>

            ${premium && gallery.length ? `
              <section class="public-section public-gallery-section">
                <div class="public-section-head">
                  <h2>Gallery</h2>
                  <span>${gallery.length} foto</span>
                </div>
                <div class="public-gallery-strip">
                  ${gallery.slice(0, 6).map(galleryCard).join('')}
                </div>
                ${gallery.length > 6 ? `<p class="small text-muted mt-2 mb-0">+${gallery.length - 6} foto lainnya disimpan di gallery toko.</p>` : ''}
              </section>
            ` : ''}

            <footer class="public-footer">
              <span>© ${year} ${NB.escapeHtml(profile.display_name || 'Toko NiagaBio')}</span>
              <span class="public-powered">Powered by NiagaBio</span>
              <button id="copyPublicLink" type="button">
                <i class="bi bi-copy"></i> Salin Link
              </button>
              <input id="publicUrlValue" value="${NB.escapeHtml(publicUrl)}" readonly>
            </footer>
          </div>
        </div>
      </section>
    `;
  }

  function bindCopyButton() {
    const button = document.getElementById('copyPublicLink');
    const input = document.getElementById('publicUrlValue');
    if (!button || !input) return;

    button.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(input.value);
        nbToast('Link toko disalin.');
      } catch (error) {
        input.classList.add('is-visible');
        input.select();
      }
    });
  }

  try {
    let profile = null;

    if (!hasExplicitUsername) {
      const loggedUser = await NB.currentUser();
      if (loggedUser) {
        profile = await NB.getProfile(loggedUser.id);
        if (profile?.username) username = profile.username;
      }
    }

    if (!profile) profile = await NB.getProfileByUsername(username);
    let products = [];
    let links = [];
    let socials = [];
    let gallery = [];
    let checkout = {};
    let demoModePage = false;

    if (!profile && username === 'demo') {
      profile = demoProfile;
      products = demoProducts;
      links = demoLinks;
      socials = demoSocials;
      gallery = demoGallery;
      checkout = { checkout_mode: 'whatsapp', whatsapp_number: demoProfile.whatsapp_number, qris_enabled: false };
      demoModePage = true;
    }

    if (!profile) {
      root.innerHTML = '<div class="empty-state">Toko tidak ditemukan.</div>';
      return;
    }

    const premium = NB.isPremium(profile);
    const themeName = premium ? safeTheme(profile.theme_name || 'service') : safeTheme(['service', 'minimal'].includes(profile.theme_name) ? profile.theme_name : 'service');

    document.body.className = document.body.className
      .split(' ')
      .filter(className => !className.startsWith('theme-') && !className.startsWith('public-theme-'))
      .join(' ')
      .trim();
    document.body.classList.add('public-page', `theme-${themeName}`, `public-theme-${themeName}`);

    if (!demoModePage) {
      products = (await NB.list('products', profile.user_id)).filter(product => product.is_active !== false);
      links = (await NB.list('custom_links', profile.user_id)).filter(link => link.is_active !== false);
      socials = await NB.list('social_links', profile.user_id);
      gallery = premium ? await NB.list('gallery', profile.user_id) : [];
      checkout = (await NB.list('checkout_settings', profile.user_id))[0] || {};
    }

    renderShell({ profile, themeName, premium, products, links, socials, gallery });

    function renderProducts(list) {
      const box = document.getElementById('productsBox');
      if (!box) return;

      box.innerHTML = list.map(productCard).join('') || '<div class="empty-state">Belum ada produk.</div>';

      document.querySelectorAll('[data-buy]').forEach(button => {
        button.addEventListener('click', () => {
          const product = list.find(item => String(item.id) === String(button.dataset.buy));
          buy(product);
        });
      });
    }

    function buy(product) {
      if (!product) return;
      const mode = checkout.checkout_mode || 'whatsapp';

      if (!demoModePage && premium && checkout.qris_enabled && (mode === 'qris_manual' || mode === 'qris_whatsapp')) {
        location.href = `checkout?username=${encodeURIComponent(profile.username)}&product=${encodeURIComponent(product.id)}`;
        return;
      }

      const text = `Halo kak, saya mau pesan:\nProduk: ${product.name}\nHarga: ${NB.money(product.price)}\nJumlah: 1`;
      location.href = NB.whatsappUrl(profile.whatsapp_number || checkout.whatsapp_number, text);
    }

    renderProducts(products);
    bindCopyButton();

    const search = document.getElementById('productSearch');
    if (search) {
      search.addEventListener('input', () => {
        const query = search.value.toLowerCase().trim();
        const filtered = products.filter(product => `${product.name} ${product.category} ${product.description}`.toLowerCase().includes(query));
        renderProducts(filtered);
      });
    }
  } catch (error) {
    root.innerHTML = `<div class="empty-state">Gagal memuat toko: ${NB.escapeHtml(error.message || 'Unknown error')}</div>`;
  }
});
