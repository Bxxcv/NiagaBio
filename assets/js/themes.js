document.addEventListener('DOMContentLoaded', async () => {
  setActiveSide('themes');

  const user = await NB.requireAuth();
  if (!user) return;

  const grid = document.getElementById('themeGrid');
  if (!grid) return;

  let profile = await NB.getProfile(user.id);
  let currentTheme = profile?.theme_name || 'service';

  const previewData = {
    service: {
      title: 'Niaga Store',
      bio: 'Katalog cepat untuk seller harian.',
      link: 'Order via WhatsApp',
      product: 'Paket Produk',
      tag: 'Best Seller',
      icon: 'bi-bag-check'
    },
    minimal: {
      title: 'Clean Shop',
      bio: 'Toko simpel, rapi, dan ringan.',
      link: 'Lihat Katalog',
      product: 'Basic Item',
      tag: 'Ready',
      icon: 'bi-circle'
    },
    fashion: {
      title: 'Luna Wear',
      bio: 'Editorial look untuk fashion brand.',
      link: 'Shop New Drop',
      product: 'Oversize Tee',
      tag: 'Drop',
      icon: 'bi-stars'
    },
    gadget: {
      title: 'Tech Hub',
      bio: 'Layout grid untuk gadget dan digital.',
      link: 'Cek Device',
      product: 'Smart Kit',
      tag: 'Tech',
      icon: 'bi-cpu'
    },
    food: {
      title: 'Dapur Fresh',
      bio: 'Menu hangat untuk kuliner dan snack.',
      link: 'Pesan Menu',
      product: 'Paket Hemat',
      tag: 'Menu',
      icon: 'bi-cup-hot'
    },
    beauty: {
      title: 'Glow Care',
      bio: 'Pastel lembut untuk beauty store.',
      link: 'Booking Treatment',
      product: 'Glow Serum',
      tag: 'Glow',
      icon: 'bi-flower1'
    },
    dark: {
      title: 'Black Drop',
      bio: 'Gelap kontras untuk drop eksklusif.',
      link: 'Enter Drop',
      product: 'Limited Item',
      tag: 'Drop',
      icon: 'bi-moon-stars'
    },
    luxury: {
      title: 'Maison Gold',
      bio: 'Nuansa premium dan elegan.',
      link: 'Private Order',
      product: 'Signature Set',
      tag: 'Gold',
      icon: 'bi-gem'
    },
    neon: {
      title: 'Neon Lab',
      bio: 'Energi kreator, game, dan digital.',
      link: 'Launch Link',
      product: 'Digital Pack',
      tag: 'Hot',
      icon: 'bi-lightning-charge'
    },
    portfolio: {
      title: 'Farid Visuals',
      bio: 'Portfolio commerce dengan border tebal.',
      link: 'Hire via WhatsApp',
      product: 'Template Pack',
      tag: 'Asset',
      icon: 'bi-vector-pen'
    }
  };

  function isPremiumNow() {
    return NB.isPremium(profile);
  }

  function publicUrl() {
    return `u?username=${encodeURIComponent(profile?.username || 'demo')}`;
  }

  async function refreshProfile() {
    profile = await NB.getProfile(user.id);
    currentTheme = profile?.theme_name || 'service';
    return profile;
  }

  function planHint() {
    const plan = profile?.plan || 'free';
    const status = profile?.status || 'active';
    const end = profile?.plan_end_date ? ` sampai ${new Date(profile.plan_end_date).toLocaleDateString('id-ID')}` : '';
    return `${plan}/${status}${end}`;
  }

  function themePreview(theme) {
    const data = previewData[theme.id] || previewData.service;
    const lock = theme.premium && !isPremiumNow();
    const verified = theme.premium ? '<i class="bi bi-patch-check-fill theme-mini-verified"></i>' : '';

    return `
      <div class="theme-live-preview theme-live-${NB.escapeHtml(theme.id)}">
        <div class="theme-mini-hero">
          <div class="theme-mini-avatar"><i class="bi ${NB.escapeHtml(data.icon)}"></i></div>
          <div class="theme-mini-name">
            <strong>${NB.escapeHtml(data.title)}</strong>${verified}
            <small>${NB.escapeHtml(data.bio)}</small>
          </div>
          <div class="theme-mini-socials">
            <i class="bi bi-instagram"></i>
            <i class="bi bi-whatsapp"></i>
            <i class="bi bi-tiktok"></i>
          </div>
        </div>
        <div class="theme-mini-body">
          <div class="theme-mini-link"><span><i class="bi bi-whatsapp"></i></span>${NB.escapeHtml(data.link)}<i class="bi bi-arrow-right"></i></div>
          <div class="theme-mini-product">
            <div class="theme-mini-product-img"><i class="bi ${NB.escapeHtml(data.icon)}"></i></div>
            <div>
              <b>${NB.escapeHtml(data.product)}</b>
              <small>${NB.escapeHtml(data.tag)} · Rp99.000</small>
            </div>
          </div>
          <div class="theme-mini-footer">Powered by NiagaBio</div>
        </div>
        ${lock ? '<div class="theme-mini-lock"><i class="bi bi-lock-fill"></i> Premium</div>' : ''}
      </div>
    `;
  }

  function render() {
    const premium = isPremiumNow();

    grid.innerHTML = NB.themes.map(theme => {
      const active = currentTheme === theme.id;
      const locked = theme.premium && !premium;
      return `
        <div class="col-lg-6 col-xl-4">
          <button class="theme-card theme-real-card ${active ? 'active' : ''} ${locked ? 'locked' : ''}" data-theme="${NB.escapeHtml(theme.id)}" type="button">
            ${themePreview(theme)}
            <div class="theme-real-info">
              <div>
                <h5>${NB.escapeHtml(theme.name)}</h5>
                <p>${NB.escapeHtml(theme.desc)}</p>
              </div>
              <span class="theme-real-status">${active ? 'Aktif' : locked ? 'Premium' : 'Pilih'}</span>
            </div>
          </button>
        </div>
      `;
    }).join('');

    bindCards();
  }

  function bindCards() {
    document.querySelectorAll('[data-theme]').forEach(card => {
      card.addEventListener('click', async () => {
        const themeId = card.dataset.theme;
        const selected = NB.themes.find(theme => theme.id === themeId);
        if (!selected) return;

        await refreshProfile();
        const premium = isPremiumNow();

        if (selected.premium && !premium) {
          nbToast(`Tema ini khusus Premium. Status akun terbaca: ${planHint()}.`, 'warning');
          return;
        }

        try {
          card.disabled = true;
          const updatedProfile = await NB.setProfileTheme(themeId);
          profile = updatedProfile || await NB.getProfile(user.id);
          currentTheme = profile?.theme_name || 'service';
          render();

          if (currentTheme !== themeId) {
            nbToast(`Tema belum berubah. Status akun terbaca: ${planHint()}. Coba logout/login ulang atau cek plan user di Admin Master.`, 'warning');
            return;
          }

          nbToast(`Tema ${selected.name} berhasil dipilih.`);
        } catch (error) {
          card.disabled = false;
          nbToast(error.message || 'Gagal memilih tema.', 'danger');
        }
      });
    });
  }

  const intro = document.querySelector('.content-wrap .card-nb');
  if (intro && !document.getElementById('openThemePreview')) {
    intro.insertAdjacentHTML('beforeend', `
      <div class="theme-intro-actions">
        <a id="openThemePreview" class="btn btn-nb btn-sm" href="${NB.safeHref(publicUrl())}" target="_blank" rel="noopener">
          <i class="bi bi-eye"></i> Lihat toko saya
        </a>
        <span>Preview di bawah dibuat lebih mendekati tampilan asli halaman toko.</span>
      </div>
    `);
  }

  render();
});
