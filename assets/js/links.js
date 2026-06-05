document.addEventListener('DOMContentLoaded', async () => {
  setActiveSide('links');

  const user = await NB.requireAuth();
  if (!user) return;

  const profile = await NB.getProfile(user.id);
  const limit = NB.getLimits(NB.isPremium(profile) ? 'premium' : 'free').links;
  linkLimitInfo.textContent = `${NB.isPremium(profile) ? 'Premium' : 'Free'}: maksimal ${limit} link custom`;

  let editing = null;

  async function render() {
    const rows = await NB.list('custom_links', user.id);
    linkRows.innerHTML = rows.map(link => `
      <tr>
        <td><i class="bi ${NB.escapeHtml(link.icon || 'bi-link-45deg')} me-2 text-green"></i><span class="fw-bold">${NB.escapeHtml(link.title)}</span></td>
        <td class="text-truncate" style="max-width:280px">${NB.escapeHtml(link.url)}</td>
        <td>${link.is_active ? '<span class="badge text-bg-success">Aktif</span>' : '<span class="badge text-bg-secondary">Nonaktif</span>'}</td>
        <td class="text-end">
          <button class="btn btn-sm btn-outline-nb" data-edit="${link.id}">Edit</button>
          <button class="btn btn-sm btn-outline-danger" data-del="${link.id}">Hapus</button>
        </td>
      </tr>
    `).join('') || '<tr><td colspan="4" class="text-center text-muted">Belum ada link.</td></tr>';

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
    linkTitle.value = link.title || '';
    linkUrl.value = link.url || '';
    linkIcon.value = link.icon || 'bi-link-45deg';
    linkActive.checked = link.is_active !== false;
  }

  resetLink.addEventListener('click', () => {
    editing = null;
    linkForm.reset();
    linkIcon.value = 'bi-link-45deg';
    linkActive.checked = true;
  });

  linkForm.addEventListener('submit', async event => {
    event.preventDefault();
    const rows = await NB.list('custom_links', user.id);
    if (!editing && rows.length >= limit) {
      nbToast(`Limit ${limit} link. Upgrade Premium untuk tambah lebih banyak.`, 'warning');
      return;
    }

    try {
      await NB.save('custom_links', {
        id: editing?.id || NB.uid('lnk'),
        user_id: user.id,
        title: linkTitle.value.trim(),
        url: linkUrl.value.trim(),
        icon: linkIcon.value.trim() || 'bi-link-45deg',
        is_active: linkActive.checked,
        sort_order: editing?.sort_order || Date.now(),
        click_count: editing?.click_count || 0,
        created_at: editing?.created_at || NB.now()
      });

      editing = null;
      linkForm.reset();
      linkIcon.value = 'bi-link-45deg';
      linkActive.checked = true;
      nbToast('Link tersimpan.');
      render();
    } catch (error) {
      nbToast(error.message || 'Gagal simpan link.', 'danger');
    }
  });

  render();
});
