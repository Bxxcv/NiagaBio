document.addEventListener('DOMContentLoaded', async () => {
  setActiveSide('dashboard');

  const user = await NB.requireAuth();
  if (!user) return;

  const $ = id => document.getElementById(id);
  const setText = (id, value) => {
    const element = $(id);
    if (element) element.textContent = value;
  };
  const setWidth = (id, value) => {
    const element = $(id);
    if (element) element.style.width = `${Math.max(0, Math.min(100, value))}%`;
  };
  const percent = (value, max) => {
    if (!max || max <= 0) return value > 0 ? 100 : 0;
    return Math.round((Number(value || 0) / Number(max)) * 100);
  };
  const formatDate = value => {
    if (!value) return '-';
    return new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value));
  };
  const statusBadge = status => {
    const safeStatus = NB.escapeHtml(status || 'pending');
    const className = status === 'paid'
      ? 'text-bg-success'
      : status === 'cancelled'
        ? 'text-bg-secondary'
        : 'text-bg-warning';
    return `<span class="badge ${className}">${safeStatus}</span>`;
  };

  function setSetupItem(id, done) {
    const item = $(id);
    if (!item) return;
    item.classList.toggle('done', Boolean(done));
    const icon = item.querySelector('.setup-icon i');
    if (icon) icon.className = done ? 'bi bi-check-lg' : icon.dataset.defaultIcon || icon.className;
  }

  function fillLimit(prefix, count, max) {
    const unlimited = Number(max || 0) >= 99;
    const label = unlimited ? `${count} / ${max}` : `${count} / ${max}`;
    setText(`${prefix}Text`, label);
    setWidth(`${prefix}Bar`, unlimited ? Math.min(100, percent(count, max)) : percent(count, max));
  }

  try {
    const profile = await NB.getProfile(user.id);
    const premium = NB.isPremium(profile);
    const limits = NB.getLimits(premium ? 'premium' : 'free');

    const [products, orders, links, socials, galleryRows] = await Promise.all([
      NB.list('products', user.id),
      NB.list('orders', user.id, 'seller_id'),
      NB.list('custom_links', user.id),
      NB.list('social_links', user.id),
      NB.list('gallery', user.id)
    ]);

    const paidOrders = orders.filter(order => order.payment_status === 'paid');
    const pendingOrders = orders.filter(order => order.payment_status === 'pending');
    const revenue = paidOrders.reduce((sum, order) => sum + Number(order.total_price || 0), 0);
    const username = profile?.username || 'demo';
    const publicUrl = `${location.origin}${location.pathname.replace(/[^/]*$/, '')}u?username=${encodeURIComponent(username)}`;

    document.querySelectorAll('[data-user-name]').forEach(element => {
      element.textContent = profile?.display_name || user.email;
    });
    document.querySelectorAll('[data-plan]').forEach(element => {
      element.textContent = premium ? 'Premium' : 'Free';
      element.className = 'badge-soft';
    });

    setText('metricProducts', products.length);
    setText('metricOrders', orders.length);
    setText('metricPending', pendingOrders.length);
    setText('metricRevenue', NB.money(revenue));
    setText('metricLinks', links.length);
    setText('metricSocial', socials.length);
    setText('metricGallery', galleryRows.length);

    const publicUrlInput = $('publicUrlInput');
    const publicUrlText = $('publicUrlText');
    const openPublicPage = $('openPublicPage');
    const openPublicPageHero = $('openPublicPageHero');
    const sidebarPublicPreview = $('sidebarPublicPreview');
    if (publicUrlInput) publicUrlInput.value = publicUrl;
    if (publicUrlText) publicUrlText.textContent = publicUrl;
    if (openPublicPage) openPublicPage.href = publicUrl;
    if (openPublicPageHero) openPublicPageHero.href = publicUrl;
    if (sidebarPublicPreview) sidebarPublicPreview.href = publicUrl;

    setText('planName', premium ? 'Premium' : 'Free');
    setText('planDesc', premium ? 'Semua fitur seller aktif.' : 'Fitur dasar untuk mulai jualan.');
    setText(
      'planExpiry',
      premium
        ? `Aktif sampai ${formatDate(profile?.plan_end_date)}`
        : 'Upgrade untuk membuka gallery, QRIS, tema premium, dan limit lebih besar.'
    );
    const upgradeButton = $('dashboardUpgradeBtn');
    if (upgradeButton) upgradeButton.classList.toggle('d-none', premium);

    fillLimit('limitProducts', products.length, limits.products);
    fillLimit('limitLinks', links.length, limits.links);
    fillLimit('limitSocial', socials.length, limits.socials);
    fillLimit('limitGallery', galleryRows.length, limits.gallery);
    setText(
      'limitNotice',
      premium
        ? 'Premium aktif. Kamu bisa pakai katalog besar, gallery, QRIS, dan tema niche.'
        : 'Free cukup untuk mulai. Premium membuka katalog besar, gallery, QRIS, dan tema niche.'
    );

    const profileReady = Boolean(profile?.display_name && profile?.username && profile?.whatsapp_number);
    const productsReady = products.length > 0;
    const linksReady = links.length > 0 || socials.length > 0;
    const checkoutReady = Boolean(profile?.whatsapp_number);
    const setupItems = [profileReady, productsReady, linksReady, checkoutReady];
    const setupScore = Math.round((setupItems.filter(Boolean).length / setupItems.length) * 100);

    const nextSteps = [
      {
        done: profileReady,
        title: 'Lengkapi profil toko',
        desc: 'Isi nama toko, username, WhatsApp, dan bio supaya pembeli tahu toko kamu.',
        href: 'profile',
        label: 'Lengkapi profil'
      },
      {
        done: productsReady,
        title: 'Tambah produk pertama',
        desc: 'Produk pertama bikin halaman toko kamu langsung bisa dipakai untuk menerima order.',
        href: 'products',
        label: 'Tambah produk'
      },
      {
        done: linksReady,
        title: 'Tambahkan link atau sosial',
        desc: 'Masukkan WhatsApp, Shopee, Instagram, katalog, atau link penting lainnya.',
        href: 'links',
        label: 'Tambah link'
      },
      {
        done: checkoutReady,
        title: 'Lengkapi nomor WhatsApp',
        desc: 'Pastikan nomor WhatsApp toko aktif supaya pembeli bisa menghubungi kamu.',
        href: 'profile',
        label: 'Lengkapi WhatsApp'
      }
    ];
    const nextStep = nextSteps.find(step => !step.done) || {
      title: 'Toko kamu siap dibagikan',
      desc: 'Semua langkah dasar sudah lengkap. Cek halaman toko, lalu bagikan ke calon pembeli.',
      href: publicUrl,
      label: 'Cek toko'
    };
    setText('nextStepTitle', nextStep.title);
    setText('nextStepDesc', nextStep.desc);
    const nextAction = $('nextStepAction');
    if (nextAction) {
      nextAction.href = nextStep.href;
      nextAction.innerHTML = `<i class="bi bi-arrow-right-circle me-1"></i>${NB.escapeHtml(nextStep.label)}`;
      if (nextStep.href === publicUrl) {
        nextAction.target = '_blank';
        nextAction.rel = 'noopener';
      } else {
        nextAction.removeAttribute('target');
        nextAction.removeAttribute('rel');
      }
    }

    setSetupItem('setupProfile', profileReady);
    setSetupItem('setupProducts', productsReady);
    setSetupItem('setupLinks', linksReady);
    setSetupItem('setupCheckout', checkoutReady);
    setText('setupProgressText', `${setupScore}%`);
    setWidth('setupProgressBar', setupScore);

    const recentOrders = $('recentOrders');
    if (recentOrders) {
      recentOrders.innerHTML = orders.slice(0, 5).map(order => `
        <tr>
          <td>
            <div class="fw-bold">${NB.escapeHtml(order.product_name || '-')}</div>
            <small class="text-muted">Qty ${Number(order.quantity || 1)}</small>
          </td>
          <td>
            <div>${NB.escapeHtml(order.buyer_name || '-')}</div>
            <small class="text-muted">${NB.escapeHtml(order.buyer_phone || '-')}</small>
          </td>
          <td class="fw-bold">${NB.money(order.total_price)}</td>
          <td>${statusBadge(order.payment_status)}</td>
        </tr>
      `).join('') || '<tr><td colspan="4" class="text-center text-muted py-4">Belum ada pesanan.</td></tr>';
    }

    renderTopProducts(paidOrders);
    renderPeakHours(orders);
  } catch (error) {
    console.error('[Dashboard]', error);
    nbToast(error.message || 'Gagal memuat dashboard.', 'danger');
  }

  function renderTopProducts(paidOrdersList) {
    const el = $('topProducts');
    if (!el) return;
    if (!paidOrdersList.length) {
      el.innerHTML = '<p class="text-center nb-text-muted py-3 mb-0">Belum ada order yang dibayar.</p>';
      return;
    }
    const totals = new Map();
    paidOrdersList.forEach(order => {
      const key = order.product_name || 'Produk tanpa nama';
      const qty = Number(order.quantity || 1);
      totals.set(key, (totals.get(key) || 0) + qty);
    });
    const ranked = Array.from(totals.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const maxQty = ranked[0][1];
    el.innerHTML = ranked.map(([name, qty], index) => `
      <div class="d-flex align-items-center gap-3">
        <div class="nb-text-sm fw-bold" style="width:20px">${index + 1}</div>
        <div class="flex-fill">
          <div class="d-flex justify-content-between nb-text-sm mb-1">
            <span class="fw-semibold">${NB.escapeHtml(name)}</span>
            <span class="nb-text-muted">${qty} terjual</span>
          </div>
          <div class="progress" style="height:6px"><div class="progress-bar bg-success" style="width:${Math.max(6, Math.round((qty / maxQty) * 100))}%"></div></div>
        </div>
      </div>
    `).join('');
  }

  function renderPeakHours(allOrders) {
    const el = $('peakHours');
    if (!el) return;
    if (!allOrders.length) {
      el.innerHTML = '<p class="text-center nb-text-muted py-3 mb-0">Belum ada data order.</p>';
      return;
    }
    const buckets = new Array(24).fill(0);
    allOrders.forEach(order => {
      if (!order.created_at) return;
      const hour = new Date(order.created_at).getHours();
      if (Number.isFinite(hour)) buckets[hour] += 1;
    });
    const maxCount = Math.max(...buckets, 1);
    const top = buckets
      .map((count, hour) => ({ hour, count }))
      .filter(item => item.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
    if (!top.length) {
      el.innerHTML = '<p class="text-center nb-text-muted py-3 mb-0">Belum ada data order.</p>';
      return;
    }
    el.innerHTML = top.map(({ hour, count }) => `
      <div class="d-flex align-items-center gap-3">
        <div class="nb-text-sm fw-bold" style="width:56px">${String(hour).padStart(2, '0')}:00</div>
        <div class="flex-fill">
          <div class="progress" style="height:14px">
            <div class="progress-bar bg-success" style="width:${Math.max(8, Math.round((count / maxCount) * 100))}%"></div>
          </div>
        </div>
        <div class="nb-text-sm nb-text-muted" style="width:70px text-align:right">${count} order</div>
      </div>
    `).join('');
  }
});
