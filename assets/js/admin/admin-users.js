// NiagaBio Admin Master — Kelola User
(function () {
  const A = window.NBAdmin;
  const { refs, state, safe, roleBadge, planBadge, statusBadge, formatDate } = A;

  function filteredProfiles() {
    const keyword = (refs.userSearch?.value || '').trim().toLowerCase();
    const plan = refs.planFilter?.value || 'all';
    const status = refs.statusFilter?.value || 'all';

    return state.profiles.filter(profile => {
      const text = [profile.display_name, profile.email, profile.username, profile.whatsapp_number, profile.role, profile.plan, profile.status].join(' ').toLowerCase();
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
      const deleted = profile.status === 'deleted';
      const publicUrl = profile.username ? `u?username=${encodeURIComponent(profile.username)}` : '#';
      const avatarUrl = profile.avatar_url;
      const initials = safe((profile.display_name || profile.email || profile.username || 'U').slice(0, 1)).toUpperCase();
      const avatarHtml = avatarUrl
        ? `<img src="${NB.safeImageUrl(avatarUrl, 'assets/img/niagabio-logo.svg')}" alt="" class="admin-user-avatar">`
        : `<div class="admin-user-initials">${initials}</div>`;

      return `
        <tr class="${deleted ? 'table-light opacity-75' : ''}">
          <td>
            <div class="admin-user-cell">
              ${avatarHtml}
              <div>
                <div class="fw-bold">${safe(profile.display_name || 'User NiagaBio')} ${roleBadge(profile.role)}</div>
                <small class="text-muted">${safe(profile.email || '-')}</small>
              </div>
            </div>
          </td>
          <td>
            <div class="fw-semibold">@${safe(profile.username || '-')}</div>
            ${profile.username && !deleted ? `<a class="small" href="${NB.safeHref(publicUrl)}" target="_blank" rel="noopener">Lihat toko</a>` : '<small class="text-muted">Toko tidak aktif</small>'}
          </td>
          <td>${planBadge(profile.plan)}</td>
          <td>${statusBadge(profile.status || 'active')}</td>
          <td class="small">${formatDate(profile.plan_end_date)}</td>
          <td class="text-end">
            <div class="admin-action-row justify-content-end">
              <button class="btn btn-sm btn-outline-nb" type="button" data-user-detail="${safe(profile.user_id)}">Detail</button>
              <button class="btn btn-sm ${profile.plan === 'premium' ? 'btn-outline-secondary' : 'btn-success'}" type="button" data-user-plan="${safe(profile.user_id)}" ${isSelf || deleted ? 'disabled' : ''}>${profile.plan === 'premium' ? 'Set Free' : 'Premium'}</button>
              <button class="btn btn-sm ${profile.status === 'blocked' ? 'btn-outline-success' : 'btn-outline-danger'}" type="button" data-user-block="${safe(profile.user_id)}" ${isSelf || deleted ? 'disabled' : ''}>${profile.status === 'blocked' ? 'Unblock' : 'Blokir'}</button>
              <button class="btn btn-sm btn-danger" type="button" data-user-delete="${safe(profile.user_id)}" ${isSelf || deleted ? 'disabled' : ''}>Hapus</button>
            </div>
          </td>
        </tr>
      `;
    }).join('') || '<tr><td colspan="6" class="text-center text-muted py-4">User tidak ditemukan.</td></tr>';

    refs.userRows.querySelectorAll('[data-user-detail]').forEach(button => button.addEventListener('click', () => openUserDetail(button.dataset.userDetail)));
    refs.userRows.querySelectorAll('[data-user-plan]').forEach(button => button.addEventListener('click', () => togglePremium(button.dataset.userPlan)));
    refs.userRows.querySelectorAll('[data-user-block]').forEach(button => button.addEventListener('click', () => toggleBlock(button.dataset.userBlock)));
    refs.userRows.querySelectorAll('[data-user-delete]').forEach(button => button.addEventListener('click', () => deleteUser(button.dataset.userDelete)));
  }

  function openUserDetail(userId, showModal = true) {
    const profile = state.profiles.find(item => item.user_id === userId);
    if (!profile) return;

    state.selectedUserId = userId;
    const userOrders = state.orders.filter(order => order.seller_id === userId);
    const pendingOrders = userOrders.filter(order => order.payment_status === 'pending');
    const paidOrders = userOrders.filter(order => order.payment_status === 'paid');
    const omset = paidOrders.reduce((sum, order) => sum + Number(order.total_price || 0), 0);
    const userProducts = state.products.filter(product => product.user_id === userId);

    if (refs.userModalTitle) refs.userModalTitle.textContent = profile.display_name || 'User NiagaBio';
    if (refs.userModalSubtitle) refs.userModalSubtitle.textContent = profile.email || '-';

    const detailAvatarUrl = profile.avatar_url;
    const detailInitials = safe((profile.display_name || profile.email || profile.username || 'U').slice(0, 1)).toUpperCase();
    const detailAvatarHtml = detailAvatarUrl
      ? `<img src="${NB.safeImageUrl(detailAvatarUrl, 'assets/img/niagabio-logo.svg')}" alt="" class="admin-detail-avatar mb-3">`
      : `<div class="admin-initials--lg mb-3">${detailInitials}</div>`;

    if (refs.userModalBody) {
      refs.userModalBody.innerHTML = `
        <div class="row g-3">
          <div class="col-md-5">
            <div class="admin-detail-card text-center">
              ${detailAvatarHtml}
              <h3 class="h5 fw-black mb-1">${safe(profile.display_name || 'User NiagaBio')}</h3>
              <p class="text-muted mb-2">${safe(profile.email || '-')}</p>
              <div class="d-flex justify-content-center gap-2 flex-wrap">${planBadge(profile.plan)}${statusBadge(profile.status || 'active')}${roleBadge(profile.role)}</div>
            </div>
          </div>
          <div class="col-md-7">
            <div class="admin-detail-grid">
              <div><span>Username</span><b>@${safe(profile.username || '-')}</b></div>
              <div><span>WhatsApp</span><b>${safe(profile.whatsapp_number || '-')}</b></div>
              <div><span>Plan End</span><b>${formatDate(profile.plan_end_date)}</b></div>
              <div><span>Dibuat</span><b>${formatDate(profile.created_at)}</b></div>
              <div><span>Total Produk</span><b>${userProducts.length}</b></div>
              <div><span>Total Order</span><b>${userOrders.length}</b></div>
              <div><span>Order Pending</span><b>${pendingOrders.length}</b></div>
              <div><span>Omset Paid</span><b>${NB.money(omset)}</b></div>
            </div>
          </div>
          <div class="col-12">
            <div class="admin-detail-card">
              <div class="d-flex justify-content-between align-items-center mb-2">
                <h4 class="h6 fw-bold mb-0">Produk User</h4>
                <span class="small text-muted">${userProducts.length} produk</span>
              </div>
              <div class="admin-product-mini-list">
                ${userProducts.map(product => `
                  <div class="admin-product-mini-item">
                    <img src="${NB.safeImageUrl(product.image_url || 'assets/img/placeholder-product.svg')}" alt="">
                    <div class="flex-grow-1">
                      <b>${safe(product.name || 'Produk')}</b>
                      <small>${NB.money(product.price)} ${product.category ? `• ${safe(product.category)}` : ''}</small>
                    </div>
                    <button class="btn btn-sm btn-outline-danger" type="button" data-delete-product="${safe(product.id)}">Hapus</button>
                  </div>
                `).join('') || '<div class="text-muted small">User belum punya produk.</div>'}
              </div>
            </div>
          </div>
        </div>
      `;

      refs.userModalBody.querySelectorAll('[data-delete-product]').forEach(button => {
        button.addEventListener('click', () => deleteProduct(button.dataset.deleteProduct, userId));
      });
    }

    const isSelf = profile.user_id === state.currentUser?.id;
    const deleted = profile.status === 'deleted';

    if (refs.modalPlanBtn) {
      refs.modalPlanBtn.textContent = profile.plan === 'premium' ? 'Set Free' : 'Set Premium';
      refs.modalPlanBtn.disabled = isSelf || deleted;
    }
    if (refs.modalBlockBtn) {
      refs.modalBlockBtn.textContent = profile.status === 'blocked' ? 'Unblock' : 'Blokir';
      refs.modalBlockBtn.disabled = isSelf || deleted;
      refs.modalBlockBtn.className = profile.status === 'blocked' ? 'nb-btn nb-btn--commerce' : 'nb-btn nb-btn--danger';
    }
    if (refs.modalDeleteBtn) {
      refs.modalDeleteBtn.disabled = isSelf || deleted;
      refs.modalDeleteBtn.className = 'nb-btn nb-btn--danger';
    }

    if (showModal && A.userModal) A.userModal.show();
  }

  async function togglePremium(userId) {
    const profile = state.profiles.find(item => item.user_id === userId);
    if (!profile) return;
    if (profile.user_id === state.currentUser?.id) return nbToast('Akun admin master tidak boleh diubah plan-nya dari panel ini.', 'warning');
    if (profile.status === 'deleted') return nbToast('User deleted tidak bisa diubah plan-nya.', 'warning');

    const makePremium = profile.plan !== 'premium';
    let endDate = null;

    if (makePremium) {
      const daysInput = prompt('Premium berapa hari?', '30');
      if (daysInput === null) return;
      const days = Number(daysInput || 30);
      if (!Number.isFinite(days) || days < 1) return nbToast('Durasi premium tidak valid.', 'danger');
      endDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
    } else if (!confirm(`Set ${profile.email || profile.username} kembali ke Free?`)) return;

    try {
      await NB.adminUpdateProfile(userId, { plan: makePremium ? 'premium' : 'free', status: 'active', plan_end_date: endDate });
      nbToast(makePremium ? 'User berhasil di-upgrade ke Premium.' : 'User berhasil dikembalikan ke Free.');
      await A.refresh();
      if (state.selectedUserId === userId) openUserDetail(userId, false);
    } catch (error) {
      nbToast(error.message || 'Gagal update plan user.', 'danger');
    }
  }

  async function toggleBlock(userId) {
    const profile = state.profiles.find(item => item.user_id === userId);
    if (!profile) return;
    if (profile.user_id === state.currentUser?.id) return nbToast('Akun admin master tidak boleh diblokir.', 'warning');
    if (profile.status === 'deleted') return nbToast('User sudah deleted.', 'warning');

    const currentlyBlocked = profile.status === 'blocked';
    const message = currentlyBlocked
      ? `Unblock ${profile.email || profile.username}?`
      : `Blokir ${profile.email || profile.username}? User tidak bisa kelola toko setelah diblokir.`;
    if (!confirm(message)) return;

    try {
      await NB.adminUpdateProfile(userId, { status: currentlyBlocked ? 'active' : 'blocked' });
      nbToast(currentlyBlocked ? 'User berhasil diaktifkan lagi.' : 'User berhasil diblokir.');
      await A.refresh();
      if (state.selectedUserId === userId) openUserDetail(userId, false);
    } catch (error) {
      nbToast(error.message || 'Gagal update status user.', 'danger');
    }
  }

  async function deleteUser(userId) {
    const profile = state.profiles.find(item => item.user_id === userId);
    if (!profile) return;
    if (profile.user_id === state.currentUser?.id) return nbToast('Admin tidak boleh menghapus akun sendiri.', 'warning');

    const ok = confirm(`Hapus user ${profile.email || profile.username}?\n\nIni soft delete: toko disembunyikan, plan jadi Free, status Deleted, dan data toko user dibersihkan. Akun Auth di Supabase tidak ikut terhapus.`);
    if (!ok) return;

    try {
      await NB.adminSoftDeleteUser(userId);
      nbToast('User berhasil dihapus dari platform.');
      if (A.userModal) A.userModal.hide();
      await A.refresh();
    } catch (error) {
      nbToast(error.message || 'Gagal hapus user.', 'danger');
    }
  }

  async function deleteProduct(productId, ownerId) {
    const product = state.products.find(item => item.id === productId);
    if (!product) return;
    if (!confirm(`Hapus produk "${product.name || 'Produk'}"?`)) return;

    try {
      await NB.remove('products', productId);
      nbToast('Produk user berhasil dihapus.');
      await A.refresh();
      if (ownerId) openUserDetail(ownerId, false);
    } catch (error) {
      nbToast(error.message || 'Gagal hapus produk user.', 'danger');
    }
  }

  A.registerRenderer(renderUsers);
  A.registerBinder(() => {
    refs.userSearch?.addEventListener('input', renderUsers);
    refs.planFilter?.addEventListener('change', renderUsers);
    refs.statusFilter?.addEventListener('change', renderUsers);
    refs.modalPlanBtn?.addEventListener('click', () => { if (state.selectedUserId) togglePremium(state.selectedUserId); });
    refs.modalBlockBtn?.addEventListener('click', () => { if (state.selectedUserId) toggleBlock(state.selectedUserId); });
    refs.modalDeleteBtn?.addEventListener('click', () => { if (state.selectedUserId) deleteUser(state.selectedUserId); });
  });
})();
