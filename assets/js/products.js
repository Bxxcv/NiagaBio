document.addEventListener('DOMContentLoaded', async () => {
  setActiveSide('products');

  const user = await NB.requireAuth();
  if (!user) return;

  const profile = await NB.getProfile(user.id);
  const limit = NB.getLimits(NB.isPremium(profile) ? 'premium' : 'free').products;
  productLimitInfo.textContent = `${NB.isPremium(profile) ? 'Premium' : 'Free'}: maksimal ${limit} produk`;

  let editing = null;

  async function render() {
    const rows = await NB.list('products', user.id);
    productCount.textContent = rows.length;
    productRows.innerHTML = rows.map(product => `
      <tr>
        <td>
          <img class="preview-img me-2" src="${NB.safeImageUrl(product.image_url || 'assets/img/placeholders/product.svg')}" alt="">
          <span class="fw-bold">${NB.escapeHtml(product.name)}</span>
        </td>
        <td>${NB.escapeHtml(product.category || '-')}</td>
        <td>${NB.money(product.price)}</td>
        <td>${product.is_featured ? '<span class="badge text-bg-success">Unggulan</span>' : '<span class="badge text-bg-light text-dark">Normal</span>'}</td>
        <td class="text-end">
          <button class="btn btn-sm btn-outline-nb" data-share-product="${product.id}"><i class="bi bi-share me-1"></i>Share</button>
          <button class="btn btn-sm btn-outline-nb" data-edit="${product.id}">Edit</button>
          <button class="btn btn-sm btn-outline-danger" data-del="${product.id}">Hapus</button>
        </td>
      </tr>
    `).join('') || `<tr><td colspan="5"><div class="table-empty-action"><i class="bi bi-bag-plus"></i><b>Belum ada produk</b><span>Tambahkan produk pertama supaya toko kamu bisa menerima order.</span><a href="products" class="btn btn-nb btn-sm">Tambah Produk</a></div></td></tr>`;

    document.querySelectorAll('[data-share-product]').forEach(button => {
      button.addEventListener('click', () => shareProduct(rows.find(item => item.id === button.dataset.shareProduct)));
    });

    document.querySelectorAll('[data-edit]').forEach(button => {
      button.addEventListener('click', () => fill(rows.find(item => item.id === button.dataset.edit)));
    });

    document.querySelectorAll('[data-del]').forEach(button => {
      button.addEventListener('click', async () => {
        if (!confirm('Hapus produk ini?')) return;
        try {
          await NB.remove('products', button.dataset.del);
          nbToast('Produk dihapus.');
          render();
        } catch (error) {
          nbToast(error.message || 'Gagal hapus produk.', 'danger');
        }
      });
    });
  }

  async function shareProduct(product) {
    if (!product) return;
    if (!profile?.username) {
      nbToast('Username toko belum tersedia. Lengkapi profil toko dulu.', 'warning');
      return;
    }

    const url = `${location.origin}/s/${encodeURIComponent(profile.username)}/${encodeURIComponent(product.id)}`;
    const title = `${product.name} - ${profile.display_name || profile.username}`;
    const text = product.description
      ? `${product.name} - ${product.description}`
      : `${product.name} - ${NB.money(product.price)} dari ${profile.display_name || profile.username}`;

    try {
      if (navigator.share) {
        await navigator.share({ title, text, url });
        return;
      }

      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        nbToast('Link produk disalin.');
        return;
      }

      window.prompt('Salin link produk:', url);
    } catch (error) {
      if (error.name !== 'AbortError') nbToast('Gagal membagikan produk.', 'warning');
    }
  }

  function fill(product) {
    if (!product) return;
    editing = product;
    productName.value = product.name || '';
    productPrice.value = product.price || '';
    productCategory.value = product.category || '';
    productDescription.value = product.description || '';
    productFeatured.checked = Boolean(product.is_featured);
    productFormTitle.textContent = 'Edit Produk';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  resetProduct.addEventListener('click', () => {
    editing = null;
    productForm.reset();
    productFormTitle.textContent = 'Tambah Produk';
  });

  productForm.addEventListener('submit', async event => {
    event.preventDefault();
    const rows = await NB.list('products', user.id);
    if (!editing && rows.length >= limit) {
      nbToast(`Limit ${limit} produk. Upgrade Premium untuk sampai 500 produk.`, 'warning');
      return;
    }

    const button = productForm.querySelector('button[type="submit"]');
    button.disabled = true;

    try {
      let imageUrl = editing?.image_url || 'assets/img/placeholders/product.svg';
      if (productImage.files[0]) imageUrl = await NB.uploadFile(productImage.files[0], 'products');

      await NB.save('products', {
        id: editing?.id || NB.uid('prd'),
        user_id: user.id,
        name: productName.value.trim(),
        price: Number(productPrice.value || 0),
        category: productCategory.value.trim(),
        description: productDescription.value.trim(),
        image_url: imageUrl,
        is_active: true,
        is_featured: productFeatured.checked,
        sort_order: editing?.sort_order || Date.now(),
        created_at: editing?.created_at || NB.now()
      });

      editing = null;
      productForm.reset();
      productFormTitle.textContent = 'Tambah Produk';
      nbToast('Produk tersimpan.');
      render();
    } catch (error) {
      nbToast(error.message || 'Gagal simpan produk.', 'danger');
    } finally {
      button.disabled = false;
    }
  });

  render();
});
