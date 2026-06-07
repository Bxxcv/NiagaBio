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


  const TEMPLATE_META = {
    service: {
      label: 'SELLER KIT',
      kicker: 'Toko online aktif',
      linkTitle: 'Link Cepat',
      linkHint: 'Tap untuk buka',
      productTitle: 'Produk Pilihan',
      productHint: 'Siap order',
      galleryTitle: 'Etalase Visual',
      footer: 'Dibuat dengan NiagaBio'
    },
    minimal: {
      label: 'MINIMAL',
      kicker: 'Clean catalog',
      linkTitle: 'Link Utama',
      linkHint: 'Open link',
      productTitle: 'Katalog',
      productHint: 'Basic shop',
      galleryTitle: 'Gallery',
      footer: 'Powered by NiagaBio'
    },
    fashion: {
      label: 'EDITORIAL',
      kicker: 'Fashion storefront',
      linkTitle: 'Brand Links',
      linkHint: 'Shop the look',
      productTitle: 'New Collection',
      productHint: 'Featured drops',
      galleryTitle: 'Lookbook',
      footer: 'Styled with NiagaBio'
    },
    gadget: {
      label: 'TECH STORE',
      kicker: 'Smart catalog',
      linkTitle: 'Quick Access',
      linkHint: 'Open module',
      productTitle: 'Device Lineup',
      productHint: 'Search enabled',
      galleryTitle: 'Product Shots',
      footer: 'Powered system by NiagaBio'
    },
    food: {
      label: 'MENU',
      kicker: 'Fresh daily order',
      linkTitle: 'Order Channel',
      linkHint: 'Pesan cepat',
      productTitle: 'Menu Favorit',
      productHint: 'Ready to serve',
      galleryTitle: 'Dapur Kami',
      footer: 'Served with NiagaBio'
    },
    beauty: {
      label: 'BEAUTY',
      kicker: 'Soft premium care',
      linkTitle: 'Beauty Links',
      linkHint: 'Explore',
      productTitle: 'Best Treatment',
      productHint: 'Glow picks',
      galleryTitle: 'Before After',
      footer: 'Glow with NiagaBio'
    },
    dark: {
      label: 'DARK DROP',
      kicker: 'Limited store',
      linkTitle: 'Access Point',
      linkHint: 'Enter',
      productTitle: 'Drop List',
      productHint: 'Limited items',
      galleryTitle: 'Archive',
      footer: 'Built in NiagaBio'
    },
    luxury: {
      label: 'SIGNATURE',
      kicker: 'Premium collection',
      linkTitle: 'Concierge Links',
      linkHint: 'Private access',
      productTitle: 'Signature Collection',
      productHint: 'Curated goods',
      galleryTitle: 'Catalogue Privé',
      footer: 'Crafted with NiagaBio'
    },
    neon: {
      label: 'NEON LAB',
      kicker: 'Creator dropzone',
      linkTitle: 'Portal Links',
      linkHint: 'Launch',
      productTitle: 'Digital Drops',
      productHint: 'Hot items',
      galleryTitle: 'Visual Feed',
      footer: 'Connected by NiagaBio'
    },
    portfolio: {
      label: 'CREATOR',
      kicker: 'Portfolio commerce',
      linkTitle: 'Featured Links',
      linkHint: 'Tap to open',
      productTitle: 'Best Seller',
      productHint: 'Digital assets',
      galleryTitle: 'Project Stacks',
      footer: 'Built with NiagaBio'
    }
  };

  function templateMeta(themeName) {
    return TEMPLATE_META[themeName] || TEMPLATE_META.service;
  }

  function safeTheme(themeName) {
    const allowed = (NB.themes || []).map(theme => theme.id);
    return allowed.includes(themeName) ? themeName : 'service';
  }

  function productImage(url) {
    return NB.safeImageUrl(url || 'assets/img/placeholder-product.svg');
  }

  function themeLabel(themeName) {
    const found = (NB.themes || []).find(theme => theme.id === themeName);
    return found ? found.name : 'Niaga Clean';
  }

  function socialButton(social) {
    return `
      <a class="public-social" href="${NB.safeHref(social.url)}" target="_blank" rel="noopener" aria-label="${NB.escapeHtml(social.platform)}">
        <i class="bi ${NB.socialIcon(social.platform)}"></i>
      </a>
    `;
  }

  function linkButton(link) {
    const icon = link.icon && link.icon !== 'bi-link-45deg'
      ? link.icon
      : NB.detectLinkIcon(link.url, link.title);

    return `
      <a class="public-link" href="${NB.safeHref(link.url)}" target="_blank" rel="noopener">
        <span><i class="bi ${NB.escapeHtml(NB.safeIconClass(icon))}"></i></span>
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
          ${product.is_featured ? '<span class="public-featured-badge"><i class="bi bi-star-fill"></i></span>' : ''}
          ${product.category ? `<span class="public-product-category">${NB.escapeHtml(product.category)}</span>` : ''}
        </div>
        <div class="public-product-body">
          <h3>${NB.escapeHtml(product.name)}</h3>
          ${product.description ? `<p>${NB.escapeHtml(product.description)}</p>` : ''}
          <div class="public-product-foot">
            <strong>${NB.money(product.price)}</strong>
            <button class="public-buy-btn" type="button" data-buy="${NB.escapeHtml(product.id)}">
              <span>Beli</span>
              <i class="bi bi-arrow-right"></i>
            </button>
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

  function renderVerifiedBadge(premium) {
    if (!premium) return '';
    return `
      <span class="public-verified" title="Toko Premium terverifikasi">
        <i class="bi bi-patch-check-fill"></i>
      </span>
    `;
  }

  function renderPremiumLine(premium) {
    return premium
      ? '<div class="public-trust-badge"><i class="bi bi-patch-check-fill"></i> Toko Premium terverifikasi</div>'
      : '<div class="public-trust-badge is-free"><i class="bi bi-shop"></i> Toko aktif NiagaBio</div>';
  }


  function updateStoreMeta(profile) {
    const title = `${profile.display_name || profile.username || 'Toko'} - NiagaBio`;
    const desc = profile.bio || 'Lihat produk, link penting, dan checkout toko ini di NiagaBio.';
    const image = NB.normalizeImageUrl(profile.avatar_url || `${location.origin}/assets/img/og-niagabio.jpg`, `${location.origin}/assets/img/og-niagabio.jpg`);

    document.title = title;
    [
      ['meta[name="description"]', desc],
      ['meta[property="og:title"]', title],
      ['meta[property="og:description"]', desc],
      ['meta[property="og:image"]', image],
      ['meta[name="twitter:title"]', title],
      ['meta[name="twitter:description"]', desc],
      ['meta[name="twitter:image"]', image]
    ].forEach(([selector, value]) => {
      const el = document.querySelector(selector);
      if (el) el.setAttribute('content', value);
    });
  }

  function renderShell({ profile, themeName, premium, products, links, socials, gallery }) {
    const year = new Date().getFullYear();
    const displayName = profile.display_name || 'NiagaBio Store';
    const template = templateMeta(themeName);

    root.innerHTML = `
      <section class="public-shell public-theme-${themeName}" data-theme="${themeName}">
        <div class="public-bg-orb public-bg-orb-one"></div>
        <div class="public-bg-orb public-bg-orb-two"></div>

        <div class="public-card public-card-${themeName}">
          <header class="public-hero">
            <img class="public-avatar" src="${NB.safeImageUrl(profile.avatar_url || 'assets/img/logo.jpg', 'assets/img/logo.jpg')}" alt="${NB.escapeHtml(displayName)}">

            <div class="public-identity">
              <p class="public-kicker">@${NB.escapeHtml(profile.username || 'toko')} · ${NB.escapeHtml(template.kicker)}</p>
              <h1>
                <span>${NB.escapeHtml(displayName)}</span>
                ${renderVerifiedBadge(premium)}
              </h1>
              <p>${NB.escapeHtml(profile.bio || 'Katalog produk dan link penting toko.')}</p>
              ${renderPremiumLine(premium)}
            </div>

            <div class="public-socials">
              ${socials.length ? socials.map(socialButton).join('') : ''}
            </div>
          </header>

          <div class="public-body">
            ${links.length ? `
              <section class="public-section public-link-section">
                <div class="public-section-head">
                  <h2>${NB.escapeHtml(template.linkTitle)}</h2>
                  <span>${NB.escapeHtml(template.linkHint)}</span>
                </div>
                <div class="public-links">
                  ${links.map(linkButton).join('')}
                </div>
              </section>
            ` : ''}

            <section class="public-section public-products-section">
              <div class="public-section-head">
                <h2>${NB.escapeHtml(template.productTitle)}</h2>
                <span>${premium ? NB.escapeHtml(template.productHint) : 'Basic catalog'}</span>
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
                  <h2>${NB.escapeHtml(template.galleryTitle)}</h2>
                  <span>${gallery.length} foto</span>
                </div>
                <div class="public-gallery-strip">
                  ${gallery.slice(0, 6).map(galleryCard).join('')}
                </div>
                ${gallery.length > 6 ? `<p class="small text-muted mt-2 mb-0 text-center">+${gallery.length - 6} foto lainnya disimpan di gallery toko.</p>` : ''}
              </section>
            ` : ''}

            <footer class="public-footer">
              <span>© ${year} ${NB.escapeHtml(displayName)}</span>
              <span class="public-powered">${NB.escapeHtml(template.footer)}</span>
            </footer>
          </div>
        </div>

        ${(profile.whatsapp_number || '').trim() ? `
          <a class="public-floating-wa" href="${NB.safeHref(NB.whatsappUrl(profile.whatsapp_number, `Halo kak, saya mau tanya tentang ${displayName}`))}" target="_blank" rel="noopener" aria-label="Chat WhatsApp">
            <i class="bi bi-whatsapp"></i>
          </a>
        ` : ''}
      </section>
    `;
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
    updateStoreMeta(profile);

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

    const search = document.getElementById('productSearch');
    if (search) {
      search.addEventListener('input', () => {
        const query = search.value.toLowerCase().trim();
        const filtered = products.filter(product => `${product.name} ${product.category} ${product.description}`.toLowerCase().includes(query));
        renderProducts(filtered);
      });
    }
  } catch (error) {
    root.innerHTML = `<div class="empty-state">Gagal memuat toko: ${NB.escapeHtml(error.message || 'terjadi masalah')}</div>`;
  }
});
