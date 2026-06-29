document.addEventListener('DOMContentLoaded', async () => {
  document.querySelectorAll('[data-year]').forEach(element => {
    element.textContent = new Date().getFullYear();
  });

  const sidebar = document.querySelector('.sidebar');
  const sidebarOverlay = document.createElement('button');
  sidebarOverlay.type = 'button';
  sidebarOverlay.className = 'sidebar-overlay';
  sidebarOverlay.setAttribute('aria-label', 'Tutup menu');
  document.body.appendChild(sidebarOverlay);

  function setSidebar(open) {
    if (!sidebar) return;
    sidebar.classList.toggle('show', open);
    document.body.classList.toggle('sidebar-open', open);
    document.querySelectorAll('[data-sidebar-toggle]').forEach(button => {
      button.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  }

  document.querySelectorAll('[data-sidebar-toggle]').forEach(button => {
    button.setAttribute('aria-expanded', 'false');
    button.addEventListener('click', () => setSidebar(!sidebar?.classList.contains('show')));
  });

  sidebarOverlay.addEventListener('click', () => setSidebar(false));

  document.querySelectorAll('.sidebar .side-link').forEach(link => {
    link.addEventListener('click', () => {
      if (window.innerWidth < 992) setSidebar(false);
    });
  });

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') setSidebar(false);
  });

  window.addEventListener('resize', () => {
    if (window.innerWidth >= 992) setSidebar(false);
  });

  const hasNBClient = Boolean(window.NB);

  const logout = document.querySelector('[data-logout]');
  if (logout && hasNBClient) {
    logout.addEventListener('click', async event => {
      event.preventDefault();
      await NB.signOut();
      location.href = 'login';
    });
  }

  // Halaman publik/legal hanya memuat common.js tanpa Supabase client.
  // Jangan jalankan auth/maintenance guard kalau NB belum tersedia.
  if (!hasNBClient) return;

  const user = await NB.currentUser();
  let profile = null;

  if (document.body.dataset.protected === 'true' && !user) {
    location.href = 'login';
    return;
  }

  if (user) {
    try {
      profile = await NB.getProfile(user.id);
      if (!profile && document.body.dataset.protected === 'true') {
        profile = await NB.upsertProfile({
          user_id: user.id,
          email: user.email,
          username: NB.slugify(user.email.split('@')[0]) || `user-${Date.now()}`,
          display_name: user.email.split('@')[0],
          bio: '',
          avatar_url: 'assets/img/brand/logo.png',
          whatsapp_number: '',
          theme_name: 'service'
        });
      }
    } catch (error) {
      console.warn('[NiagaBio] Gagal memuat profil:', error.message);
    }
  }

  try {
    const settings = await NB.getSettings();
    const page = (location.pathname.split('/').filter(Boolean).pop() || 'index').replace(/\.html$/i, '');
    const maintenanceEnabled = settings.maintenance_mode === true || settings.maintenance_mode === 'true' || settings.maintenance_mode === 1;
    const isMaintenancePage = page === 'maintenance';
    const isLoginPage = page === 'login';
    const isAdmin = String(profile?.role || '').toLowerCase() === 'admin';

    if (maintenanceEnabled && !isAdmin && !isMaintenancePage && !isLoginPage) {
      window.NB_MAINTENANCE_REDIRECTING = true;
      sessionStorage.setItem('nb_maintenance_message', settings.maintenance_message || 'Website sedang maintenance.');
      location.replace('maintenance');
      return;
    }
  } catch (error) {
    console.warn('[NiagaBio] Maintenance guard dilewati:', error.message);
  }

  document.querySelectorAll('[data-auth-show]').forEach(element => element.classList.toggle('d-none', !user));
  document.querySelectorAll('[data-auth-hide]').forEach(element => element.classList.toggle('d-none', Boolean(user)));
  const isAdminProfile = profile?.role === 'admin';
  document.body.classList.toggle('is-admin', isAdminProfile);
  document.querySelectorAll('[data-admin-only]').forEach(element => element.classList.toggle('d-none', !isAdminProfile));

  if (profile?.username) {
    const publicHref = `u?username=${encodeURIComponent(profile.username)}`;
    document.querySelectorAll('a[href^="u?username=demo"], a[href="u"], #sidebarPublicPreview, #openPublicPage, #openPublicPageHero').forEach(link => {
      link.href = publicHref;
    });
    document.querySelectorAll('input[value="u?username=demo"], #publicUrlInput').forEach(input => {
      input.value = `${location.origin}/u?username=${profile.username}`;
    });
  }

  const premiumProfile = NB.isPremium(profile);
  document.querySelectorAll('[data-plan]').forEach(element => {
    element.textContent = isAdminProfile ? 'Admin' : (premiumProfile ? 'Premium' : 'Free');
    element.className = isAdminProfile ? 'badge-soft badge-admin' : 'badge-soft';
  });

  if (premiumProfile || isAdminProfile) {
    document.querySelectorAll('[data-nav="upgrade"], [data-hide-when-premium]').forEach(element => {
      element.classList.add('d-none');
    });
  }


  function ensureNotificationEntry() {
    const navs = document.querySelectorAll('.sidebar nav, .admin-nav');
    navs.forEach(nav => {
      if (nav.querySelector('[data-nav="notifications"]')) return;
      const link = document.createElement('a');
      link.className = 'side-link notification-side-link';
      link.dataset.nav = 'notifications';
      link.href = 'notifications';
      link.innerHTML = '<i class="bi bi-bell"></i><span>Notifikasi</span><span class="notification-badge d-none" data-notif-badge>0</span>';

      const before = nav.querySelector('[data-nav="upgrade"]') || nav.querySelector('[data-admin-only]') || nav.querySelector('hr') || nav.querySelector('.admin-sidebar-divider');
      if (before) nav.insertBefore(link, before);
      else nav.appendChild(link);
    });
  }

  async function refreshNotificationBadge(showToast = false) {
    if (!window.NB?.unreadNotificationsCount) return;
    try {
      const count = await NB.unreadNotificationsCount();
      document.querySelectorAll('[data-notif-badge]').forEach(badge => {
        badge.textContent = count > 99 ? '99+' : String(count);
        badge.classList.toggle('d-none', count <= 0);
      });

      if (showToast && count > 0 && window.NB?.listNotifications) {
        const items = await NB.listNotifications(5);
        const latestUnread = items.find(item => !item.is_read);
        const latestTime = latestUnread ? new Date(latestUnread.created_at).getTime() : 0;
        const previousTime = Number(sessionStorage.getItem('nb_last_notif_toast') || Date.now());
        if (latestUnread && latestTime > previousTime) {
          nbToast(latestUnread.title || 'Ada notifikasi baru', 'warning');
          sessionStorage.setItem('nb_last_notif_toast', String(latestTime));
        }
      }
    } catch (error) {
      console.warn('[NiagaBio] Notifikasi belum siap:', error.message);
    }
  }

  ensureNotificationEntry();
  if ((location.pathname.split('/').filter(Boolean).pop() || '').replace(/\.html$/i, '') === 'notifications') {
    setActiveSide('notifications');
  }
  await refreshNotificationBadge(false);
  sessionStorage.setItem('nb_last_notif_toast', String(Date.now()));
  window.NB_REFRESH_NOTIFICATIONS = () => refreshNotificationBadge(false);
  setInterval(() => refreshNotificationBadge(true), 45000);
});


