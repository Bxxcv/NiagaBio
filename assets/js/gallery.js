document.addEventListener('DOMContentLoaded', async () => {
  setActiveSide('gallery');

  const user = await NB.requireAuth();
  if (!user) return;

  const profile = await NB.getProfile(user.id);
  const premium = NB.isPremium(profile);
  const limit = NB.getLimits(premium ? 'premium' : 'free').gallery;

  if (!premium) {
    const galleryGate = document.getElementById('galleryGate');
    const galleryContent = document.getElementById('galleryContent');
    if (galleryGate) galleryGate.classList.remove('d-none');
    if (galleryContent) galleryContent.classList.add('d-none');
    return;
  }

  async function render() {
    const rows = await NB.list('gallery', user.id);
    const galleryGrid = document.getElementById('galleryGrid');
    const galleryForm = document.getElementById('galleryForm');
    const galleryImage = document.getElementById('galleryImage');
    const galleryCaption = document.getElementById('galleryCaption');

    if (!galleryGrid || !galleryForm || !galleryImage || !galleryCaption) {
      console.error('Gallery elements not found');
      return;
    }

    galleryGrid.innerHTML = rows.map(item => `
      <div class="col-6 col-md-4 col-xl-3">
        <div class="product-card gallery-manage-card">
          <img src="${NB.safeImageUrl(item.image_url)}" alt="">
          <div class="pbody">
            <p class="fw-bold mb-2">${NB.escapeHtml(item.caption || 'Gallery')}</p>
            <button class="nb-btn nb-btn-danger nb-btn-sm" data-del="${item.id}">Hapus</button>
          </div>
        </div>
      </div>
    `).join('') || `<div class="col-12"><div class="empty-state empty-action"><i class="bi bi-images"></i><b>Belum ada gallery</b><span>Upload foto produk, testimoni, atau portfolio supaya toko terlihat lebih meyakinkan.</span></div></div>`;

    galleryGrid.querySelectorAll('[data-del]').forEach(button => {
      button.addEventListener('click', async () => {
        if (!confirm('Hapus foto?')) return;
        try {
          await NB.remove('gallery', button.dataset.del);
          nbToast('Gallery dihapus.');
          render();
        } catch (error) {
          nbToast(error.message || 'Gagal hapus gallery.', 'danger');
        }
      });
    });
  }

  galleryForm.addEventListener('submit', async event => {
    event.preventDefault();
    const rows = await NB.list('gallery', user.id);

    if (rows.length >= limit) {
      nbToast(`Limit gallery Premium adalah ${limit} foto.`, 'warning');
      return;
    }

    if (!galleryImage.files[0]) {
      nbToast('Pilih gambar dulu.', 'warning');
      return;
    }

    const submitButton = galleryForm.querySelector('button[type="submit"]');
    submitButton.disabled = true;

    try {
      const imageUrl = await NB.uploadFile(galleryImage.files[0], 'gallery');
      await NB.save('gallery', {
        id: NB.uid('gal'),
        user_id: user.id,
        image_url: imageUrl,
        caption: galleryCaption.value.trim(),
        sort_order: Date.now(),
        created_at: NB.now()
      });

      galleryForm.reset();
      nbToast('Gallery ditambahkan.');
      render();
    } catch (error) {
      nbToast(error.message || 'Gagal upload gallery.', 'danger');
    } finally {
      submitButton.disabled = false;
    }
  });

  render();
});
