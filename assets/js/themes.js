document.addEventListener('DOMContentLoaded', async () => {
  setActiveSide('themes');

  const user = await NB.requireAuth();
  if (!user) return;

  const grid = document.getElementById('themeGrid');
  if (!grid) return;

  let profile = await NB.getProfile(user.id);
  let currentTheme = profile?.theme_name || 'service';

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

  function render() {
    const premium = isPremiumNow();

    grid.innerHTML = NB.themes.map(theme => `
      <div class="col-md-6 col-xl-4">
        <button class="theme-card theme-preview-card theme-${theme.id} ${currentTheme === theme.id ? 'active' : ''} ${theme.premium && !premium ? 'locked' : ''}" data-theme="${theme.id}" type="button">
          <div class="theme-preview-window">
            <div class="theme-preview-hero">
              <span></span>
              <b>${NB.escapeHtml(theme.name.split(' ')[0])}</b>
            </div>
            <div class="theme-preview-body">
              <i></i>
              <i></i>
              <i></i>
            </div>
          </div>
          <div class="d-flex align-items-start justify-content-between gap-2">
            <div class="text-start">
              <h5 class="fw-bold mb-1">${NB.escapeHtml(theme.name)}</h5>
              <p class="text-muted mb-0 small">${NB.escapeHtml(theme.desc)}</p>
            </div>
            ${currentTheme === theme.id ? '<span class="badge-soft">Aktif</span>' : ''}
          </div>
          ${theme.premium && !premium ? '<div class="theme-lock"><i class="bi bi-lock"></i> Khusus Premium</div>' : ''}
        </button>
      </div>
    `).join('');

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
          nbToast(`Tema ini khusus Premium. Status akun terbaca: ${planHint()}. Logout/login ulang kalau baru di-upgrade.`, 'warning');
          return;
        }

        try {
          const updatedProfile = await NB.setProfileTheme(themeId);
          profile = updatedProfile || await NB.getProfile(user.id);
          currentTheme = profile?.theme_name || 'service';
          render();

          if (currentTheme !== themeId) {
            nbToast(`Tema belum berubah. Status akun terbaca: ${planHint()}. Coba logout/login ulang atau cek plan user di Admin Master.`, 'warning');
            return;
          }

          nbToast(`Tema ${selected.name} berhasil dipilih. Buka halaman toko untuk melihat hasilnya.`);
        } catch (error) {
          nbToast(error.message || 'Gagal memilih tema.', 'danger');
        }
      });
    });
  }

  const intro = document.querySelector('.content-wrap .card-nb');
  if (intro && !document.getElementById('openThemePreview')) {
    intro.insertAdjacentHTML('beforeend', `
      <div class="mt-3 d-flex flex-wrap gap-2">
        <a id="openThemePreview" class="btn btn-nb btn-sm" href="${NB.escapeHtml(publicUrl())}" target="_blank" rel="noopener">
          <i class="bi bi-eye"></i> Lihat Halaman Toko
        </a>
        <span class="small text-muted align-self-center">Kalau baru upgrade premium, logout/login ulang kalau badge belum berubah.</span>
      </div>
    `);
  }

  render();
});
