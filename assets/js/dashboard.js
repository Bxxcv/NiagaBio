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

    const [products, orders, links, socials, galleryRows, checkoutRows] = await Promise.all([
      NB.list('products', user.id),
      NB.list('orders', user.id, 'seller_id'),
      NB.list('custom_links', user.id),
      NB.list('social_links', user.id),
      NB.list('gallery', user.id),
      NB.list('checkout_settings', user.id)
    ]);

    const checkout = checkoutRows[0] || {};
    const paidOrders = orders.filter(order => order.payment_status === 'paid');
    const pendingOrders = orders.filter(order => order.payment_status === 'pending');
    const revenue = paidOrders.reduce((sum, order) => sum + Number(order.total_price || 0), 0);
    const username = profile?.username || 'demo';
    const publicUrl = `${location.origin}${location.pathname.replace(/[^/]*$/, '')}u.html?username=${encodeURIComponent(username)}`;

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
    const openPublicPage = $('openPublicPage');
    const sidebarPublicPreview = $('sidebarPublicPreview');
    if (publicUrlInput) publicUrlInput.value = publicUrl;
    if (openPublicPage) openPublicPage.href = publicUrl;
    if (sidebarPublicPreview) sidebarPublicPreview.href = publicUrl;

    const copyButton = $('copyPublicUrl');
    if (copyButton) {
      copyButton.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(publicUrl);
          nbToast('Link public toko disalin.');
        } catch (error) {
          publicUrlInput?.select();
          document.execCommand('copy');
          nbToast('Link public toko disalin.');
        }
      });
    }

    setText('planName', premium ? 'Premium' : 'Free');
    setText('planDesc', premium ? 'Semua fitur seller aktif.' : 'Fitur dasar untuk mulai jualan.');
    setText(
      'planExpiry',
      premium
        ? `Aktif sampai ${formatDate(profile?.plan_end_date)}`
        : 'Upgrade untuk membuka gallery, QRIS, tema premium, dan limit lebih besar.'
    );

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
    const checkoutReady = Boolean(checkout.whatsapp_number || checkout.qris_enabled || profile?.whatsapp_number);
    const setupItems = [profileReady, productsReady, linksReady, checkoutReady];
    const setupScore = Math.round((setupItems.filter(Boolean).length / setupItems.length) * 100);

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
  } catch (error) {
    console.error('[Dashboard]', error);
    nbToast(error.message || 'Gagal memuat dashboard.', 'danger');
  }
});
