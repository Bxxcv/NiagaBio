// NiagaBio Admin Master — Request Premium & Lupa Password
(function () {
  const A = window.NBAdmin;
  const { refs, state, safe, requestBadge, passwordResetBadge, formatDateTime, proofLink, isPendingRequest } = A;

  function filteredRequests() {
    const status = refs.requestFilter?.value || 'all';
    const keyword = (refs.requestSearch?.value || '').trim().toLowerCase();

    return state.premiumRequests.filter(request => {
      const profile = state.profiles.find(item => item.user_id === request.user_id);
      const text = [request.email, request.shop_name, request.owner_name, request.status, request.note, profile?.username, profile?.display_name].join(' ').toLowerCase();
      return (status === 'all' || request.status === status) && (!keyword || text.includes(keyword));
    });
  }

  function renderRequests() {
    if (!refs.requestRows) return;

    const rows = filteredRequests();
    const pendingTotal = state.premiumRequests.filter(isPendingRequest).length;
    if (refs.requestCountInfo) refs.requestCountInfo.textContent = `${rows.length} tampil • ${pendingTotal} pending`;

    refs.requestRows.innerHTML = rows.map(request => {
      const profile = state.profiles.find(item => item.user_id === request.user_id);
      const pending = isPendingRequest(request);
      return `
        <article class="admin-request-card ${pending ? 'is-pending' : ''}">
          <div class="admin-request-main">
            <div class="admin-request-user">
              <div class="admin-request-avatar">${safe((request.shop_name || request.email || 'N').slice(0, 1)).toUpperCase()}</div>
              <div>
                <h3>${safe(request.shop_name || 'Request Premium')}</h3>
                <p>${safe(request.email || profile?.email || '-')} ${profile?.username ? `• @${safe(profile.username)}` : ''}</p>
              </div>
            </div>
            <div class="admin-request-meta">
              ${requestBadge(request.status || 'pending')}
              <span>${formatDateTime(request.created_at)}</span>
            </div>
          </div>
          <div class="admin-request-info">
            <div><span>Pemilik</span><b>${safe(request.owner_name || '-')}</b></div>
            <div><span>Catatan</span><b>${safe(request.note || 'Tidak ada catatan')}</b></div>
            <div><span>Bukti</span>${proofLink(request.proof_url)}</div>
          </div>
          <div class="admin-request-actions">
            <button class="btn btn-sm btn-success" type="button" data-request-approve="${safe(request.id)}" ${pending ? '' : 'disabled'}>Approve</button>
            <button class="btn btn-sm btn-outline-danger" type="button" data-request-reject="${safe(request.id)}" ${pending ? '' : 'disabled'}>Reject</button>
            <button class="btn btn-sm btn-outline-secondary" type="button" data-request-delete="${safe(request.id)}">Hapus</button>
          </div>
        </article>
      `;
    }).join('') || '<div class="empty-card text-center py-4"><b>Tidak ada request sesuai filter.</b><p class="text-muted mb-0 small">Pending request baru akan muncul di sini.</p></div>';

    NB.hydrateProofLinks(refs.requestRows);
    refs.requestRows.querySelectorAll('[data-request-approve]').forEach(button => button.addEventListener('click', () => reviewPremiumRequest(button.dataset.requestApprove, 'approved')));
    refs.requestRows.querySelectorAll('[data-request-reject]').forEach(button => button.addEventListener('click', () => reviewPremiumRequest(button.dataset.requestReject, 'rejected')));
    refs.requestRows.querySelectorAll('[data-request-delete]').forEach(button => button.addEventListener('click', () => deletePremiumRequest(button.dataset.requestDelete)));
  }

  function filteredPasswordResetRequests() {
    const status = refs.passwordResetFilter?.value || 'pending';
    const keyword = (refs.passwordResetSearch?.value || '').trim().toLowerCase();

    return state.passwordResetRequests.filter(request => {
      const profile = request.user_id ? state.profiles.find(item => item.user_id === request.user_id) : null;
      const text = [request.email, request.display_name, request.username, request.user_note, request.status, profile?.display_name, profile?.username, profile?.email].join(' ').toLowerCase();
      const requestStatus = String(request.status || 'pending').toLowerCase();
      return (status === 'all' || requestStatus === status) && (!keyword || text.includes(keyword));
    });
  }

  function renderPasswordResetRequests() {
    if (!refs.passwordResetRows) return;

    const rows = filteredPasswordResetRequests();
    const pendingTotal = state.passwordResetRequests.filter(request => String(request.status || 'pending').toLowerCase() === 'pending').length;
    if (refs.passwordResetCountInfo) refs.passwordResetCountInfo.textContent = `${rows.length} tampil • ${pendingTotal} pending`;

    refs.passwordResetRows.innerHTML = rows.map(request => {
      const profile = request.user_id ? state.profiles.find(item => item.user_id === request.user_id) : null;
      const status = String(request.status || 'pending').toLowerCase();
      const pending = status === 'pending';
      const email = request.email || profile?.email || '';
      return `
        <article class="admin-request-card ${pending ? 'is-pending' : ''}">
          <div class="admin-request-main">
            <div class="admin-request-user">
              <div class="admin-request-avatar"><i class="bi bi-key"></i></div>
              <div>
                <h3>${safe(request.display_name || profile?.display_name || email || 'Request lupa password')}</h3>
                <p>${safe(email || '-')} ${request.username || profile?.username ? `• @${safe(request.username || profile?.username)}` : ''}</p>
              </div>
            </div>
            <div class="admin-request-meta">
              ${passwordResetBadge(status)}
              <span>${formatDateTime(request.created_at)}</span>
            </div>
          </div>
          <div class="admin-request-info">
            <div><span>Email</span><b>${safe(email || '-')}</b></div>
            <div><span>Catatan User</span><b>${safe(request.user_note || 'Tidak ada catatan')}</b></div>
            <div><span>Reset Terkirim</span><b>${Number(request.reset_sent_count || 0)}x</b></div>
            <div><span>Terakhir Dikirim</span><b>${formatDateTime(request.sent_at)}</b></div>
          </div>
          <div class="admin-request-actions">
            <button class="btn btn-sm btn-success" type="button" data-password-reset-send="${safe(request.id)}" ${email ? '' : 'disabled'}>Kirim Link Reset</button>
            <button class="btn btn-sm btn-outline-nb" type="button" data-password-reset-done="${safe(request.id)}" ${status === 'done' ? 'disabled' : ''}>Tandai Selesai</button>
            <button class="btn btn-sm btn-outline-secondary" type="button" data-password-reset-cancel="${safe(request.id)}" ${status === 'cancelled' ? 'disabled' : ''}>Batalkan</button>
            <button class="btn btn-sm btn-outline-danger" type="button" data-password-reset-delete="${safe(request.id)}">Hapus</button>
          </div>
        </article>
      `;
    }).join('') || '<div class="empty-card text-center py-4"><b>Tidak ada request lupa password.</b><p class="text-muted mb-0 small">Request dari halaman login akan muncul di sini.</p></div>';

    refs.passwordResetRows.querySelectorAll('[data-password-reset-send]').forEach(button => button.addEventListener('click', () => sendPasswordResetLink(button.dataset.passwordResetSend)));
    refs.passwordResetRows.querySelectorAll('[data-password-reset-done]').forEach(button => button.addEventListener('click', () => updatePasswordResetStatus(button.dataset.passwordResetDone, 'done')));
    refs.passwordResetRows.querySelectorAll('[data-password-reset-cancel]').forEach(button => button.addEventListener('click', () => updatePasswordResetStatus(button.dataset.passwordResetCancel, 'cancelled')));
    refs.passwordResetRows.querySelectorAll('[data-password-reset-delete]').forEach(button => button.addEventListener('click', () => deletePasswordResetRequest(button.dataset.passwordResetDelete)));
  }

  async function reviewPremiumRequest(requestId, action) {
    const request = state.premiumRequests.find(item => item.id === requestId);
    if (!request) return;

    let days = 30;
    if (action === 'approved') {
      const daysInput = prompt('Aktifkan Premium berapa hari?', '30');
      if (daysInput === null) return;
      days = Number(daysInput || 30);
      if (!Number.isFinite(days) || days < 1) return nbToast('Durasi premium tidak valid.', 'danger');
    }

    const text = action === 'approved' ? 'approve request ini dan aktifkan Premium?' : 'reject request ini?';
    if (!confirm(`Yakin ingin ${text}`)) return;

    try {
      await NB.adminReviewPremiumRequest(requestId, action, days);
      nbToast(action === 'approved' ? 'Request disetujui dan user jadi Premium.' : 'Request ditolak.');
      await A.refresh();
    } catch (error) {
      nbToast(error.message || 'Gagal memproses request premium.', 'danger');
    }
  }

  async function deletePremiumRequest(requestId) {
    const request = state.premiumRequests.find(item => item.id === requestId);
    if (!request) return;
    if (!confirm(`Hapus request premium dari ${request.email || request.shop_name || 'user ini'}?`)) return;

    try {
      await NB.remove('premium_requests', requestId);
      nbToast('Request premium berhasil dihapus.');
      await A.refresh();
    } catch (error) {
      nbToast(error.message || 'Gagal hapus request premium.', 'danger');
    }
  }

  async function clearProcessedRequests() {
    const processed = state.premiumRequests.filter(request => !isPendingRequest(request));
    if (!processed.length) return nbToast('Tidak ada request selesai yang perlu dibersihkan.', 'info');
    if (!confirm(`Bersihkan ${processed.length} request yang sudah approved/rejected? Request pending tidak akan dihapus.`)) return;

    try {
      await Promise.all(processed.map(request => NB.remove('premium_requests', request.id)));
      nbToast('Request selesai berhasil dibersihkan.');
      await A.refresh();
    } catch (error) {
      nbToast(error.message || 'Gagal membersihkan request.', 'danger');
    }
  }

  async function sendPasswordResetLink(requestId) {
    const request = state.passwordResetRequests.find(item => String(item.id) === String(requestId));
    if (!request) return;
    const email = String(request.email || '').trim().toLowerCase();
    if (!email) return nbToast('Email request tidak ditemukan.', 'danger');
    if (!confirm(`Kirim link reset password ke ${email}?\n\nUser akan membuat password baru sendiri dari email resmi Supabase/NiagaBio.`)) return;

    try {
      await NB.sendPasswordResetEmail(email);
      await NB.adminUpdatePasswordResetRequest(requestId, 'sent');
      nbToast('Link reset password berhasil dikirim ke email user.');
      await A.refresh();
    } catch (error) {
      nbToast(error.message || 'Gagal mengirim link reset password. Cek SMTP/redirect URL Supabase.', 'danger');
    }
  }

  async function updatePasswordResetStatus(requestId, status) {
    const request = state.passwordResetRequests.find(item => String(item.id) === String(requestId));
    if (!request) return;
    const label = status === 'done' ? 'tandai request ini selesai' : 'batalkan request ini';
    if (!confirm(`Yakin ingin ${label}?`)) return;

    try {
      await NB.adminUpdatePasswordResetRequest(requestId, status);
      nbToast(status === 'done' ? 'Request ditandai selesai.' : 'Request dibatalkan.');
      await A.refresh();
    } catch (error) {
      nbToast(error.message || 'Gagal update request lupa password.', 'danger');
    }
  }

  async function deletePasswordResetRequest(requestId) {
    const request = state.passwordResetRequests.find(item => String(item.id) === String(requestId));
    if (!request) return;
    if (!confirm(`Hapus request lupa password dari ${request.email || 'user ini'}?`)) return;

    try {
      await NB.remove('password_reset_requests', requestId);
      nbToast('Request lupa password berhasil dihapus.');
      await A.refresh();
    } catch (error) {
      nbToast(error.message || 'Gagal hapus request lupa password.', 'danger');
    }
  }

  A.registerRenderer(() => { renderRequests(); renderPasswordResetRequests(); });
  A.registerBinder(() => {
    refs.requestSearch?.addEventListener('input', renderRequests);
    refs.requestFilter?.addEventListener('change', renderRequests);
    refs.passwordResetSearch?.addEventListener('input', renderPasswordResetRequests);
    refs.passwordResetFilter?.addEventListener('change', renderPasswordResetRequests);
    refs.clearProcessedRequestsBtn?.addEventListener('click', clearProcessedRequests);
  });
})();
