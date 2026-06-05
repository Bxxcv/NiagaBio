document.addEventListener('DOMContentLoaded', async () => {
  setActiveSide('dashboard');

  const user = await NB.requireAuth();
  if (!user) return;

  try {
    const profile = await NB.getProfile(user.id);
    document.querySelectorAll('[data-user-name]').forEach(element => {
      element.textContent = profile?.display_name || user.email;
    });
    document.querySelectorAll('[data-plan]').forEach(element => {
      element.textContent = NB.isPremium(profile) ? 'Premium' : 'Free';
      element.className = 'badge-soft';
    });

    const products = await NB.list('products', user.id);
    const orders = await NB.list('orders', user.id, 'seller_id');
    const paidOrders = orders.filter(order => order.payment_status === 'paid');
    const pendingOrders = orders.filter(order => order.payment_status === 'pending');
    const revenue = paidOrders.reduce((sum, order) => sum + Number(order.total_price || 0), 0);

    metricProducts.textContent = products.length;
    metricOrders.textContent = orders.length;
    metricPending.textContent = pendingOrders.length;
    metricRevenue.textContent = NB.money(revenue);

    recentOrders.innerHTML = orders.slice(0, 5).map(order => `
      <tr>
        <td class="fw-bold">${NB.escapeHtml(order.product_name)}</td>
        <td>${NB.escapeHtml(order.buyer_name)}</td>
        <td>${NB.money(order.total_price)}</td>
        <td><span class="badge ${order.payment_status === 'paid' ? 'text-bg-success' : order.payment_status === 'cancelled' ? 'text-bg-secondary' : 'text-bg-warning'}">${NB.escapeHtml(order.payment_status)}</span></td>
      </tr>
    `).join('') || '<tr><td colspan="4" class="text-center text-muted">Belum ada pesanan.</td></tr>';
  } catch (error) {
    nbToast(error.message || 'Gagal memuat dashboard.', 'danger');
  }
});
