document.addEventListener('DOMContentLoaded', async () => {
  setActiveSide('upgrade');

  const user = await NB.requireAuth();
  if (!user) return;

  const profile = await NB.getProfile(user.id);
  const premium = NB.isPremium(profile);
  const settings = await NB.getSettings();
  const price = NB.money(settings.premium_price || NB.cfg.PREMIUM_PRICE || 80000);

  document.querySelectorAll('[data-premium-price]').forEach(element => {
    element.textContent = price;
  });

  const premiumNotice = document.getElementById('premiumUserNotice');
  const freeContent = document.getElementById('upgradeFreeContent');
  const qrisImage = document.getElementById('premiumQrisImage');
  const qrisEmpty = document.getElementById('premiumQrisEmpty');
  const premiumNote = document.getElementById('premiumNote');
  const form = document.getElementById('upgradeRequestForm');
  const submitBtn = document.getElementById('upgradeSubmitBtn');

  if (premium) {
    premiumNotice?.classList.remove('d-none');
    freeContent?.classList.add('d-none');
    return;
  }

  premiumNotice?.classList.add('d-none');
  freeContent?.classList.remove('d-none');

  if (premiumNote) {
    premiumNote.textContent = settings.premium_note || 'Transfer sesuai nominal lalu upload bukti pembayaran. Admin akan memproses upgrade setelah valid.';
  }

  if (settings.premium_qris_url) {
    if (qrisImage) {
      qrisImage.src = NB.normalizeImageUrl(settings.premium_qris_url, 'assets/img/logo.jpg');
      qrisImage.classList.remove('d-none');
    }
    qrisEmpty?.classList.add('d-none');
  } else {
    qrisImage?.classList.add('d-none');
    qrisEmpty?.classList.remove('d-none');
  }

  if (!form) return;

  form.addEventListener('submit', async event => {
    event.preventDefault();

    const shopName = document.getElementById('upgradeShopName')?.value.trim();
    const ownerName = document.getElementById('upgradeOwnerName')?.value.trim();
    const proofFile = document.getElementById('upgradeProof')?.files?.[0];
    const note = document.getElementById('upgradeNote')?.value.trim();

    if (!shopName || !ownerName || !proofFile) {
      nbToast('Nama toko, nama pemilik, dan bukti transfer wajib diisi.', 'warning');
      return;
    }

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Mengirim';

    try {
      const proofUrl = await NB.uploadFile(proofFile, 'premium-proofs');
      await NB.createPremiumRequest({
        shop_name: shopName,
        owner_name: ownerName,
        proof_url: proofUrl,
        note
      });

      nbToast('Pengajuan upgrade terkirim. Tunggu admin memproses upgrade kamu dalam waktu sekitar 2-3 jam.');
      form.reset();
    } catch (error) {
      nbToast(error.message || 'Gagal mengirim pengajuan upgrade.', 'danger');
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<i class="bi bi-send me-1"></i>Kirim Pengajuan Upgrade';
    }
  });
});
