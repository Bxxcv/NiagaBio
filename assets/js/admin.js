document.addEventListener('DOMContentLoaded', async () => {
  setActiveSide('admin');

  const user = await NB.requireAuth();
  if (!user) return;

  const me = await NB.getProfile(user.id);
  const contentWrap = document.querySelector('.content-wrap');

  if (me?.role !== 'admin') {
    contentWrap.innerHTML = `
      <div class="alert alert-danger">
        <b>Akses ditolak.</b> Halaman ini khusus admin NiagaBio.
      </div>
      <a href="dashboard.html" class="btn btn-nb">Kembali ke Dashboard</a>
    `;
    return;
  }

  const state = {
    profiles: [],
    orders: [],
    settings: await NB.getSettings()
  };

  function statusBadge(status) {
    return status === 'blocked'
      ? '<span class="badge text-bg-danger">Blocked</span>'
      : '<span class="badge text-bg-success">Active</span>';
  }

  function planBadge(plan) {
    return plan === 'premium'
      ? '<span class="badge text-bg-success">Premium</span>'
      : '<span class="badge text-bg-light text-dark">Free</span>';
  }

  function orderBadge(status) {
    if (status === 'paid') return '<span class="badge text-bg-success">paid</span>';
    if (status === 'cancelled') return '<span class="badge text-bg-secondary">cancelled</span>';
    return '<span class="badge text-bg-warning">pending</span>';
  }

  async function loadData() {
    state.profiles = await NB.all('profiles');
    state.orders = await NB.all('orders');
    state.settings = await NB.getSettings();
  }

  function renderMetrics() {
    const paid = state.orders.filter(order => order.payment_status === 'paid');
    adminUsers.textContent = state.profiles.length;
    adminPremium.textContent = state.profiles.filter(profile => profile.plan === 'premium').length;
    adminOrders.textContent = state.orders.length;
    adminOmset.textContent = NB.money(paid.reduce((sum, order) => sum + Number(order.total_price || 0), 0));
  }

  function renderUsers() {
    const keyword = (document.getElementById('adminUserSearch')?.value || '').toLowerCase();
    const rows = state.profiles.filter(profile => {
      const text = `${profile.display_name || ''} ${profile.email || ''} ${profile.username || ''}`.toLowerCase();
      return text.includes(keyword);
    });

    userRows.innerHTML = rows.map(profile => `
      <tr>
        <td>
          <div class="fw-bold">${NB.escapeHtml(profile.display_name)}</div>
          <small>${NB.escapeHtml(profile.email || '')}</small>
        </td>
        <td>${NB.escapeHtml(profile.username)}</td>
        <td>${planBadge(profile.plan)}</td>
        <td>${statusBadge(profile.status || 'active')}</td>
        <td class="small">${profile.plan_end_date ? new Date(profile.plan_end_date).toLocaleDateString('id-ID') : '-'}</td>
        <td class="text-end">
          <button class="btn btn-sm btn-outline-nb" data-premium="${profile.user_id}">${profile.plan === 'premium' ? 'Set Free' : 'Set Premium'}</button>
          <button class="btn btn-sm btn-outline-danger" data-block="${profile.user_id}">${profile.status === 'blocked' ? 'Unblock' : 'Blokir'}</button>
        </td>
      </tr>
    `).join('') || '<tr><td colspan="6" class="text-center text-muted">User tidak ditemukan.</td></tr>';

    document.querySelectorAll('[data-premium]').forEach(button => {
      button.addEventListener('click', () => togglePremium(button.dataset.premium));
    });

    document.querySelectorAll('[data-block]').forEach(button => {
      button.addEventListener('click', () => toggleBlock(button.dataset.block));
    });
  }

  function renderOrders() {
    const filter = document.getElementById('adminOrderFilter')?.value || 'all';
    const rows = state.orders
      .filter(order => filter === 'all' || order.payment_status === filter)
      .slice(0, 100);

    orderRows.innerHTML = rows.map(order => `
      <tr>
        <td>
          <div class="fw-bold">${NB.escapeHtml(order.product_name)}</div>
          <small>${new Date(order.created_at).toLocaleString('id-ID')}</small>
        </td>
        <td>${NB.escapeHtml(order.buyer_name)}<br><small>${NB.escapeHtml(order.buyer_phone)}</small></td>
        <td>${NB.money(order.total_price)}</td>
        <td>${orderBadge(order.payment_status)}</td>
        <td>${order.proof_image_url ? `<a href="${NB.escapeHtml(order.proof_image_url)}" target="_blank">Bukti</a>` : '-'}</td>
        <td class="text-end">
          <button class="btn btn-sm btn-success" data-order-paid="${order.id}" ${order.payment_status === 'paid' ? 'disabled' : ''}>Paid</button>
          <button class="btn btn-sm btn-outline-danger" data-order-cancel="${order.id}" ${order.payment_status === 'cancelled' ? 'disabled' : ''}>Cancel</button>
        </td>
      </tr>
    `).join('') || '<tr><td colspan="6" class="text-center text-muted">Belum ada order.</td></tr>';

    document.querySelectorAll('[data-order-paid]').forEach(button => {
      button.addEventListener('click', () => updateOrderStatus(button.dataset.orderPaid, 'paid'));
    });

    document.querySelectorAll('[data-order-cancel]').forEach(button => {
      button.addEventListener('click', () => updateOrderStatus(button.dataset.orderCancel, 'cancelled'));
    });
  }

  function renderSettings() {
    maintenanceMode.checked = Boolean(state.settings.maintenance_mode);
    allowRegister.checked = Boolean(state.settings.allow_register);
    maintenanceMessage.value = state.settings.maintenance_message || '';
    premiumPrice.value = state.settings.premium_price || 80000;
    adminWhatsApp.value = state.settings.admin_whatsapp || '';
  }

  async function togglePremium(userId) {
    const profile = state.profiles.find(item => item.user_id === userId);
    if (!profile) return;

    const makePremium = profile.plan !== 'premium';
    const endDate = makePremium
      ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      : null;

    try {
      await NB.adminUpdateProfile(userId, {
        plan: makePremium ? 'premium' : 'free',
        status: 'active',
        plan_end_date: endDate
      });
      nbToast(makePremium ? 'User di-upgrade ke Premium.' : 'User dikembalikan ke Free.');
      await refresh();
    } catch (error) {
      nbToast(error.message || 'Gagal update plan user.', 'danger');
    }
  }

  async function toggleBlock(userId) {
    const profile = state.profiles.find(item => item.user_id === userId);
    if (!profile) return;

    const blocked = profile.status === 'blocked';
    const message = blocked ? 'Unblock user ini?' : 'Blokir user ini? User tidak bisa kelola toko setelah diblokir.';
    if (!confirm(message)) return;

    try {
      await NB.adminUpdateProfile(userId, {
        status: blocked ? 'active' : 'blocked'
      });
      nbToast(blocked ? 'User diaktifkan lagi.' : 'User diblokir.');
      await refresh();
    } catch (error) {
      nbToast(error.message || 'Gagal update status user.', 'danger');
    }
  }

  async function updateOrderStatus(orderId, status) {
    const order = state.orders.find(item => item.id === orderId);
    if (!order) return;

    try {
      await NB.save('orders', {
        ...order,
        payment_status: status,
        paid_at: status === 'paid' ? NB.now() : null
      });
      nbToast(status === 'paid' ? 'Order dikonfirmasi paid.' : 'Order dibatalkan.');
      await refresh();
    } catch (error) {
      nbToast(error.message || 'Gagal update order.', 'danger');
    }
  }

  async function saveAdminSettings(event) {
    event.preventDefault();
    const button = adminSettingsForm.querySelector('button[type="submit"]');
    button.disabled = true;

    try {
      state.settings = await NB.saveSettings({
        maintenance_mode: maintenanceMode.checked,
        maintenance_message: maintenanceMessage.value.trim(),
        allow_register: allowRegister.checked,
        premium_price: Number(premiumPrice.value || 80000),
        admin_whatsapp: adminWhatsApp.value.trim()
      });
      nbToast('Setting platform disimpan.');
      renderSettings();
    } catch (error) {
      nbToast(error.message || 'Gagal simpan setting.', 'danger');
    } finally {
      button.disabled = false;
    }
  }

  async function refresh() {
    await loadData();
    renderMetrics();
    renderUsers();
    renderOrders();
    renderSettings();
  }

  document.getElementById('adminUserSearch')?.addEventListener('input', renderUsers);
  document.getElementById('adminOrderFilter')?.addEventListener('change', renderOrders);
  adminSettingsForm?.addEventListener('submit', saveAdminSettings);

  try {
    await refresh();
  } catch (error) {
    nbToast(error.message || 'Gagal memuat admin panel.', 'danger');
  }
});
