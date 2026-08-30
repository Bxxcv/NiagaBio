// NiagaBio Admin Master — Laporan Platform
(function () {
  const A = window.NBAdmin;
  const { refs, state, setText, platformPremiumRevenue, downloadCsv } = A;

  function renderReports() {
    const approved = state.premiumRequests.filter(A.isApprovedRequest);
    const pending = state.premiumRequests.filter(A.isPendingRequest);
    const sevenDays = Date.now() + 7 * 24 * 60 * 60 * 1000;
    const expiring = state.profiles.filter(profile => {
      if (profile.status !== 'active' || profile.plan !== 'premium' || !profile.plan_end_date) return false;
      const time = new Date(profile.plan_end_date).getTime();
      return Number.isFinite(time) && time <= sevenDays && time >= Date.now();
    });

    const paidOrders = state.orders.filter(order => String(order.payment_status || '').toLowerCase() === 'paid');
    const sellerFeeRevenue = paidOrders.reduce((sum, order) => sum + Number(order.platform_fee || 0), 0);
    const gatewayFee = paidOrders.reduce((sum, order) => sum + Number(order.gateway_fee || 0), 0);
    const withdrawalReserve = paidOrders.reduce((sum, order) => sum + Number(order.withdrawal_reserve || 0), 0);
    const sellerEarning = paidOrders.reduce((sum, order) => sum + Number(order.seller_earning || order.total_price || 0), 0);
    const premiumRevenue = platformPremiumRevenue();

    setText(refs.platformRevenueValue, NB.money(premiumRevenue));
    setText(refs.platformSellerFeeRevenue, NB.money(sellerFeeRevenue));
    setText(refs.platformTotalRevenue, NB.money(premiumRevenue + sellerFeeRevenue));
    setText(refs.platformGatewayFee, NB.money(gatewayFee));
    setText(refs.platformWithdrawalReserve, NB.money(withdrawalReserve));
    setText(refs.platformSellerEarning, NB.money(sellerEarning));
    setText(refs.platformApprovedRequests, approved.length);
    setText(refs.platformPendingRequests, pending.length);
    setText(refs.platformExpiringSoon, expiring.length);
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

  A.registerRenderer(renderReports);
  A.registerBinder(() => {
    refs.exportUsersBtn?.addEventListener('click', exportUsersCsv);
    refs.exportRequestsBtn?.addEventListener('click', exportRequestsCsv);
    refs.printReportBtn?.addEventListener('click', () => window.print());
  });
})();
