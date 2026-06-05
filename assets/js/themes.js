document.addEventListener('DOMContentLoaded', async () => {
  setActiveSide('themes');

  const user = await NB.requireAuth();
  if (!user) return;

  let profile = await NB.getProfile(user.id);
  const premium = NB.isPremium(profile);
  const currentTheme = profile?.theme_name || 'service';

  themeGrid.innerHTML = NB.themes.map(theme => `
    <div class="col-md-6 col-xl-4">
      <div class="theme-card ${currentTheme === theme.id ? 'active' : ''} ${theme.premium && !premium ? 'locked' : ''}" data-theme="${theme.id}">
        <div class="theme-swatch theme-${theme.id}" style="background:linear-gradient(135deg,var(--theme-a,#0f9f68),var(--theme-b,#dff7eb))"></div>
        <h5 class="fw-bold mb-1">${NB.escapeHtml(theme.name)}</h5>
        <p class="text-muted mb-0 small">${NB.escapeHtml(theme.desc)}</p>
      </div>
    </div>
  `).join('');

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
        profile = await NB.upsertProfile({
          user_id: user.id,
          email: profile?.email || user.email,
          username: profile?.username || NB.slugify(user.email.split('@')[0]),
          display_name: profile?.display_name || user.email.split('@')[0],
          bio: profile?.bio || '',
          avatar_url: profile?.avatar_url || 'assets/img/logo.jpg',
          whatsapp_number: profile?.whatsapp_number || '',
          theme_name: themeId
        });

        document.querySelectorAll('.theme-card').forEach(item => item.classList.remove('active'));
        card.classList.add('active');
        nbToast('Tema berhasil dipilih.');
      } catch (error) {
        nbToast(error.message || 'Gagal memilih tema.', 'danger');
      }
    });
  });
});
