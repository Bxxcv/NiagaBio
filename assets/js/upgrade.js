document.addEventListener('DOMContentLoaded', async () => {
  try {
    const settings = await NB.getSettings();
    const price = NB.money(settings.premium_price || NB.cfg.PREMIUM_PRICE || 80000);
    document.querySelectorAll('[data-premium-price]').forEach(element => {
      element.textContent = price;
    });
    document.querySelectorAll('[data-upgrade-wa]').forEach(link => {
      link.href = NB.whatsappUrl(settings.admin_whatsapp, 'Halo admin, saya mau upgrade Premium NiagaBio');
    });
  } catch (error) {
    console.warn('[NiagaBio] Gagal update halaman upgrade:', error.message);
  }
});
