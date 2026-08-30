// NiagaBio Admin Master — Overview panel (stat cards, revenue chart, recent transactions, feeds)
(function () {
  const A = window.NBAdmin;
  const { refs, state, safe, setText, formatDate, timeAgo, requestBadge, platformPremiumRevenue } = A;

  function renderSystemBadges() {
    if (!refs.systemBadges) return;

    const maintenance = state.settings.maintenance_mode
      ? '<span class="badge text-bg-danger"><i class="bi bi-tools me-1"></i>Maintenance ON</span>'
      : '<span class="badge text-bg-success"><i class="bi bi-check-circle me-1"></i>Maintenance OFF</span>';

    const register = state.settings.allow_register
      ? '<span class="badge text-bg-success"><i class="bi bi-person-plus me-1"></i>Register ON</span>'
      : '<span class="badge text-bg-warning"><i class="bi bi-person-x me-1"></i>Register OFF</span>';

    const price = `<span class="badge text-bg-light text-dark border">Premium ${NB.money(state.settings.premium_price || 80000)}</span>`;
    const qris = state.settings.premium_qris_url
      ? '<span class="badge text-bg-success"><i class="bi bi-qr-code me-1"></i>QRIS Upgrade ON</span>'
      : '<span class="badge text-bg-warning"><i class="bi bi-qr-code me-1"></i>QRIS Upgrade kosong</span>';

    const errorTables = Object.keys(state.dataErrors || {});
    const dataError = errorTables.length
      ? `<span class="badge text-bg-danger" title="${safe(errorTables.map(table => `${table}: ${state.dataErrors[table]}`).join(' | '))}"><i class="bi bi-exclamation-triangle me-1"></i>Data gagal dimuat</span>`
      : '';
    refs.systemBadges.innerHTML = `${maintenance}${register}${price}${qris}${dataError}`;
  }

  function renderMetrics() {
    const activeProfiles = state.profiles.filter(profile => !['deleted', 'blocked'].includes(profile.status));
    const premium = activeProfiles.filter(profile => profile.plan === 'premium');
    const free = activeProfiles.filter(profile => profile.plan !== 'premium');
    const inactive = state.profiles.filter(profile => profile.status === 'blocked' || profile.status === 'deleted');
    const pendingRequests = state.premiumRequests.filter(A.isPendingRequest);
    const revenue = platformPremiumRevenue();

    setText(refs.usersMetric, activeProfiles.length);
    setText(refs.premiumMetric, premium.length);
    setText(refs.freeMetric, free.length);
    setText(refs.blockedMetric, inactive.length);
    setText(refs.ordersMetric, pendingRequests.length);
    setText(refs.omsetMetric, NB.money(revenue));
  }

  // ---- Revenue chart: last 6 months, Fee Transaksi Seller vs Pendapatan Premium ----
  function renderRevenueChart() {
    if (!refs.revenueChart) return;

    const months = [];
    const now = new Date();
    for (let i = 5; i >= 0; i -= 1) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({ key: `${d.getFullYear()}-${d.getMonth()}`, label: d.toLocaleDateString('id-ID', { month: 'short' }), fee: 0, premium: 0 });
    }
    const findMonth = date => {
      const d = new Date(date);
      if (Number.isNaN(d.getTime())) return null;
      return months.find(m => m.key === `${d.getFullYear()}-${d.getMonth()}`);
    };

    state.orders.forEach(order => {
      if (String(order.payment_status).toLowerCase() !== 'paid') return;
      const bucket = findMonth(order.paid_at || order.updated_at || order.created_at);
      if (bucket) bucket.fee += Number(order.platform_fee || 0);
    });

    state.premiumRequests.forEach(request => {
      if (!A.isApprovedRequest(request)) return;
      const bucket = findMonth(request.reviewed_at || request.updated_at || request.created_at);
      if (bucket) bucket.premium += Number(request.approved_amount || request.amount || A.premiumPrice());
    });

    const maxValue = Math.max(1, ...months.map(m => m.fee + m.premium));
    if (refs.chartRange) refs.chartRange.textContent = `${months[0].label} - ${months[5].label} ${now.getFullYear()}`;

    refs.revenueChart.innerHTML = months.map(m => {
      const total = m.fee + m.premium;
      const feeH = Math.max(2, Math.round((m.fee / maxValue) * 140));
      const premiumH = Math.max(m.premium > 0 ? 2 : 0, Math.round((m.premium / maxValue) * 140));
      return `
        <div class="am-chart-col">
          <div style="display:flex; align-items:flex-end; gap:4px; height:140px;">
            <div class="am-chart-bar" style="height:${feeH}px; background:var(--am-brand); max-width:20px;">${total > 0 ? `<b>${NB.money(total)}</b>` : ''}</div>
            <div class="am-chart-bar" style="height:${premiumH}px; background:var(--am-sky); max-width:20px;"></div>
          </div>
          <div class="am-chart-label">${safe(m.label)}</div>
        </div>
      `;
    }).join('');
  }

  // ---- Recent transactions (replaces the reference's Calendar & Attendance widget) ----
  function renderRecentTransactions() {
    if (!refs.recentTransactions) return;

    const rows = state.orders.slice(0, 8);
    if (!rows.length) {
      refs.recentTransactions.innerHTML = '<div class="text-muted small">Belum ada transaksi.</div>';
      return;
    }

    refs.recentTransactions.innerHTML = rows.map(order => {
      const status = String(order.payment_status || 'pending').toLowerCase();
      const icon = status === 'paid' ? 'bi-check-circle' : status === 'cancelled' ? 'bi-x-circle' : 'bi-hourglass-split';
      const seller = state.profiles.find(p => p.user_id === order.seller_id);
      return `
        <div class="am-tx-row">
          <span class="am-tx-icon ${safe(status)}"><i class="bi ${icon}"></i></span>
          <div class="am-tx-body">
            <b>${safe(order.product_name || 'Produk')}</b>
            <small>${safe(order.buyer_name || 'Pembeli')} ${seller ? `• @${safe(seller.username || seller.email)}` : ''}</small>
          </div>
          <div class="am-tx-amount">
            <b>${NB.money(order.total_price)}</b>
            <small>${A.timeAgo(order.created_at)}</small>
          </div>
        </div>
      `;
    }).join('');
  }

  function renderActivityFeeds() {
    if (refs.platformLatestPremium) {
      const latestPremium = state.profiles
        .filter(profile => profile.plan === 'premium' && profile.status === 'active')
        .sort((a, b) => String(b.plan_end_date || b.updated_at || '').localeCompare(String(a.plan_end_date || a.updated_at || '')))
        .slice(0, 6);
      refs.platformLatestPremium.innerHTML = latestPremium.map(profile => `
        <div class="admin-feed-row">
          <div><b>${safe(profile.display_name || profile.email || 'User')}</b><small>@${safe(profile.username || '-')}</small></div>
          <span>${formatDate(profile.plan_end_date)}</span>
        </div>
      `).join('') || '<div class="text-muted small">Belum ada user premium.</div>';
    }

    if (refs.platformLatestRequests) {
      const latestRequests = state.premiumRequests.slice(0, 8);
      refs.platformLatestRequests.innerHTML = latestRequests.map(request => `
        <div class="admin-feed-row">
          <div><b>${safe(request.shop_name || request.email || 'Request')}</b><small>${safe(request.email || '-')}</small></div>
          <span>${requestBadge(request.status || 'pending')}</span>
        </div>
      `).join('') || '<div class="text-muted small">Belum ada request premium.</div>';
    }
  }

  A.registerRenderer(() => {
    renderSystemBadges();
    renderMetrics();
    renderRevenueChart();
    renderRecentTransactions();
    renderActivityFeeds();
  });
})();
