document.addEventListener('DOMContentLoaded', async () => {
  setActiveSide('links');

  const user = await NB.requireAuth();
  if (!user) return;

  const refs = {
    form: document.getElementById('linkForm'),
    title: document.getElementById('linkTitle'),
    url: document.getElementById('linkUrl'),
    icon: document.getElementById('linkIcon'),
    active: document.getElementById('linkActive'),
    reset: document.getElementById('resetLink'),
    rows: document.getElementById('linkRows'),
    limitInfo: document.getElementById('linkLimitInfo')
  };

  if (!refs.form || !refs.rows) return;

  let profile = await NB.getProfile(user.id);
  const limit = NB.getLimits(NB.isPremium(profile) ? 'premium' : 'free').links;
  if (refs.limitInfo) refs.limitInfo.textContent = `${NB.isPremium(profile) ? 'Premium' : 'Free'}: maksimal ${limit} link custom`;

  let editing = null;
  let manualIconTouched = false;

  function detectedIcon() {
    return NB.detectLinkIcon(refs.url?.value || '', refs.title?.value || '');
  }

  function syncIcon(force = false) {
    if (!refs.icon) return;
    const current = refs.icon.value.trim();
    const shouldAuto = force || !manualIconTouched || !current || current === 'bi-link-45deg';
    if (shouldAuto) refs.icon.value = detectedIcon();
  }

  function iconPreview(iconClass) {
    return `<i class="bi ${NB.escapeHtml(iconClass || 'bi-link-45deg')} me-2 text-green"></i>`;
  }

  async function render() {
    const rows = await NB.list('custom_links', user.id);
    refs.rows.innerHTML = rows.map(link => {
      const icon = link.icon && link.icon !== 'bi-link-45deg'
        ? link.icon
        : NB.detectLinkIcon(link.url, link.title);

      return `
        <tr>
          <td>${iconPreview(icon)}<span class="fw-bold">${NB.escapeHtml(link.title)}</span></td>
          <td class="text-truncate" style="max-width:280px">${NB.escapeHtml(link.url)}</td>
          <td>${link.is_active ? '<span class="badge text-bg-success">Aktif</span>' : '<span class="badge text-bg-secondary">Nonaktif</span>'}</td>
          <td class="text-end">
            <button class="btn btn-sm btn-outline-nb" data-edit="${link.id}">Edit</button>
            <button class="btn btn-sm btn-outline-danger" data-del="${link.id}">Hapus</button>
          </td>
        </tr>
      `;
    }).join('') || '<tr><td colspan="4" class="text-center text-muted">Belum ada link.</td></tr>';

    document.querySelectorAll('[data-edit]').forEach(button => {
      button.addEventListener('click', () => fill(rows.find(item => item.id === button.dataset.edit)));
    });

    document.querySelectorAll('[data-del]').forEach(button => {
      button.addEventListener('click', async () => {
        if (!confirm('Hapus link?')) return;
        try {
          await NB.remove('custom_links', button.dataset.del);
          nbToast('Link dihapus.');
          render();
        } catch (error) {
          nbToast(error.message || 'Gagal hapus link.', 'danger');
        }
      });
    });
  }

  function fill(link) {
    if (!link) return;
    editing = link;
    manualIconTouched = Boolean(link.icon && link.icon !== 'bi-link-45deg');
    refs.title.value = link.title || '';
    refs.url.value = link.url || '';
    refs.icon.value = link.icon || NB.detectLinkIcon(link.url, link.title);
    refs.active.checked = link.is_active !== false;
  }

  function resetForm() {
    editing = null;
    manualIconTouched = false;
    refs.form.reset();
    refs.icon.value = 'bi-link-45deg';
    refs.active.checked = true;
    syncIcon(true);
  }

  refs.title?.addEventListener('input', () => syncIcon());
  refs.url?.addEventListener('input', () => syncIcon());
  refs.icon?.addEventListener('input', () => {
    manualIconTouched = Boolean(refs.icon.value.trim() && refs.icon.value.trim() !== detectedIcon());
  });

  refs.reset?.addEventListener('click', resetForm);

  refs.form.addEventListener('submit', async event => {
    event.preventDefault();
    const rows = await NB.list('custom_links', user.id);
    if (!editing && rows.length >= limit) {
      nbToast(`Limit ${limit} link. Upgrade Premium untuk tambah lebih banyak.`, 'warning');
      return;
    }

    try {
      const icon = refs.icon.value.trim() || detectedIcon();

      await NB.save('custom_links', {
        id: editing?.id || NB.uid('lnk'),
        user_id: user.id,
        title: refs.title.value.trim(),
        url: refs.url.value.trim(),
        icon,
        is_active: refs.active.checked,
        sort_order: editing?.sort_order || Date.now(),
        click_count: editing?.click_count || 0,
        created_at: editing?.created_at || NB.now()
      });

      resetForm();
      nbToast('Link tersimpan. Logo link otomatis disesuaikan dari URL/judul.');
      render();
    } catch (error) {
      nbToast(error.message || 'Gagal simpan link.', 'danger');
    }
  });

  syncIcon(true);
  render();
});
