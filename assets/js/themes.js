document.addEventListener('DOMContentLoaded', async () => {
  setActiveSide('themes');

  const user = await NB.requireAuth();
  if (!user) return;

  const grid = document.getElementById('themeGrid');
  if (!grid) return;

  let profile = await NB.getProfile(user.id);
  const premium = NB.isPremium(profile);
  let currentTheme = profile?.theme_name || 'service';

  function publicUrl() {
    return `u?username=${encodeURIComponent(profile?.username || 'demo')}`;
  }

  function render() {
    grid.innerHTML = NB.themes.map(theme => `
      <div class="col-md-6 col-xl-4">
        <button class="theme-card ${currentTheme === theme.id ? 'active' : ''} ${theme.premium && !premium ? 'locked' : ''}" data-theme="${theme.id}" type="button">
          <div class="theme-swatch theme-${theme.id}" style="background:linear-gradient(135deg,var(--theme-a,#0f9f68),var(--theme-b,#dff7eb))"></div>
          <div class="d-flex align-items-start justify-content-between gap-2">
            <div class="text-start">
              <h5 class="fw-bold mb-1">${NB.escapeHtml(theme.name)}</h5>
              <p class="text-muted mb-0 small">${NB.escapeHtml(theme.desc)}</p>
            </div>
            ${currentTheme === theme.id ? '<span class="badge-soft">Aktif</span>' : ''}
          </div>
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

        if (selected.premium && !premium) {
          nbToast('Tema ini khusus Premium. Upgrade dulu ya bang.', 'warning');
          return;
        }

        try {
          await NB.upsertProfile({
            user_id: user.id,
            email: profile?.email || user.email,
            username: profile?.username || NB.slugify(user.email.split('@')[0]),
            display_name: profile?.display_name || user.email.split('@')[0],
            bio: profile?.bio || '',
            avatar_url: profile?.avatar_url || 'assets/img/logo.jpg',
            whatsapp_number: profile?.whatsapp_number || '',
            theme_name: themeId
          });

          profile = await NB.getProfile(user.id);
          currentTheme = profile?.theme_name || 'service';
          render();

          if (currentTheme !== themeId) {
            nbToast('Tema belum berubah. Pastikan akun ini Premium jika memilih tema Premium.', 'warning');
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
        <span class="small text-muted align-self-center">Buka preview pakai link ini, jangan /u kosong.</span>
      </div>
    `);
  }

  render();
});
