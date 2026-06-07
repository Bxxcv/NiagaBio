document.addEventListener('DOMContentLoaded', async () => {
  setActiveSide('social');

  const user = await NB.requireAuth();
  if (!user) return;

  const profile = await NB.getProfile(user.id);
  const limit = NB.getLimits(NB.isPremium(profile) ? 'premium' : 'free').socials;
  socialLimitInfo.textContent = `${NB.isPremium(profile) ? 'Premium' : 'Free'}: maksimal ${limit} social media`;

  let editing = null;

  async function render() {
    const rows = await NB.list('social_links', user.id);
    socialRows.innerHTML = rows.map(social => `
      <tr>
        <td><i class="bi ${NB.socialIcon(social.platform)} me-2 text-green"></i><span class="fw-bold text-capitalize">${NB.escapeHtml(social.platform)}</span></td>
        <td class="text-truncate" style="max-width:300px">${NB.escapeHtml(social.url)}</td>
        <td class="text-end">
          <button class="btn btn-sm btn-outline-nb" data-edit="${social.id}">Edit</button>
          <button class="btn btn-sm btn-outline-danger" data-del="${social.id}">Hapus</button>
        </td>
      </tr>
    `).join('') || '<tr><td colspan="3" class="text-center text-muted">Belum ada social media.</td></tr>';

    document.querySelectorAll('[data-edit]').forEach(button => {
      button.addEventListener('click', () => fill(rows.find(item => item.id === button.dataset.edit)));
    });

    document.querySelectorAll('[data-del]').forEach(button => {
      button.addEventListener('click', async () => {
        if (!confirm('Hapus social media?')) return;
        try {
          await NB.remove('social_links', button.dataset.del);
          nbToast('Social media dihapus.');
          render();
        } catch (error) {
          nbToast(error.message || 'Gagal hapus social media.', 'danger');
        }
      });
    });
  }

  function fill(social) {
    if (!social) return;
    editing = social;
    socialPlatform.value = social.platform || 'instagram';
    socialUrl.value = social.url || '';
  }

  resetSocial.addEventListener('click', () => {
    editing = null;
    socialForm.reset();
  });

  socialForm.addEventListener('submit', async event => {
    event.preventDefault();
    const rows = await NB.list('social_links', user.id);
    if (!editing && rows.length >= limit) {
      nbToast(`Limit ${limit} icon sosial media di plan Free.`, 'warning');
      return;
    }

    try {
      const normalizedUrl = NB.normalizeExternalUrl(socialUrl.value.trim(), '');
      if (!normalizedUrl) throw new Error('URL social media tidak valid.');

      await NB.save('social_links', {
        id: editing?.id || NB.uid('soc'),
        user_id: user.id,
        platform: socialPlatform.value,
        url: normalizedUrl,
        sort_order: editing?.sort_order || Date.now(),
        created_at: editing?.created_at || NB.now()
      });

      editing = null;
      socialForm.reset();
      nbToast('Social media tersimpan.');
      render();
    } catch (error) {
      nbToast(error.message || 'Gagal simpan social media.', 'danger');
    }
  });

  render();
});
