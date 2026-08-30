// NiagaBio Admin Master — Core (shared refs/state/utils + orchestration)
// Loaded first. Other admin-*.js modules read/write window.NBAdmin.
window.NBAdmin = (function () {
  const $ = id => document.getElementById(id);

  const refs = {
    contentWrap: document.querySelector('.admin-content'),
    refreshBtn: $('adminRefreshBtn'),
    systemBadges: $('adminSystemBadges'),
    usersMetric: $('adminUsers'),
    premiumMetric: $('adminPremium'),
    freeMetric: $('adminFree'),
    blockedMetric: $('adminBlocked'),
    ordersMetric: $('adminOrders'),
    omsetMetric: $('adminOmset'),
    revenueChart: $('adminRevenueChart'),
    chartRange: $('adminChartRange'),
    recentTransactions: $('adminRecentTransactions'),
    userRows: $('userRows'),
    requestRows: $('requestRows'),
    passwordResetRows: $('passwordResetRows'),
    platformRevenueValue: $('platformRevenueValue'),
    platformSellerFeeRevenue: $('platformSellerFeeRevenue'),
    platformTotalRevenue: $('platformTotalRevenue'),
    platformGatewayFee: $('platformGatewayFee'),
    platformWithdrawalReserve: $('platformWithdrawalReserve'),
    platformSellerEarning: $('platformSellerEarning'),
    platformApprovedRequests: $('platformApprovedRequests'),
    platformPendingRequests: $('platformPendingRequests'),
    platformExpiringSoon: $('platformExpiringSoon'),
    platformLatestPremium: $('platformLatestPremium'),
    platformLatestRequests: $('platformLatestRequests'),
    userSearch: $('adminUserSearch'),
    planFilter: $('adminPlanFilter'),
    statusFilter: $('adminStatusFilter'),
    requestSearch: $('adminRequestSearch'),
    requestFilter: $('adminRequestFilter'),
    passwordResetSearch: $('adminPasswordResetSearch'),
    passwordResetFilter: $('adminPasswordResetFilter'),
    userCountInfo: $('adminUserCountInfo'),
    requestCountInfo: $('adminRequestCountInfo'),
    passwordResetCountInfo: $('adminPasswordResetCountInfo'),
    settingsForm: $('adminSettingsForm'),
    maintenanceMode: $('maintenanceMode'),
    allowRegister: $('allowRegister'),
    maintenanceMessage: $('maintenanceMessage'),
    premiumPrice: $('premiumPrice'),
    platformFee: $('platformFee'),
    withdrawalReserve: $('withdrawalReserve'),
    paymentProvider: $('paymentProvider'),
    paymentGatewayEnabled: $('paymentGatewayEnabled'),
    paymentSandbox: $('paymentSandbox'),
    adminWhatsApp: $('adminWhatsApp'),
    premiumQrisUrl: $('adminPremiumQrisUrl'),
    premiumQrisFile: $('adminPremiumQrisFile'),
    premiumNote: $('adminPremiumNote'),
    saveSettingsBtn: $('adminSaveSettingsBtn'),
    resetSettingsBtn: $('adminResetSettingsBtn'),
    clearProcessedRequestsBtn: $('adminClearProcessedRequestsBtn'),
    exportUsersBtn: $('adminExportUsersBtn'),
    exportRequestsBtn: $('adminExportRequestsBtn'),
    printReportBtn: $('adminPrintReportBtn'),
    userModal: $('adminUserModal'),
    userModalTitle: $('adminUserModalTitle'),
    userModalSubtitle: $('adminUserModalSubtitle'),
    userModalBody: $('adminUserModalBody'),
    modalPlanBtn: $('modalPlanBtn'),
    modalBlockBtn: $('modalBlockBtn'),
    modalDeleteBtn: $('modalDeleteBtn')
  };

  const state = {
    currentUser: null,
    me: null,
    profiles: [],
    products: [],
    orders: [],
    premiumRequests: [],
    passwordResetRequests: [],
    settings: {},
    selectedUserId: null,
    loading: false,
    dataErrors: {}
  };

  const userModal = refs.userModal && window.bootstrap
    ? new bootstrap.Modal(refs.userModal)
    : null;

  const safe = value => NB.escapeHtml(value ?? '');

  function proofLink(ref) {
    return ref
      ? `<a class="btn btn-sm btn-outline-nb proof-link is-proof-loading" href="#" data-proof-ref="${safe(ref)}" target="_blank" rel="noopener">Buka Bukti</a>`
      : '<span class="text-muted">-</span>';
  }

  function setText(el, value) {
    if (el) el.textContent = String(value ?? '');
  }

  function premiumPrice() {
    return Number(state.settings.premium_price || (window.NIAGABIO_CONFIG && window.NIAGABIO_CONFIG.PREMIUM_PRICE) || 80000);
  }

  function isApprovedRequest(request) {
    return String(request.status || '').toLowerCase() === 'approved';
  }

  function isPendingRequest(request) {
    return String(request.status || 'pending').toLowerCase() === 'pending';
  }

  function platformPremiumRevenue() {
    return state.premiumRequests
      .filter(isApprovedRequest)
      .reduce((sum, request) => {
        const amount = Number(request.approved_amount || request.amount || 0);
        return sum + (Number.isFinite(amount) && amount > 0 ? amount : premiumPrice());
      }, 0);
  }

  function downloadCsv(filename, rows) {
    const clean = value => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const csv = rows.map(row => row.map(clean).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function formatDate(value) {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  function formatDateTime(value) {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleString('id-ID', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  }

  function timeAgo(value) {
    if (!value) return '-';
    const date = new Date(value).getTime();
    if (Number.isNaN(date)) return '-';
    const diffMin = Math.round((Date.now() - date) / 60000);
    if (diffMin < 1) return 'Baru saja';
    if (diffMin < 60) return `${diffMin} menit lalu`;
    const diffHour = Math.round(diffMin / 60);
    if (diffHour < 24) return `${diffHour} jam lalu`;
    const diffDay = Math.round(diffHour / 24);
    if (diffDay < 7) return `${diffDay} hari lalu`;
    return formatDate(value);
  }

  function planBadge(plan) {
    return plan === 'premium'
      ? '<span class="badge text-bg-success">Premium</span>'
      : '<span class="badge text-bg-light text-dark border">Free</span>';
  }

  function roleBadge(role) {
    return role === 'admin' ? '<span class="badge text-bg-dark ms-1">Admin</span>' : '';
  }

  function statusBadge(status) {
    if (status === 'deleted') return '<span class="badge text-bg-dark">Deleted</span>';
    if (status === 'blocked') return '<span class="badge text-bg-danger">Blocked</span>';
    return '<span class="badge text-bg-success">Active</span>';
  }

  function orderBadge(status) {
    if (status === 'paid') return '<span class="badge text-bg-success">Selesai</span>';
    if (status === 'cancelled') return '<span class="badge text-bg-secondary">Batal</span>';
    return '<span class="badge text-bg-warning">Pending</span>';
  }

  function requestBadge(status) {
    if (status === 'approved') return '<span class="badge text-bg-success">Approved</span>';
    if (status === 'rejected') return '<span class="badge text-bg-danger">Rejected</span>';
    return '<span class="badge text-bg-warning">Pending</span>';
  }

  function passwordResetBadge(status) {
    if (status === 'sent') return '<span class="badge text-bg-primary">Link Terkirim</span>';
    if (status === 'done') return '<span class="badge text-bg-success">Selesai</span>';
    if (status === 'cancelled') return '<span class="badge text-bg-secondary">Dibatalkan</span>';
    return '<span class="badge text-bg-warning">Pending</span>';
  }

  function showAccessDenied() {
    const target = refs.contentWrap || document.querySelector('.admin-content') || document.querySelector('.admin-main');
    if (!target) return;
    target.innerHTML = `
      <section class="card-nb p-4 p-md-5 text-center admin-denied-card">
        <div class="icon-bubble mx-auto mb-3"><i class="bi bi-shield-lock"></i></div>
        <h2 class="fw-black mb-2">Akses ditolak</h2>
        <p class="text-muted mb-4">Halaman ini khusus admin NiagaBio. Login memakai akun admin master.</p>
        <a href="dashboard" class="nb-btn nb-btn--primary">Kembali ke Dashboard</a>
      </section>
    `;
  }

  function setLoading(isLoading) {
    state.loading = isLoading;
    if (refs.refreshBtn) {
      refs.refreshBtn.disabled = isLoading;
      refs.refreshBtn.innerHTML = isLoading
        ? '<span class="spinner-border spinner-border-sm me-1"></span>Memuat'
        : '<i class="bi bi-arrow-clockwise me-1"></i>Refresh';
    }
  }

  async function safeAll(table) {
    try {
      return await NB.all(table);
    } catch (error) {
      state.dataErrors = state.dataErrors || {};
      state.dataErrors[table] = error.message || `Gagal load ${table}`;
      console.warn(`[NiagaBio] Gagal load ${table}:`, error.message);
      return [];
    }
  }

  async function loadData() {
    state.dataErrors = {};
    const [profiles, orders, products, premiumRequests, passwordResetRequests] = await Promise.all([
      NB.all('profiles'),
      NB.all('orders'),
      safeAll('products'),
      safeAll('premium_requests'),
      NB.listPasswordResetRequests ? NB.listPasswordResetRequests() : []
    ]);

    state.profiles = profiles;
    state.orders = orders;
    state.products = products;
    state.premiumRequests = premiumRequests;
    state.passwordResetRequests = passwordResetRequests;
    state.settings = await NB.getSettings();

    state.profiles.sort((a, b) => {
      if (a.role === 'admin' && b.role !== 'admin') return -1;
      if (a.role !== 'admin' && b.role === 'admin') return 1;
      return String(b.created_at || '').localeCompare(String(a.created_at || ''));
    });

    state.premiumRequests.sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
    state.passwordResetRequests.sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
    state.orders.sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
  }

  // ---- render/bind registries populated by admin-overview/users/reports/requests/settings.js ----
  const renderers = [];
  const binders = [];
  function registerRenderer(fn) { renderers.push(fn); }
  function registerBinder(fn) { binders.push(fn); }

  function renderAll() { renderers.forEach(fn => fn()); }
  function bindAll() { binders.forEach(fn => fn()); }

  async function refresh() {
    if (state.loading) return;
    setLoading(true);
    try {
      await loadData();
      renderAll();
    } catch (error) {
      nbToast(error.message || 'Gagal memuat data admin.', 'danger');
    } finally {
      setLoading(false);
    }
  }

  function setAdminView(view = 'overview') {
    const allowed = ['overview', 'users', 'reports', 'requests', 'settings'];
    const activeView = allowed.includes(view) ? view : 'overview';

    document.querySelectorAll('[data-admin-panel]').forEach(panel => {
      const isActive = panel.dataset.adminPanel === activeView;
      panel.hidden = !isActive;
      panel.classList.toggle('active', isActive);
    });

    document.querySelectorAll('[data-admin-view], [data-admin-view-target]').forEach(item => {
      const itemView = item.dataset.adminView || item.dataset.adminViewTarget;
      item.classList.toggle('active', itemView === activeView);
    });

    if (location.hash !== `#${activeView}`) {
      history.replaceState(null, '', `#${activeView}`);
    }

    const sidebar = document.querySelector('.sidebar');
    sidebar?.classList.remove('show');
    document.body.classList.remove('sidebar-open');

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function initialAdminView() {
    const hash = String(location.hash || '').replace('#', '');
    return ['overview', 'users', 'reports', 'requests', 'settings'].includes(hash) ? hash : 'overview';
  }

  function bindCoreEvents() {
    refs.refreshBtn?.addEventListener('click', refresh);

    document.querySelectorAll('[data-admin-view]').forEach(link => {
      link.addEventListener('click', event => {
        event.preventDefault();
        setAdminView(link.dataset.adminView || 'overview');
      });
    });

    document.querySelectorAll('[data-admin-view-target]').forEach(button => {
      button.addEventListener('click', () => setAdminView(button.dataset.adminViewTarget || 'overview'));
    });

    window.addEventListener('hashchange', () => setAdminView(initialAdminView()));
  }

  return {
    $, refs, state, userModal, safe, proofLink, setText, premiumPrice,
    isApprovedRequest, isPendingRequest, platformPremiumRevenue, downloadCsv,
    formatDate, formatDateTime, timeAgo, planBadge, roleBadge, statusBadge,
    orderBadge, requestBadge, passwordResetBadge, showAccessDenied, setLoading,
    refresh, setAdminView, initialAdminView, bindCoreEvents,
    registerRenderer, registerBinder, renderAll, bindAll
  };
})();
