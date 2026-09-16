document.addEventListener('DOMContentLoaded', async () => {
  setActiveSide('profile');

  const user = await NB.requireAuth();
  if (!user) return;

  let profile = await NB.getProfile(user.id);
  if (!profile) {
    profile = await NB.upsertProfile({
      user_id: user.id,
      email: user.email,
      username: NB.slugify(user.email.split('@')[0]) || `user-${Date.now()}`,
      display_name: user.email.split('@')[0],
      bio: '',
      avatar_url: 'assets/img/niagabio-logo.svg',
      whatsapp_number: '',
      theme_name: 'service'
    });
  }

  profileName.value = profile.display_name || '';
  profileUsername.value = profile.username || '';
  profileBio.value = profile.bio || '';
  profileWhatsApp.value = profile.whatsapp_number || '';
  avatarPreview.src = NB.normalizeImageUrl(profile.avatar_url || 'assets/img/niagabio-logo.svg', 'assets/img/niagabio-logo.svg');

  profileAvatar.addEventListener('change', () => {
    if (profileAvatar.files[0]) avatarPreview.src = URL.createObjectURL(profileAvatar.files[0]);
  });

  let checkoutSettings = (await NB.list('checkout_settings', user.id))[0] || null;
  if (successMessage) successMessage.value = checkoutSettings?.success_message || '';
  if (successRedirectUrl) successRedirectUrl.value = checkoutSettings?.success_redirect_url || '';

  successMessageForm?.addEventListener('submit', async event => {
    event.preventDefault();
    const button = successMessageForm.querySelector('button[type="submit"]');
    button.disabled = true;
    try {
      const payload = {
        user_id: user.id,
        success_message: successMessage.value.trim(),
        success_redirect_url: successRedirectUrl.value.trim()
      };
      if (checkoutSettings?.id) payload.id = checkoutSettings.id;
      checkoutSettings = await NB.save('checkout_settings', payload);
      nbToast('Pesan berhasil disimpan.');
    } catch (error) {
      nbToast(error.message || 'Gagal simpan pesan.', 'danger');
    } finally {
      button.disabled = false;
    }
  });

  profileForm.addEventListener('submit', async event => {
    event.preventDefault();
    const button = profileForm.querySelector('button[type="submit"]');
    button.disabled = true;

    try {
      let avatar = profile.avatar_url || 'assets/img/niagabio-logo.svg';
      if (profileAvatar.files[0]) avatar = await NB.uploadFile(profileAvatar.files[0], 'avatars');

      const updated = await NB.upsertProfile({
        user_id: user.id,
        email: user.email,
        username: NB.slugify(profileUsername.value) || profile.username,
        display_name: profileName.value.trim() || 'User NiagaBio',
        bio: profileBio.value.trim(),
        whatsapp_number: profileWhatsApp.value.trim(),
        avatar_url: NB.normalizeImageUrl(avatar, 'assets/img/niagabio-logo.svg'),
        theme_name: profile.theme_name || 'service'
      });

      profile = { ...profile, ...updated };
      nbToast('Profil berhasil disimpan.');
    } catch (error) {
      nbToast(error.message || 'Gagal simpan profil.', 'danger');
    } finally {
      button.disabled = false;
    }
  });
});
