document.addEventListener('DOMContentLoaded', async () => {
  try {
    const settings = await NB.getSettings();
    const fallback = sessionStorage.getItem('nb_maintenance_message');
    maintenanceText.textContent = settings.maintenance_message || fallback || 'Website sedang maintenance. Silakan coba lagi nanti.';
  } catch (error) {
    const fallback = sessionStorage.getItem('nb_maintenance_message');
    maintenanceText.textContent = fallback || 'Website sedang maintenance. Silakan coba lagi nanti.';
  }
});
