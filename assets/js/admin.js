document.addEventListener('DOMContentLoaded', async () => {
  const $ = id => document.getElementById(id);

  const refs = {
    contentWrap: document.querySelector('.content-wrap'),
    refreshBtn: $('adminRefreshBtn'),
    systemBadges: $('adminSystemBadges'),
    usersMetric: $('adminUsers'),
    premiumMetric: $('adminPremium'),
    freeMetric: $('adminFree'),
    blockedMetric: $('adminBlocked'),
    ordersMetric: $('adminOrders'),
    omsetMetric: $('adminOmset'),
    userRows: $('userRows'),
    orderRows: $('orderRows'),
    userSearch: $('adminUserSearch'),
    planFilter: $('adminPlanFilter'),
    statusFilter: $('adminStatusFilter'),
    orderSearch: $('adminOrderSearch'),
    orderFilter: $('adminOrderFilter'),
    userCountInfo: $('adminUserCountInfo'),
    orderCountInfo: $('adminOrderCountInfo'),
    settingsForm: $('adminSettingsForm'),
    maintenanceMode: $('maintenanceMode'),
    allowRegister: $('allowRegister'),
    maintenanceMessage: $('maintenanceMessage'),
    premiumPrice: $('premiumPrice'),
    adminWhatsApp: $('adminWhatsApp'),
    saveSettingsBtn: $('adminSaveSettingsBtn'),
    resetSettingsBtn: $('adminResetSettingsBtn'),
    userModal: $('adminUserModal'),
    userModalTitle: $('adminUserModalTitle'),
    userModalSubtitle: $('adminUserModalSubtitle'),
    userModalBody: $('adminUserModalBody'),
    modalPlanBtn: $('modalPlanBtn'),
    modalBlockBtn: $('modalBlockBtn')
  };

  const state = {
    currentUser: null,
    me: null,
    profiles: [],
    orders: [],
    settings: {},
    selectedUserId: null,
    loading: false
  };

  const userModal = refs.userModal && window.bootstrap
    ? new bootstrap.Modal(refs.userModal)
    : null;

  function safe(value) {
    return NB.escapeHtml(value ?? '');
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
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  function planBadge(plan) {
    return plan === 'premium'
      ? '<span class="badge text-bg-success">Premium</span>'
      : '<span class="badge text-bg-light text-dark border">Free</span>';
  }

  function roleBadge(role) {
    return role === 'admin'
      ? '<span class="badge text-bg-dark ms-1">Admin</span>'
      : '';
  }

  function statusBadge(status) {
    return status === 'blocked'
      ? '<span class="badge text-bg-danger">Blocked</span>'
      : '<span class="badge text-bg-success">Active</span>';
  }

  function orderBadge(status) {
    if (status === 'paid') return '<span class="badge text-bg-success">Paid</span>';
    if (status === 'cancelled') return '<span class="badge text-bg-secondary">Cancelled</span>';
    return '<span class="badge text-bg-warning">Pending</span>';
  }

  function showAccessDenied() {
    if (!refs.contentWrap) return;

    refs.contentWrap.innerHTML = `
      <section class="card-nb p-4 p-md-5 text-center admin-denied-card">
        <div class="icon-bubble mx-auto mb-3">
          <i class="bi bi-shield-lock"></i>
        </div>
        <h2 class="fw-black mb-2">Akses ditolak</h2>
        <p class="text-muted mb-4">Halaman ini khusus admin NiagaBio. Login memakai akun admin master.</p>
        <a href="dashboard.html" class="btn btn-nb">Kembali ke Dashboard</a>
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

  async function loadData() {
    state.profiles = await NB.all('profiles');
    state.orders = await NB.all('orders');
    state.settings = await NB.getSettings();

    state.profiles.sort((a, b) => {
      if (a.role === 'admin' && b.role !== 'admin') return -1;
      if (a.role !== 'admin' && b.role === 'admin') return 1;
      return String(b.created_at || '').localeCompare(String(a.created_at || ''));
    });
  }

  function renderSystemBadges() {
    if (!refs.systemBadges) return;

    const maintenance = state.settings.maintenance_mode
      ? '<span class="badge text-bg-danger"><i class="bi bi-tools me-1"></i>Maintenance ON</span>'
      : '<span class="badge text-bg-success"><i class="bi bi-check-circle me-1"></i>Maintenance OFF</span>';

    const register = state.settings.allow_register
      ? '<span class="badge text-bg-success"><i class="bi bi-person-plus me-1"></i>Register ON</span>'
      : '<span class="badge text-bg-warning"><i class="bi bi-person-x me-1"></i>Register OFF</span>';

    const price = `<span class="badge text-bg-light text-dark border">Premium ${NB.money(state.settings.premium_price || 80000)}</span>`;

    refs.systemBadges.innerHTML = `${maintenance}${register}${price}`;
  }

  function renderMetrics() {
    const premium = state.profiles.filter(profile => profile.plan === 'premium');
    const free = state.profiles.filter(profile => profile.plan !== 'premium');
    const blocked = state.profiles.filter(profile => profile.status === 'blocked');
    const paidOrders = state.orders.filter(order => order.payment_status === 'paid');
    const omset = paidOrders.reduce((sum, order) => sum + Number(order.total_price || 0), 0);

    if (refs.usersMetric) refs.usersMetric.textContent = state.profiles.length;
    if (refs.premiumMetric) refs.premiumMetric.textContent = premium.length;
    if (refs.freeMetric) refs.freeMetric.textContent = free.length;
    if (refs.blockedMetric) refs.blockedMetric.textContent = blocked.length;
    if (refs.ordersMetric) refs.ordersMetric.textContent = state.orders.length;
    if (refs.omsetMetric) refs.omsetMetric.textContent = NB.money(omset);
  }

  function filteredProfiles() {
    const keyword = (refs.userSearch?.value || '').trim().toLowerCase();
    const plan = refs.planFilter?.value || 'all';
    const status = refs.statusFilter?.value || 'all';

    return state.profiles.filter(profile => {
      const text = [
        profile.display_name,
        profile.email,
        profile.username,
        profile.whatsapp_number,
        profile.role,
        profile.plan,
        profile.status
      ].join(' ').toLowerCase();

      const matchKeyword = !keyword || text.includes(keyword);
      const matchPlan = plan === 'all' || profile.plan === plan;
      const matchStatus = status === 'all' || (profile.status || 'active') === status;

      return matchKeyword && matchPlan && matchStatus;
    });
  }

  function renderUsers() {
    if (!refs.userRows) return;

    const rows = filteredProfiles();
    if (refs.userCountInfo) refs.userCountInfo.textContent = `${rows.length} user tampil`;

    refs.userRows.innerHTML = rows.map(profile => {
      const isSelf = profile.user_id === state.currentUser?.id;
      const publicUrl = profile.username ? `u.html?username=${encodeURIComponent(profile.username)}` : '#';

      return `
        <tr>
          <td>
            <div class="admin-user-cell">
              <img src="${safe(profile.avatar_url || 'assets/img/logo.jpg')}" alt="" class="admin-user-avatar">
              <div>
                <div class="fw-bold">${safe(profile.display_name || 'User NiagaBio')} ${roleBadge(profile.role)}</div>
                <small class="text-muted">${safe(profile.email || '-')}</small>
              </div>
            </div>
          </td>
          <td>
            <div class="fw-semibold">@${safe(profile.username || '-')}</div>
            ${profile.username ? `<a class="small" href="${publicUrl}" target="_blank" rel="noopener">Lihat toko</a>` : '<small class="text-muted">Belum ada username</small>'}
          </td>
          <td>${planBadge(profile.plan)}</td>
          <td>${statusBadge(profile.status || 'active')}</td>
          <td class="small">${formatDate(profile.plan_end_date)}</td>
          <td class="text-end">
            <div class="admin-action-row justify-content-end">
              <button class="btn btn-sm btn-outline-nb" type="button" data-user-detail="${safe(profile.user_id)}">
                Detail
              </button>
              <button class="btn btn-sm ${profile.plan === 'premium' ? 'btn-outline-secondary' : 'btn-success'}" type="button" data-user-plan="${safe(profile.user_id)}" ${isSelf ? 'disabled' : ''}>
                ${profile.plan === 'premium' ? 'Set Free' : 'Premium'}
              </button>
              <button class="btn btn-sm ${profile.status === 'blocked' ? 'btn-outline-success' : 'btn-outline-danger'}" type="button" data-user-block="${safe(profile.user_id)}" ${isSelf ? 'disabled' : ''}>
                ${profile.status === 'blocked' ? 'Unblock' : 'Blokir'}
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('') || '<tr><td colspan="6" class="text-center text-muted py-4">User tidak ditemukan.</td></tr>';

    refs.userRows.querySelectorAll('[data-user-detail]').forEach(button => {
      button.addEventListener('click', () => openUserDetail(button.dataset.userDetail));
    });

    refs.userRows.querySelectorAll('[data-user-plan]').forEach(button => {
      button.addEventListener('click', () => togglePremium(button.dataset.userPlan));
    });

    refs.userRows.querySelectorAll('[data-user-block]').forEach(button => {
      button.addEventListener('click', () => toggleBlock(button.dataset.userBlock));
    });
  }

  function filteredOrders() {
    const status = refs.orderFilter?.value || 'all';
    const keyword = (refs.orderSearch?.value || '').trim().toLowerCase();

    return state.orders.filter(order => {
      const text = [
        order.product_name,
        order.buyer_name,
        order.buyer_phone,
        order.payment_method,
        order.payment_status
      ].join(' ').toLowerCase();

      const matchStatus = status === 'all' || order.payment_status === status;
      const matchKeyword = !keyword || text.includes(keyword);

      return matchStatus && matchKeyword;
    });
  }

  function renderOrders() {
    if (!refs.orderRows) return;

    const rows = filteredOrders().slice(0, 150);
    if (refs.orderCountInfo) refs.orderCountInfo.textContent = `${rows.length} order tampil`;

    refs.orderRows.innerHTML = rows.map(order => `
      <tr>
        <td>
          <div class="fw-bold">${safe(order.product_name || 'Produk')}</div>
          <small class="text-muted">${formatDateTime(order.created_at)}</small>
        </td>
        <td>
          <div class="fw-semibold">${safe(order.buyer_name || '-')}</div>
          <small class="text-muted">${safe(order.buyer_phone || '-')}</small>
        </td>
        <td>
          <div class="fw-bold">${NB.money(order.total_price)}</div>
          <small class="text-muted">Qty ${safe(order.quantity || 1)}</small>
        </td>
        <td>${orderBadge(order.payment_status)}</td>
        <td>
          ${order.proof_image_url
            ? `<a class="btn btn-sm btn-outline-nb" href="${safe(order.proof_image_url)}" target="_blank" rel="noopener">Buka Bukti</a>`
            : '<span class="text-muted">-</span>'}
        </td>
        <td class="text-end">
          <div class="admin-action-row justify-content-end">
            <button class="btn btn-sm btn-success" type="button" data-order-paid="${safe(order.id)}" ${order.payment_status === 'paid' ? 'disabled' : ''}>
              Paid
            </button>
            <button class="btn btn-sm btn-outline-danger" type="button" data-order-cancel="${safe(order.id)}" ${order.payment_status === 'cancelled' ? 'disabled' : ''}>
              Cancel
            </button>
          </div>
        </td>
      </tr>
    `).join('') || '<tr><td colspan="6" class="text-center text-muted py-4">Belum ada order.</td></tr>';

    refs.orderRows.querySelectorAll('[data-order-paid]').forEach(button => {
      button.addEventListener('click', () => updateOrderStatus(button.dataset.orderPaid, 'paid'));
    });

    refs.orderRows.querySelectorAll('[data-order-cancel]').forEach(button => {
      button.addEventListener('click', () => updateOrderStatus(button.dataset.orderCancel, 'cancelled'));
    });
  }

  function renderSettings() {
    if (refs.maintenanceMode) refs.maintenanceMode.checked = Boolean(state.settings.maintenance_mode);
    if (refs.allowRegister) refs.allowRegister.checked = state.settings.allow_register !== false;
    if (refs.maintenanceMessage) refs.maintenanceMessage.value = state.settings.maintenance_message || '';
    if (refs.premiumPrice) refs.premiumPrice.value = state.settings.premium_price || 80000;
    if (refs.adminWhatsApp) refs.adminWhatsApp.value = state.settings.admin_whatsapp || '';
  }

  function renderAll() {
    renderSystemBadges();
    renderMetrics();
    renderUsers();
    renderOrders();
    renderSettings();
  }

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

  async function togglePremium(userId) {
    const profile = state.profiles.find(item => item.user_id === userId);
    if (!profile) return;

    if (profile.user_id === state.currentUser?.id) {
      nbToast('Akun admin master tidak boleh diubah plan-nya dari panel ini.', 'warning');
      return;
    }

    const makePremium = profile.plan !== 'premium';
    let endDate = null;

    if (makePremium) {
      const daysInput = prompt('Premium berapa hari?', '30');
      if (daysInput === null) return;

      const days = Number(daysInput || 30);
      if (!Number.isFinite(days) || days < 1) {
        nbToast('Durasi premium tidak valid.', 'danger');
        return;
      }

      endDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
    } else if (!confirm(`Set ${profile.email || profile.username} kembali ke Free?`)) {
      return;
    }

    try {
      await NB.adminUpdateProfile(userId, {
        plan: makePremium ? 'premium' : 'free',
        status: 'active',
        plan_end_date: endDate
      });

      nbToast(makePremium ? 'User berhasil di-upgrade ke Premium.' : 'User berhasil dikembalikan ke Free.');
      await refresh();
      if (state.selectedUserId === userId) openUserDetail(userId, false);
    } catch (error) {
      nbToast(error.message || 'Gagal update plan user.', 'danger');
    }
  }

  async function toggleBlock(userId) {
    const profile = state.profiles.find(item => item.user_id === userId);
    if (!profile) return;

    if (profile.user_id === state.currentUser?.id) {
      nbToast('Akun admin master tidak boleh diblokir.', 'warning');
      return;
    }

    const currentlyBlocked = profile.status === 'blocked';
    const message = currentlyBlocked
      ? `Unblock ${profile.email || profile.username}?`
      : `Blokir ${profile.email || profile.username}? User tidak bisa kelola toko setelah diblokir.`;

    if (!confirm(message)) return;

    try {
      await NB.adminUpdateProfile(userId, {
        status: currentlyBlocked ? 'active' : 'blocked'
      });

      nbToast(currentlyBlocked ? 'User berhasil diaktifkan lagi.' : 'User berhasil diblokir.');
      await refresh();
      if (state.selectedUserId === userId) openUserDetail(userId, false);
    } catch (error) {
      nbToast(error.message || 'Gagal update status user.', 'danger');
    }
  }

  async function updateOrderStatus(orderId, status) {
    const order = state.orders.find(item => item.id === orderId);
    if (!order) return;

    const label = status === 'paid' ? 'konfirmasi PAID' : 'cancel';
    if (!confirm(`Yakin ingin ${label} order ini?`)) return;

    try {
      await NB.save('orders', {
        ...order,
        payment_status: status,
        paid_at: status === 'paid' ? NB.now() : null
      });

      nbToast(status === 'paid' ? 'Order berhasil dikonfirmasi paid.' : 'Order berhasil dibatalkan.');
      await refresh();
    } catch (error) {
      nbToast(error.message || 'Gagal update order.', 'danger');
    }
  }

  async function saveAdminSettings(event) {
    event.preventDefault();

    if (refs.saveSettingsBtn) {
      refs.saveSettingsBtn.disabled = true;
      refs.saveSettingsBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Menyimpan';
    }

    try {
      state.settings = await NB.saveSettings({
        maintenance_mode: refs.maintenanceMode?.checked,
        maintenance_message: refs.maintenanceMessage?.value.trim(),
        allow_register: refs.allowRegister?.checked,
        premium_price: Number(refs.premiumPrice?.value || 80000),
        admin_whatsapp: refs.adminWhatsApp?.value.trim()
      });

      nbToast('Setting platform berhasil disimpan.');
      renderSettings();
      renderSystemBadges();
    } catch (error) {
      nbToast(error.message || 'Gagal simpan setting.', 'danger');
    } finally {
      if (refs.saveSettingsBtn) {
        refs.saveSettingsBtn.disabled = false;
        refs.saveSettingsBtn.innerHTML = '<i class="bi bi-save me-1"></i>Simpan Setting';
      }
    }
  }

  function openUserDetail(userId, showModal = true) {
    const profile = state.profiles.find(item => item.user_id === userId);
    if (!profile) return;

    state.selectedUserId = userId;

    const userOrders = state.orders.filter(order => order.seller_id === userId);
    const paidOrders = userOrders.filter(order => order.payment_status === 'paid');
    const pendingOrders = userOrders.filter(order => order.payment_status === 'pending');
    const omset = paidOrders.reduce((sum, order) => sum + Number(order.total_price || 0), 0);

    if (refs.userModalTitle) refs.userModalTitle.textContent = profile.display_name || 'User NiagaBio';
    if (refs.userModalSubtitle) refs.userModalSubtitle.textContent = profile.email || '-';

    if (refs.userModalBody) {
      refs.userModalBody.innerHTML = `
        <div class="row g-3">
          <div class="col-md-5">
            <div class="admin-detail-card text-center">
              <img src="${safe(profile.avatar_url || 'assets/img/logo.jpg')}" alt="" class="admin-detail-avatar mb-3">
              <h3 class="h5 fw-black mb-1">${safe(profile.display_name || 'User NiagaBio')}</h3>
              <p class="text-muted mb-2">${safe(profile.email || '-')}</p>
              <div class="d-flex justify-content-center gap-2 flex-wrap">
                ${planBadge(profile.plan)}
                ${statusBadge(profile.status || 'active')}
                ${roleBadge(profile.role)}
              </div>
            </div>
          </div>
          <div class="col-md-7">
            <div class="admin-detail-grid">
              <div><span>Username</span><b>@${safe(profile.username || '-')}</b></div>
              <div><span>WhatsApp</span><b>${safe(profile.whatsapp_number || '-')}</b></div>
              <div><span>Plan End</span><b>${formatDate(profile.plan_end_date)}</b></div>
              <div><span>Dibuat</span><b>${formatDate(profile.created_at)}</b></div>
              <div><span>Total Order</span><b>${userOrders.length}</b></div>
              <div><span>Order Pending</span><b>${pendingOrders.length}</b></div>
              <div><span>Order Paid</span><b>${paidOrders.length}</b></div>
              <div><span>Omset Paid</span><b>${NB.money(omset)}</b></div>
            </div>
          </div>
        </div>
      `;
    }

    if (refs.modalPlanBtn) {
      refs.modalPlanBtn.textContent = profile.plan === 'premium' ? 'Set Free' : 'Set Premium';
      refs.modalPlanBtn.disabled = profile.user_id === state.currentUser?.id;
    }

    if (refs.modalBlockBtn) {
      refs.modalBlockBtn.textContent = profile.status === 'blocked' ? 'Unblock' : 'Blokir';
      refs.modalBlockBtn.disabled = profile.user_id === state.currentUser?.id;
      refs.modalBlockBtn.className = profile.status === 'blocked' ? 'btn btn-outline-success' : 'btn btn-outline-danger';
    }

    if (showModal && userModal) userModal.show();
  }

  function bindEvents() {
    refs.refreshBtn?.addEventListener('click', refresh);
    refs.userSearch?.addEventListener('input', renderUsers);
    refs.planFilter?.addEventListener('change', renderUsers);
    refs.statusFilter?.addEventListener('change', renderUsers);
    refs.orderSearch?.addEventListener('input', renderOrders);
    refs.orderFilter?.addEventListener('change', renderOrders);
    refs.settingsForm?.addEventListener('submit', saveAdminSettings);
    refs.resetSettingsBtn?.addEventListener('click', refresh);

    refs.modalPlanBtn?.addEventListener('click', () => {
      if (state.selectedUserId) togglePremium(state.selectedUserId);
    });

    refs.modalBlockBtn?.addEventListener('click', () => {
      if (state.selectedUserId) toggleBlock(state.selectedUserId);
    });

    document.querySelectorAll('[data-admin-scroll]').forEach(link => {
      link.addEventListener('click', () => document.querySelector('.sidebar')?.classList.remove('show'));
    });
  }

  state.currentUser = await NB.requireAuth();
  if (!state.currentUser) return;

  try {
    state.me = await NB.getProfile(state.currentUser.id);
  } catch (error) {
    nbToast(error.message || 'Gagal membaca profil admin.', 'danger');
    return;
  }

  if (state.me?.role !== 'admin') {
    showAccessDenied();
    return;
  }

  bindEvents();
  await refresh();
});
