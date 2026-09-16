document.addEventListener('DOMContentLoaded', async () => {
  setActiveSide('checkout');

  const user = await NB.requireAuth();
  if (!user) return;

  let rows = await NB.list('checkout_settings', user.id);
  let settings = rows[0] || null;

  successMessage.value = settings?.success_message || '';
  successRedirectUrl.value = settings?.success_redirect_url || '';
  updatePreview();

  successMessage.addEventListener('input', updatePreview);

  function updatePreview() {
    const text = successMessage.value.trim();
    successPreviewText.textContent = text || 'Belum ada pesan custom.';
    successPreviewNote.classList.toggle('is-empty', !text);
  }

  checkoutForm.addEventListener('submit', async event => {
    event.preventDefault();
    const button = checkoutForm.querySelector('button[type="submit"]');
    button.disabled = true;

    try {
      const payload = {
        user_id: user.id,
        success_message: successMessage.value.trim(),
        success_redirect_url: successRedirectUrl.value.trim()
      };
      if (settings?.id) payload.id = settings.id;

      settings = await NB.save('checkout_settings', payload);
      nbToast('Pesan berhasil disimpan.');
    } catch (error) {
      nbToast(error.message || 'Gagal menyimpan pesan.', 'danger');
    } finally {
      button.disabled = false;
    }
  });
});
