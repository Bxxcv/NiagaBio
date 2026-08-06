(function () {
  'use strict';

  const BADGE_SELECTOR = '[data-notif-badge]';
  let refreshInFlight = null;

  function ensureBadge(target, className = 'notification-badge') {
    if (!target) return null;
    let badge = target.querySelector(BADGE_SELECTOR);
    if (!badge) {
      badge = document.createElement('span');
      badge.className = className;
      badge.setAttribute('data-notif-badge', '');
      badge.setAttribute('aria-hidden', 'true');
      badge.textContent = '0';
      target.appendChild(badge);
    }
    return badge;
  }

  function decorateNotificationTargets() {
    document.querySelectorAll('[data-nav="notifications"]').forEach(link => {
      link.classList.add('notification-side-link');
      ensureBadge(link, 'notification-badge');
    });

    document.querySelectorAll('.nb-topbar-actions a[href="notifications"], a[aria-label="Notifikasi"]').forEach(link => {
      link.classList.add('notification-topbar-link');
      ensureBadge(link, 'notification-topbar-badge');
    });
  }

  function updateAria(count) {
    const label = count > 0 ? `Notifikasi, ${count > 99 ? 'lebih dari 99' : count} belum dibaca` : 'Notifikasi';
    document.querySelectorAll('[data-nav="notifications"], .nb-topbar-actions a[href="notifications"]').forEach(link => {
      link.setAttribute('aria-label', label);
      link.classList.toggle('has-unread-notifications', count > 0);
    });
  }

  function renderBadge(count) {
    const safeCount = Math.max(0, Number(count) || 0);
    decorateNotificationTargets();
    document.querySelectorAll(BADGE_SELECTOR).forEach(badge => {
      badge.textContent = safeCount > 99 ? '99+' : String(safeCount);
      badge.classList.toggle('d-none', safeCount <= 0);
      badge.setAttribute('aria-hidden', safeCount <= 0 ? 'true' : 'false');
    });
    updateAria(safeCount);
  }

  async function refreshBadge() {
    if (refreshInFlight) return refreshInFlight;
    if (!window.NB?.unreadNotificationsCount) return;

    refreshInFlight = (async () => {
      try {
        const count = await NB.unreadNotificationsCount();
        renderBadge(count);
        return count;
      } catch (error) {
        console.warn('[NiagaBio] Gagal memperbarui badge notifikasi:', error.message);
        return null;
      } finally {
        refreshInFlight = null;
      }
    })();

    return refreshInFlight;
  }

  async function init() {
    decorateNotificationTargets();
    await refreshBadge();

    window.NB_REFRESH_NOTIFICATIONS = refreshBadge;

    window.addEventListener('niagabio:notification', () => {
      // Event dari Realtime/FCM berarti unread count harus berubah sekarang, bukan menunggu polling.
      void refreshBadge();
    });

    window.addEventListener('niagabio:notification-read', () => {
      void refreshBadge();
    });

    window.addEventListener('niagabio:notifications-cleared', () => {
      void refreshBadge();
    });

    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) void refreshBadge();
    });

    window.addEventListener('focus', () => { void refreshBadge(); });
    window.setInterval(() => { void refreshBadge(); }, 45000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { void init(); }, { once: true });
  } else {
    void init();
  }
})();
