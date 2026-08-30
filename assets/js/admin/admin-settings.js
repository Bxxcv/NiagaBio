// NiagaBio Admin Master — Setting Platform
(function () {
  const A = window.NBAdmin;
  const { refs, state } = A;

  function renderSettings() {
    if (refs.maintenanceMode) refs.maintenanceMode.checked = Boolean(state.settings.maintenance_mode);
    if (refs.allowRegister) refs.allowRegister.checked = state.settings.allow_register !== false;
    if (refs.maintenanceMessage) refs.maintenanceMessage.value = state.settings.maintenance_message || '';
    if (refs.premiumPrice) nbSetRupiahInputValue(refs.premiumPrice, state.settings.premium_price || 80000);
    if (refs.adminWhatsApp) refs.adminWhatsApp.value = state.settings.admin_whatsapp || '';
    if (refs.premiumQrisUrl) refs.premiumQrisUrl.value = state.settings.premium_qris_url || '';
    if (refs.premiumNote) refs.premiumNote.value = state.settings.premium_note || '';
    if (refs.platformFee) nbSetRupiahInputValue(refs.platformFee, state.settings.platform_fee ?? 1000);
    if (refs.withdrawalReserve) nbSetRupiahInputValue(refs.withdrawalReserve, state.settings.withdrawal_reserve ?? 2500);
    if (refs.paymentProvider) refs.paymentProvider.value = state.settings.payment_provider || 'buatqris';
    if (refs.paymentGatewayEnabled) refs.paymentGatewayEnabled.checked = state.settings.payment_gateway_enabled !== false;
    if (refs.paymentSandbox) refs.paymentSandbox.checked = state.settings.payment_sandbox !== false;
  }

  async function saveAdminSettings(event) {
    event.preventDefault();

    if (refs.saveSettingsBtn) {
      refs.saveSettingsBtn.disabled = true;
      refs.saveSettingsBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Menyimpan';
    }

    try {
      let premiumQrisUrl = refs.premiumQrisUrl?.value.trim() || '';
      const qrisFile = refs.premiumQrisFile?.files?.[0];
      if (qrisFile) premiumQrisUrl = await NB.uploadFile(qrisFile, 'premium-qris');

      await NB.saveSettings({
        maintenance_mode: refs.maintenanceMode?.checked,
        maintenance_message: refs.maintenanceMessage?.value.trim(),
        allow_register: refs.allowRegister?.checked,
        premium_price: nbParseRupiah(refs.premiumPrice?.value || 80000),
        admin_whatsapp: refs.adminWhatsApp?.value.trim(),
        platform_fee: nbParseRupiah(refs.platformFee?.value || 1000),
        withdrawal_reserve: nbParseRupiah(refs.withdrawalReserve?.value || 2500),
        payment_provider: refs.paymentProvider?.value || 'buatqris',
        payment_gateway_enabled: refs.paymentGatewayEnabled?.checked !== false,
        payment_sandbox: refs.paymentSandbox?.checked !== false,
        premium_qris_url: premiumQrisUrl,
        premium_note: refs.premiumNote?.value.trim()
      });

      if (refs.premiumQrisFile) refs.premiumQrisFile.value = '';
      state.settings = await NB.getSettings();
      nbToast('Setting platform berhasil disimpan dan diverifikasi.');
      renderSettings();
      A.renderAll();
    } catch (error) {
      nbToast(error.message || 'Gagal simpan setting.', 'danger');
    } finally {
      if (refs.saveSettingsBtn) {
        refs.saveSettingsBtn.disabled = false;
        refs.saveSettingsBtn.innerHTML = '<i class="bi bi-save me-1"></i>Simpan Setting';
      }
    }
  }

  A.registerRenderer(renderSettings);
  A.registerBinder(() => {
    refs.settingsForm?.addEventListener('submit', saveAdminSettings);
    refs.resetSettingsBtn?.addEventListener('click', A.refresh);
  });
})();
