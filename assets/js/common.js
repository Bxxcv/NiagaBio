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

  const logout = document.querySelector('[data-logout]');
  if (logout) {
    logout.addEventListener('click', async event => {
      event.preventDefault();
      await NB.signOut();
      location.href = 'login';
    });
  }

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
          avatar_url: 'assets/img/logo.jpg',
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
    const page = location.pathname.split('/').pop() || '/';
    const isMaintenancePage = page === 'maintenance';
    const isLoginPage = page === 'login';
    const isAdmin = profile?.role === 'admin';

    if (settings.maintenance_mode && !isAdmin && !isMaintenancePage && !isLoginPage) {
      sessionStorage.setItem('nb_maintenance_message', settings.maintenance_message || 'Website sedang maintenance.');
      location.href = 'maintenance';
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

  document.querySelectorAll('[data-plan]').forEach(element => {
    element.textContent = isAdminProfile ? 'Admin' : (NB.isPremium(profile) ? 'Premium' : 'Free');
    element.className = isAdminProfile ? 'badge-soft badge-admin' : 'badge-soft';
  });
});

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
        <div class="toast-body fw-semibold">${NB.escapeHtml(message)}</div>
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
  return `<div class="empty-state"><div class="spinner-border text-success mb-3"></div><p class="mb-0">${NB.escapeHtml(text)}</p></div>`;
}
