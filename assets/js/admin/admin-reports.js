// NiagaBio Admin Master — Laporan Platform
(function () {
  const A = window.NBAdmin;
  const { refs, state, setText, platformPremiumRevenue, downloadCsv } = A;

  function periodStartMs() {
    const period = refs.reportPeriod?.value || 'all';
    const now = new Date();
    let start = null;
    if (period === 'today') start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    else if (period === '7d') start = now.getTime() - 7 * 24 * 60 * 60 * 1000;
    else if (period === '30d') start = now.getTime() - 30 * 24 * 60 * 60 * 1000;

    const resetAt = state.settings?.reports_reset_at ? new Date(state.settings.reports_reset_at).getTime() : null;
    if (Number.isFinite(resetAt)) {
      start = start === null ? resetAt : Math.max(start, resetAt);
    }
    return start;
  }

  function inPeriod(value, startMs) {
    if (startMs === null) return true;
    const t = new Date(value).getTime();
    return Number.isFinite(t) && t >= startMs;
  }

  function renderReports() {
    const startMs = periodStartMs();
    const approved = state.premiumRequests.filter(A.isApprovedRequest);
    const pending = state.premiumRequests.filter(A.isPendingRequest);
    const sevenDays = Date.now() + 7 * 24 * 60 * 60 * 1000;
    const expiring = state.profiles.filter(profile => {
      if (profile.status !== 'active' || profile.plan !== 'premium' || !profile.plan_end_date) return false;
      const time = new Date(profile.plan_end_date).getTime();
      return Number.isFinite(time) && time <= sevenDays && time >= Date.now();
    });

    const paidOrders = state.orders.filter(order => String(order.payment_status || '').toLowerCase() === 'paid'
      && inPeriod(order.paid_at || order.updated_at || order.created_at, startMs));
    const sellerFeeRevenue = paidOrders.reduce((sum, order) => sum + Number(order.platform_fee || 0), 0);
    const gatewayFee = paidOrders.reduce((sum, order) => sum + Number(order.gateway_fee || 0), 0);
    const withdrawalReserve = paidOrders.reduce((sum, order) => sum + Number(order.withdrawal_reserve || 0), 0);
    const sellerEarning = paidOrders.reduce((sum, order) => sum + Number(order.seller_earning || order.total_price || 0), 0);
    const approvedInPeriod = approved.filter(request => inPeriod(request.reviewed_at || request.updated_at || request.created_at, startMs));
    const premiumRevenue = approvedInPeriod.reduce((sum, request) => {
      const amount = Number(request.approved_amount || request.amount || 0);
      return sum + (Number.isFinite(amount) && amount > 0 ? amount : A.premiumPrice());
    }, 0);

    setText(refs.platformRevenueValue, NB.money(premiumRevenue));
    setText(refs.platformSellerFeeRevenue, NB.money(sellerFeeRevenue));
    setText(refs.platformTotalRevenue, NB.money(premiumRevenue + sellerFeeRevenue));
    setText(refs.platformGatewayFee, NB.money(gatewayFee));
    setText(refs.platformWithdrawalReserve, NB.money(withdrawalReserve));
    setText(refs.platformSellerEarning, NB.money(sellerEarning));
    setText(refs.platformApprovedRequests, approvedInPeriod.length);
    setText(refs.platformPendingRequests, pending.length);
    setText(refs.platformExpiringSoon, expiring.length);

    if (refs.reportsResetNotice) {
      const resetAt = state.settings?.reports_reset_at;
      if (resetAt) {
        refs.reportsResetNotice.textContent = `Tampilan direset sejak ${NB.formatDateTime ? NB.formatDateTime(resetAt) : new Date(resetAt).toLocaleString('id-ID')} — data lama disembunyikan (bukan dihapus).`;
        refs.reportsResetNotice.classList.remove('d-none');
      } else {
        refs.reportsResetNotice.classList.add('d-none');
      }
    }
  }

  function exportUsersCsv() {
    downloadCsv('niagabio-users.csv', [
      ['email', 'username', 'display_name', 'plan', 'status', 'plan_end_date', 'created_at'],
      ...state.profiles.map(profile => [profile.email, profile.username, profile.display_name, profile.plan, profile.status, profile.plan_end_date, profile.created_at])
    ]);
  }

  function exportRequestsCsv() {
    downloadCsv('niagabio-premium-requests.csv', [
      ['email', 'shop_name', 'owner_name', 'status', 'proof_url', 'note', 'created_at', 'reviewed_at'],
      ...state.premiumRequests.map(request => [request.email, request.shop_name, request.owner_name, request.status, request.proof_url, request.note, request.created_at, request.reviewed_at])
    ]);
  }

  async function resetReportsView(e) {
    const clearInstead = e.altKey; // sambil tekan Alt = balikin lihat semua data lagi
    const msg = clearInstead
      ? 'Tampilkan semua data laporan lagi (batalkan reset)?'
      : 'Reset tampilan Laporan? Ini CUMA reset tampilan — data order asli di database tetap aman, tidak ada yang dihapus. Bisa dibatalkan kapan saja (klik tombol ini sambil tekan Alt).';
    if (!confirm(msg)) return;
    try {
      const updated = await NB.resetReportsView(clearInstead);
      state.settings = { ...state.settings, ...updated };
      nbToast(clearInstead ? 'Laporan menampilkan semua data lagi.' : 'Tampilan laporan berhasil direset.');
      renderReports();
    } catch (error) {
      nbToast(error.message || 'Gagal reset tampilan laporan.', 'danger');
    }
  }

  A.registerRenderer(renderReports);
  A.registerBinder(() => {
    refs.exportUsersBtn?.addEventListener('click', exportUsersCsv);
    refs.exportRequestsBtn?.addEventListener('click', exportRequestsCsv);
    refs.printReportBtn?.addEventListener('click', () => window.print());
    refs.reportPeriod?.addEventListener('change', renderReports);
    refs.resetReportsBtn?.addEventListener('click', resetReportsView);
  });
})();
