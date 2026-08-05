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
      avatar_url: 'assets/img/logo.jpg',
      whatsapp_number: '',
      theme_name: 'service'
    });
  }

  profileName.value = profile.display_name || '';
  profileUsername.value = profile.username || '';
  profileBio.value = profile.bio || '';
  profileWhatsApp.value = profile.whatsapp_number || '';
  avatarPreview.src = NB.normalizeImageUrl(profile.avatar_url || 'assets/img/logo.jpg', 'assets/img/logo.jpg');

  const premiumStoreLogoHint = document.getElementById('premiumStoreLogoHint');
  if (premiumStoreLogoHint) {
    premiumStoreLogoHint.innerHTML = NB.isPremium(profile)
      ? '<i class="bi bi-patch-check-fill text-success me-1"></i>Logo ini juga menjadi ikon tab browser dan halaman checkout toko Premium.'
      : 'Logo ini muncul di halaman publik. Ikon tab khusus toko tersedia setelah akun Premium aktif.';
  }

  profileAvatar.addEventListener('change', () => {
    if (profileAvatar.files[0]) avatarPreview.src = URL.createObjectURL(profileAvatar.files[0]);
  });

  profileForm.addEventListener('submit', async event => {
    event.preventDefault();
    const button = profileForm.querySelector('button[type="submit"]');
    button.disabled = true;

    try {
      let avatar = profile.avatar_url || 'assets/img/logo.jpg';
      if (profileAvatar.files[0]) avatar = await NB.uploadFile(profileAvatar.files[0], 'avatars');

      const updated = await NB.upsertProfile({
        user_id: user.id,
        email: user.email,
        username: NB.slugify(profileUsername.value) || profile.username,
        display_name: profileName.value.trim() || 'User NiagaBio',
        bio: profileBio.value.trim(),
        whatsapp_number: profileWhatsApp.value.trim(),
        avatar_url: NB.normalizeImageUrl(avatar, 'assets/img/logo.jpg'),
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
