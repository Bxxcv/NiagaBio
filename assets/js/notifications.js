document.addEventListener('DOMContentLoaded', async () => {
  setActiveSide('notifications');

  const user = await NB.requireAuth();
  if (!user) return;

  const listEl = document.getElementById('notificationList');
  const countEl = document.getElementById('notificationCount');
  const markAllBtn = document.getElementById('markAllReadBtn');
  const refreshBtn = document.getElementById('refreshNotifications');

  function typeIcon(type) {
    const key = String(type || '').toLowerCase();
    if (key.includes('order')) return 'bi-receipt-cutoff';
    if (key.includes('premium') || key.includes('upgrade')) return 'bi-stars';
    if (key.includes('system')) return 'bi-megaphone';
    return 'bi-bell';
  }

  function typeLabel(type) {
    const key = String(type || '').toLowerCase();
    if (key === 'order_new') return 'Pesanan';
    if (key === 'premium_request_new') return 'Request Premium';
    if (key === 'premium_approved') return 'Premium Disetujui';
    if (key === 'premium_rejected') return 'Premium Ditolak';
    if (key === 'order_status_updated') return 'Update Order';
    return 'Info';
  }

  function formatDate(value) {
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

  function emptyHtml() {
    return `
      <div class="empty-state empty-action py-5">
        <i class="bi bi-bell"></i>
        <b>Belum ada notifikasi</b>
        <span>Order baru, request Premium, dan update akun akan muncul di sini.</span>
      </div>
    `;
  }

  function itemHtml(item) {
    const unread = !item.is_read;
    return `
      <article class="notification-item ${unread ? 'is-unread' : ''}" data-notification-id="${NB.escapeHtml(item.id)}" data-notification-link="${NB.safeHref(item.link_url || 'notifications')}">
        <div class="notification-icon"><i class="bi ${typeIcon(item.type)}"></i></div>
        <div class="notification-body">
          <div class="notification-row">
            <span class="notification-type">${typeLabel(item.type)}</span>
            <small>${formatDate(item.created_at)}</small>
          </div>
          <h3>${NB.escapeHtml(item.title || 'Notifikasi')}</h3>
          <p>${NB.escapeHtml(item.message || '')}</p>
        </div>
        ${unread ? '<span class="notification-dot" aria-label="Belum dibaca"></span>' : ''}
      </article>
    `;
  }

  async function loadNotifications() {
    try {
      const items = await NB.listNotifications(80);
      const unread = items.filter(item => !item.is_read).length;
      countEl.textContent = `${items.length} notif${unread ? ` • ${unread} baru` : ''}`;
      listEl.innerHTML = items.length ? items.map(itemHtml).join('') : emptyHtml();
      attachActions();
      if (window.NB_REFRESH_NOTIFICATIONS) window.NB_REFRESH_NOTIFICATIONS();
    } catch (error) {
      listEl.innerHTML = `<div class="empty-state py-5"><i class="bi bi-exclamation-triangle"></i><b>Gagal memuat notifikasi</b><span>${NB.escapeHtml(error.message || 'Jalankan SQL patch 07 jika tabel notifikasi belum ada.')}</span></div>`;
    }
  }

  function attachActions() {
    document.querySelectorAll('[data-notification-id]').forEach(card => {
      card.addEventListener('click', async () => {
        const id = card.dataset.notificationId;
        const link = card.dataset.notificationLink || 'notifications';
        try {
          await NB.markNotificationRead(id);
        } catch (error) {
          console.warn('[NiagaBio] Gagal menandai notifikasi:', error.message);
        }
        if (link && link !== '#' && link !== 'notifications') location.href = link;
        else loadNotifications();
      });
    });
  }

  markAllBtn?.addEventListener('click', async () => {
    try {
      await NB.markAllNotificationsRead();
      nbToast('Semua notifikasi ditandai sudah dibaca.');
      await loadNotifications();
    } catch (error) {
      nbToast(error.message || 'Gagal menandai notifikasi.', 'danger');
    }
  });

  refreshBtn?.addEventListener('click', loadNotifications);
  await loadNotifications();
});
