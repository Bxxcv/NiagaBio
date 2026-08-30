// NiagaBio Admin Master — Boot sequence (runs last, after every admin-*.js has registered)
document.addEventListener('DOMContentLoaded', async () => {
  const A = window.NBAdmin;

  A.state.currentUser = await NB.requireAuth();
  if (!A.state.currentUser) return;

  try {
    A.state.me = await NB.getProfile(A.state.currentUser.id);
  } catch (error) {
    nbToast(error.message || 'Gagal membaca profil admin.', 'danger');
    return;
  }

  if (A.state.me?.role !== 'admin') {
    A.showAccessDenied();
    return;
  }

  A.bindCoreEvents();
  A.bindAll();
  A.setAdminView(A.initialAdminView());
  await A.refresh();
});
