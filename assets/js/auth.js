document.addEventListener('DOMContentLoaded', async () => {
  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');

  if (loginForm) {
    loginForm.addEventListener('submit', async event => {
      event.preventDefault();
      const button = loginForm.querySelector('button[type="submit"]');
      button.disabled = true;
      button.textContent = 'Memproses...';

      try {
        const user = await NB.signIn(loginEmail.value.trim(), loginPassword.value);
        const profile = user ? await NB.getProfile(user.id) : null;
        nbToast('Login berhasil.');
        location.href = profile?.role === 'admin' ? 'admin' : 'dashboard';
      } catch (error) {
        nbToast(error.message || 'Gagal login.', 'danger');
      } finally {
        button.disabled = false;
        button.textContent = 'Masuk';
      }
    });
  }

  if (registerForm) {
    try {
      const settings = await NB.getSettings();
      if (!settings.allow_register) {
        registerForm.querySelectorAll('input, button').forEach(element => {
          element.disabled = true;
        });
        registerForm.insertAdjacentHTML('beforebegin', '<div class="alert alert-warning">Pendaftaran sedang ditutup oleh admin.</div>');
      }
    } catch (error) {
      console.warn('[NiagaBio] Gagal membaca status register:', error.message);
    }

    registerForm.addEventListener('submit', async event => {
      event.preventDefault();
      const button = registerForm.querySelector('button[type="submit"]');
      button.disabled = true;
      button.textContent = 'Membuat akun...';

      try {
        const settings = await NB.getSettings();
        if (!settings.allow_register) throw new Error('Pendaftaran sedang ditutup oleh admin.');

        await NB.signUp(registerEmail.value.trim(), registerPassword.value, registerName.value.trim());
        nbToast('Akun berhasil dibuat. Plan kamu otomatis Free.');
        location.href = 'dashboard';
      } catch (error) {
        nbToast(error.message || 'Gagal daftar.', 'danger');
      } finally {
        button.disabled = false;
        button.textContent = 'Daftar Gratis';
      }
    });
  }
});