function nbEscape(value) {
  if (window.NB?.escapeHtml) return NB.escapeHtml(value);
  return String(value ?? '').replace(/[&<>"]/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;'
  }[char]));
}

function nbToast(message, type = 'success') {
  let wrapper = document.querySelector('.toast-container');
  if (!wrapper) {
    wrapper = document.createElement('div');
    wrapper.className = 'toast-container position-fixed bottom-0 end-0 p-3';
    document.body.appendChild(wrapper);
  }

  const id = `toast_${Date.now()}`;
  const className = type === 'danger' ? 'text-bg-danger' : type === 'warning' ? 'text-bg-warning' : 'text-bg-success';
  wrapper.insertAdjacentHTML('beforeend', `
    <div id="${id}" class="toast ${className}" role="alert">
      <div class="d-flex">
        <div class="toast-body fw-semibold">${nbEscape(message)}</div>
        <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
      </div>
    </div>
  `);

  const element = document.getElementById(id);
  const toast = window.bootstrap ? new bootstrap.Toast(element, { delay: 3500 }) : null;
  if (toast) toast.show();
  else alert(message);

  element.addEventListener('hidden.bs.toast', () => element.remove());
}

function setActiveSide(key) {
  document.querySelectorAll('.side-link').forEach(link => {
    link.classList.toggle('active', link.dataset.nav === key);
  });
}

function loadingHtml(text = 'Memuat data...') {
  return `<div class="empty-state"><div class="spinner-border text-success mb-3"></div><p class="mb-0">${nbEscape(text)}</p></div>`;
}
