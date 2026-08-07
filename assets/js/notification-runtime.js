(function () {
  'use strict';

  const BADGE_SELECTOR = '[data-notif-badge]';
  const CHANNEL_NAME = 'niagabio:notifications';
  const DEFAULT_INTERVAL = 45000;
  const IDLE_INTERVAL = 120000;
  const MAX_BACKOFF = 600000;

  let refreshInFlight = null;
  let pollTimer = null;
  let backoffMs = DEFAULT_INTERVAL;
  let broadcastChannel = null;
  let online = navigator.onLine;

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
    if (!window.NB?.unreadNotificationsCount) return null;

    refreshInFlight = (async () => {
      try {
        const count = await NB.unreadNotificationsCount();
        renderBadge(count);
        scheduleNextPoll(count > 0 ? DEFAULT_INTERVAL : IDLE_INTERVAL);
        return count;
      } catch (error) {
        console.warn('[NiagaBio] Gagal memperbarui badge notifikasi:', error.message);
        scheduleNextPoll(Math.min(backoffMs * 1.5, MAX_BACKOFF));
        return null;
      } finally {
        refreshInFlight = null;
      }
    })();

    return refreshInFlight;
  }

  function scheduleNextPoll(interval) {
    if (pollTimer !== null) clearTimeout(pollTimer);
    backoffMs = interval;
    pollTimer = setTimeout(() => {
      pollTimer = null;
      void refreshBadge();
    }, interval);
  }

  function setupCrossTab() {
    if (!('BroadcastChannel' in window)) return;
    try {
      broadcastChannel = new BroadcastChannel(CHANNEL_NAME);
      broadcastChannel.addEventListener('message', event => {
        const type = event?.data?.type;
        if (!type) return;

        if (type === 'refresh') {
          void refreshBadge();
        } else if (type === 'notification' || type === 'read' || type === 'cleared') {
          void refreshBadge();
        }
      });
    } catch (error) {
      console.warn('[NiagaBio] BroadcastChannel tidak tersedia:', error.message);
      broadcastChannel = null;
    }
  }

  function notifyCrossTab(type, detail = {}) {
    if (broadcastChannel) {
      try {
        broadcastChannel.postMessage({ type, ...detail, ts: Date.now() });
      } catch (_) {}
    }
  }

  async function init() {
    decorateNotificationTargets();
    await refreshBadge();

    window.NB_REFRESH_NOTIFICATIONS = refreshBadge;
    window.NB_NOTIFY_CROSS_TAB = notifyCrossTab;

    setupCrossTab();

    window.addEventListener('niagabio:notification', () => {
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

    window.addEventListener('online', () => {
      online = true;
      void refreshBadge();
    });

    window.addEventListener('offline', () => {
      online = false;
      if (pollTimer !== null) clearTimeout(pollTimer);
      pollTimer = setTimeout(() => {
        pollTimer = null;
        void refreshBadge();
      }, 5000);
    });

    void scheduleInitialPoll();
  }

  async function scheduleInitialPoll() {
    void refreshBadge();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { void init(); }, { once: true });
  } else {
    void init();
  }
})();
