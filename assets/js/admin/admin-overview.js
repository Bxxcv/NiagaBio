// NiagaBio Admin Master — Overview panel (hero, pulse feed, KPI, SVG chart, quick actions)
(function () {
  const A = window.NBAdmin;
  const { refs, state, safe, setText, timeAgo } = A;

  const VIEW_TITLES = { overview: 'Ringkasan', users: 'Kelola User', reports: 'Laporan Platform', requests: 'Request Masuk', settings: 'Setting Platform' };

  function renderTopbar() {
    const view = A.initialAdminView();
    setText(refs.topbarSection, VIEW_TITLES[view] || 'Ringkasan');
    setText(refs.topbarTitle, VIEW_TITLES[view] || 'Ringkasan');
    if (refs.topbarDate) {
      refs.topbarDate.textContent = new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    }
  }

  function renderHeroGreeting() {
    if (!refs.heroGreeting) return;
    const hour = new Date().getHours();
    const salutation = hour < 11 ? 'Selamat pagi' : hour < 15 ? 'Selamat siang' : hour < 19 ? 'Selamat sore' : 'Selamat malam';
    const name = state.me?.display_name || 'Admin';
    const pendingRequests = state.premiumRequests.filter(A.isPendingRequest).length;
    refs.heroGreeting.innerHTML = `${salutation}, <em>${safe(name)}.</em><br>${pendingRequests > 0 ? `Ada <em>${pendingRequests}</em> request premium menunggu tinjauan.` : 'Semua request premium sudah ditinjau.'}`;
  }

  function renderSidebarStatus() {
    if (!refs.sidebarStatus) return;
    const maintenance = Boolean(state.settings.maintenance_mode);
    const gatewayOn = state.settings.payment_gateway_enabled !== false;
    const sandbox = state.settings.payment_sandbox !== false;

    const dotEl = refs.sidebarStatus.querySelector('.dot');
    const valEl = refs.sidebarStatus.querySelector('.val');
    if (dotEl) dotEl.className = `dot ${maintenance ? 'warn' : 'ok'} am-pulse`;
    if (valEl) valEl.textContent = maintenance ? 'Maintenance aktif' : 'Semua sistem berjalan';
    setText(refs.sidebarStatusMeta, `Gateway ${gatewayOn ? 'aktif' : 'nonaktif'} · ${sandbox ? 'Sandbox' : 'Live'}`);
  }

  function renderNavBadge() {
    if (!refs.navRequestBadge) return;
    const pendingRequests = state.premiumRequests.filter(A.isPendingRequest).length;
    const pendingReset = state.passwordResetRequests.filter(r => String(r.status || 'pending').toLowerCase() === 'pending').length;
    const total = pendingRequests + pendingReset;
    refs.navRequestBadge.hidden = total === 0;
    refs.navRequestBadge.textContent = String(total);
  }

  function renderMetrics() {
    const activeProfiles = state.profiles.filter(profile => !['deleted', 'blocked'].includes(profile.status));
    const premium = activeProfiles.filter(profile => profile.plan === 'premium');
    const free = activeProfiles.filter(profile => profile.plan !== 'premium');
    const inactive = state.profiles.filter(profile => profile.status === 'blocked' || profile.status === 'deleted');
    const pendingRequests = state.premiumRequests.filter(A.isPendingRequest);
    const revenue = A.platformPremiumRevenue();

    setText(refs.usersMetric, activeProfiles.length);
    setText(refs.premiumMetric, premium.length);
    setText(refs.freeMetric, free.length);
    setText(refs.blockedMetric, inactive.length);
    setText(refs.ordersMetric, pendingRequests.length);
    setText(refs.omsetMetric, NB.money(revenue));

    if (refs.qaUsers) refs.qaUsers.textContent = `${activeProfiles.length} akun terdaftar`;
    if (refs.qaRequests) refs.qaRequests.textContent = `${pendingRequests.length} menunggu persetujuan`;
  }

  // ---- 6-month revenue buckets, reused by chart + omset hint ----
  function monthlyBuckets() {
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
    return months;
  }

  function renderOmsetHint() {
    if (!refs.omsetHint) return;
    const months = monthlyBuckets();
    const thisMonth = months[5].premium;
    const lastMonth = months[4].premium;
    if (lastMonth > 0) {
      const growth = (((thisMonth - lastMonth) / lastMonth) * 100).toFixed(1);
      refs.omsetHint.textContent = `${growth >= 0 ? '+' : ''}${growth}% vs bulan lalu`;
    } else {
      refs.omsetHint.textContent = 'bulan berjalan';
    }
  }

  // ---- SVG revenue chart: bars = fee transaksi, line+area = pendapatan premium ----
  function renderRevenueChart() {
    if (!refs.chartSvg) return;
    const months = monthlyBuckets();
    const totalFee = months.reduce((sum, m) => sum + m.fee, 0);
    const totalPremium = months.reduce((sum, m) => sum + m.premium, 0);
    setText(refs.chartTotal, `Rp${NB.money(totalFee + totalPremium).replace('Rp', '')}`);

    if (refs.chartLegend) {
      refs.chartLegend.innerHTML = `
        <span><span class="sw" style="background:var(--gold)"></span>Fee <b>${NB.money(totalFee)}</b></span>
        <span><span class="sw" style="background:var(--jade)"></span>Premium <b>${NB.money(totalPremium)}</b></span>
      `;
    }

    const maxVal = Math.max(1, ...months.map(m => m.fee + m.premium));
    const W = 100, H = 100;
    const pts = months.map((m, i) => ({
      x: (i / (months.length - 1)) * W,
      y: H - (m.premium / maxVal) * H * 0.9 - 4,
      ...m
    }));

    let pathD = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i += 1) {
      const p0 = pts[i], p1 = pts[i + 1];
      const cx = (p0.x + p1.x) / 2;
      pathD += ` C ${cx} ${p0.y}, ${cx} ${p1.y}, ${p1.x} ${p1.y}`;
    }
    const areaD = `${pathD} L ${W} ${H} L 0 ${H} Z`;

    const barW = (W / months.length) * 0.32;
    const bars = pts.map((p, i) => {
      const barH = (months[i].fee / maxVal) * H * 0.9;
      return `<rect x="${(p.x - barW / 2).toFixed(2)}" y="${(H - barH).toFixed(2)}" width="${barW.toFixed(2)}" height="${barH.toFixed(2)}" rx="0.6" fill="var(--gold)" opacity="0.8"></rect>`;
    }).join('');

    const dots = pts.map((p, i) => `<circle data-i="${i}" cx="${p.x.toFixed(2)}" cy="${p.y.toFixed(2)}" r="1.1" fill="var(--cream)" stroke="var(--jade)" stroke-width="0.5"></circle>`).join('');
    const hitAreas = pts.map((p, i) => `<rect data-i="${i}" x="${(p.x - (W / months.length) / 2).toFixed(2)}" y="0" width="${(W / months.length).toFixed(2)}" height="${H}" fill="transparent" style="cursor:pointer"></rect>`).join('');

    refs.chartSvg.innerHTML = `
      <defs>
        <linearGradient id="amPremGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="var(--jade)" stop-opacity="0.32"></stop>
          <stop offset="100%" stop-color="var(--jade)" stop-opacity="0"></stop>
        </linearGradient>
      </defs>
      ${bars}
      <path d="${areaD}" fill="url(#amPremGrad)"></path>
      <path d="${pathD}" fill="none" stroke="var(--jade)" stroke-width="0.6" stroke-linecap="round" stroke-linejoin="round"></path>
      ${dots}
      ${hitAreas}
    `;

    if (refs.chartGridLines) {
      refs.chartGridLines.innerHTML = [100, 75, 50, 25, 0].map(v => `<div><span>${v}%</span><i></i></div>`).join('');
    }

    if (refs.chartX) {
      refs.chartX.innerHTML = months.map(m => `<span>${safe(m.label)}</span>`).join('');
    }

    if (refs.chartTip) {
      const showTip = (index) => {
        const m = months[index];
        const p = pts[index];
        refs.chartTip.innerHTML = `<div class="lbl">Bulan ${safe(m.label)}</div><div class="amt">${NB.money(m.fee + m.premium)}</div>`;
        refs.chartTip.style.left = `${44 + (p.x / W) * (refs.chartSvg.clientWidth - 44)}px`;
        refs.chartTip.style.top = '0px';
        refs.chartTip.classList.add('show');
        refs.chartX?.querySelectorAll('span').forEach((el, i) => el.classList.toggle('active', i === index));
      };
      const hideTip = () => {
        refs.chartTip.classList.remove('show');
        refs.chartX?.querySelectorAll('span').forEach(el => el.classList.remove('active'));
      };
      refs.chartSvg.querySelectorAll('[data-i]').forEach(el => {
        el.addEventListener('mouseenter', () => showTip(Number(el.dataset.i)));
      });
      refs.chartSvg.addEventListener('mouseleave', hideTip);
    }
  }

  // ---- Unified real activity pulse feed (replaces the reference's mock feed) ----
  function renderPulseFeed() {
    if (!refs.pulseFeed) return;

    const items = [];
    state.orders.slice(0, 10).forEach(order => {
      const status = String(order.payment_status || 'pending').toLowerCase();
      if (status !== 'paid') return;
      items.push({
        time: order.paid_at || order.updated_at || order.created_at,
        text: `Order "${order.product_name || 'Produk'}" dari ${order.buyer_name || 'pembeli'} — ${NB.money(order.total_price)}`,
        icon: 'bi-cash-coin', color: 'var(--jade)'
      });
    });
    state.premiumRequests.slice(0, 10).forEach(request => {
      if (!A.isApprovedRequest(request)) return;
      items.push({
        time: request.reviewed_at || request.updated_at || request.created_at,
        text: `${request.shop_name || request.email || 'User'} upgrade Premium`,
        icon: 'bi-gem', color: 'var(--gold-2)'
      });
    });
    state.passwordResetRequests.slice(0, 10).forEach(request => {
      items.push({
        time: request.created_at,
        text: `Reset password diajukan oleh ${request.display_name || request.email || 'user'}`,
        icon: 'bi-key', color: 'var(--sky)'
      });
    });
    state.profiles.slice(0, 10).forEach(profile => {
      items.push({
        time: profile.created_at,
        text: `User baru: ${profile.display_name || profile.email || 'User'} bergabung`,
        icon: 'bi-person-plus', color: 'var(--ink)'
      });
    });

    items.sort((a, b) => String(b.time || '').localeCompare(String(a.time || '')));
    const top = items.slice(0, 6);

    refs.pulseFeed.innerHTML = top.map(item => `
      <div class="am-pulse-row">
        <div class="am-pulse-icon" style="background:color-mix(in oklab, ${item.color} 14%, var(--cream)); color:${item.color}"><i class="bi ${item.icon}"></i></div>
        <div class="am-pulse-body">
          <div class="txt">${safe(item.text)}</div>
          <div class="t">${timeAgo(item.time)}</div>
        </div>
      </div>
    `).join('') || '<div class="text-muted small">Belum ada aktivitas.</div>';
  }

  A.registerRenderer(() => {
    renderTopbar();
    renderHeroGreeting();
    renderSidebarStatus();
    renderNavBadge();
    renderMetrics();
    renderOmsetHint();
    renderRevenueChart();
    renderPulseFeed();
  });

  A.registerBinder(() => {
    refs.topbarSearchForm?.addEventListener('submit', event => {
      event.preventDefault();
      const q = refs.topbarSearch?.value.trim();
      if (!q) return;
      A.setAdminView('users');
      if (refs.userSearch) {
        refs.userSearch.value = q;
        refs.userSearch.dispatchEvent(new Event('input'));
      }
    });
  });
})();
