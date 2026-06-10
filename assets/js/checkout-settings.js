document.addEventListener('DOMContentLoaded', async () => {
  setActiveSide('checkout');

  const user = await NB.requireAuth();
  if (!user) return;

  let profile = await NB.getProfile(user.id);
  let rows = await NB.list('checkout_settings', user.id);
  let settings = rows[0] || {
    id: NB.uid('chk'),
    user_id: user.id,
    checkout_mode: 'whatsapp',
    whatsapp_number: profile?.whatsapp_number || '',
    qris_enabled: false,
    qris_image_url: '',
    qris_name: '',
    payment_note: ''
  };

  const premium = NB.isPremium(profile);

  checkoutMode.value = settings.checkout_mode || 'whatsapp';
  checkoutWhatsApp.value = settings.whatsapp_number || profile?.whatsapp_number || '';
  qrisName.value = settings.qris_name || '';
  paymentNote.value = settings.payment_note || '';
  qrisPreview.src = NB.normalizeImageUrl(settings.qris_image_url || 'assets/img/logo.jpg', 'assets/img/logo.jpg');
  qrisEnabled.checked = Boolean(settings.qris_enabled);

  if (!premium) {
    premiumNotice.classList.remove('d-none');
    qrisEnabled.disabled = true;
    checkoutMode.value = 'whatsapp';
    checkoutMode.querySelector('option[value="qris_manual"]').disabled = true;
    checkoutMode.querySelector('option[value="qris_whatsapp"]').disabled = true;
  }

  qrisImage.addEventListener('change', () => {
    if (qrisImage.files[0]) qrisPreview.src = URL.createObjectURL(qrisImage.files[0]);
  });

  checkoutForm.addEventListener('submit', async event => {
    event.preventDefault();
    const button = checkoutForm.querySelector('button[type="submit"]');
    button.disabled = true;

    try {
      let qrisUrl = settings.qris_image_url || '';
      if (premium && qrisImage.files[0]) qrisUrl = await NB.uploadFile(qrisImage.files[0], 'qris');

      const payload = {
        id: settings.id,
        user_id: user.id,
        checkout_mode: premium ? checkoutMode.value : 'whatsapp',
        whatsapp_number: checkoutWhatsApp.value.trim(),
        qris_enabled: premium ? qrisEnabled.checked : false,
        qris_image_url: premium ? NB.normalizeImageUrl(qrisUrl, '') : '',
        qris_name: qrisName.value.trim(),
        payment_note: paymentNote.value.trim(),
        created_at: settings.created_at || NB.now()
      };

      settings = await NB.save('checkout_settings', payload);
      profile = await NB.upsertProfile({
        user_id: user.id,
        email: profile?.email || user.email,
        username: profile?.username || NB.slugify(user.email.split('@')[0]),
        display_name: profile?.display_name || user.email.split('@')[0],
        bio: profile?.bio || '',
        avatar_url: profile?.avatar_url || 'assets/img/logo.jpg',
        whatsapp_number: checkoutWhatsApp.value.trim(),
        theme_name: profile?.theme_name || 'service'
      });

      nbToast('Pengaturan checkout disimpan.');
    } catch (error) {
      const message = String(error?.message || 'Gagal menyimpan checkout.');
      if (/row-level security policy/i.test(message)) {
        nbToast('Upload QRIS ditolak RLS Supabase. Jalankan supabase/09_fix_storage_qris_upload_rls.sql di SQL Editor.', 'danger');
      } else {
        nbToast(message, 'danger');
      }
    } finally {
      button.disabled = false;
    }
  });
});
