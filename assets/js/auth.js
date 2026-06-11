document.addEventListener('DOMContentLoaded', async () => {
  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');
  const forgotPasswordForm = document.getElementById('forgotPasswordForm');
  const forgotPasswordToggle = document.getElementById('forgotPasswordToggle');
  const forgotPasswordBox = document.getElementById('forgotPasswordBox');
  const passwordResetForm = document.getElementById('passwordResetForm');

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


  if (forgotPasswordToggle && forgotPasswordBox) {
    forgotPasswordToggle.addEventListener('click', () => {
      forgotPasswordBox.hidden = !forgotPasswordBox.hidden;
      const emailInput = document.getElementById('forgotEmail');
      if (emailInput && !emailInput.value && typeof loginEmail !== 'undefined') {
        emailInput.value = loginEmail.value.trim();
      }
      if (!forgotPasswordBox.hidden) emailInput?.focus();
    });
  }

  if (forgotPasswordForm) {
    forgotPasswordForm.addEventListener('submit', async event => {
      event.preventDefault();
      const button = forgotPasswordForm.querySelector('button[type="submit"]');
      button.disabled = true;
      button.textContent = 'Mengirim...';

      try {
        await NB.requestPasswordReset(forgotEmail.value.trim(), forgotNote.value.trim());
        nbToast('Permintaan reset password terkirim ke Admin Master. Tunggu link reset dari email resmi NiagaBio.');
        forgotPasswordForm.reset();
        if (forgotPasswordBox) forgotPasswordBox.hidden = true;
      } catch (error) {
        nbToast(error.message || 'Gagal mengirim permintaan reset password.', 'danger');
      } finally {
        button.disabled = false;
        button.textContent = 'Kirim Permintaan';
      }
    });
  }

  if (passwordResetForm) {
    passwordResetForm.addEventListener('submit', async event => {
      event.preventDefault();
      const button = passwordResetForm.querySelector('button[type="submit"]');
      const password = newPassword.value;
      const confirm = confirmPassword.value;

      if (password.length < 6) {
        nbToast('Password minimal 6 karakter.', 'danger');
        return;
      }

      if (password !== confirm) {
        nbToast('Konfirmasi password belum sama.', 'danger');
        return;
      }

      button.disabled = true;
      button.textContent = 'Menyimpan...';

      try {
        await NB.updatePassword(password);
        nbToast('Password berhasil diganti. Silakan login ulang.');
        await NB.signOut();
        setTimeout(() => { location.href = 'login'; }, 900);
      } catch (error) {
        nbToast(error.message || 'Gagal menyimpan password baru. Buka ulang link reset dari email.', 'danger');
      } finally {
        button.disabled = false;
        button.textContent = 'Simpan Password Baru';
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
