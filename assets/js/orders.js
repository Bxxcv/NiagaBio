document.addEventListener('DOMContentLoaded', async () => {
  setActiveSide('orders');

  const user = await NB.requireAuth();
  if (!user) return;

  const $ = id => document.getElementById(id);

  function badge(status) {
    if (status === 'paid') return '<span class="badge text-bg-success">paid</span>';
    if (status === 'cancelled') return '<span class="badge text-bg-secondary">cancelled</span>';
    return '<span class="badge text-bg-warning">pending</span>';
  }

  function formatDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  function buildProductRecap(orders) {
    const map = new Map();
    orders.filter(order => order.payment_status === 'paid').forEach(order => {
      const key = order.product_name || 'Produk';
      const current = map.get(key) || { product: key, qty: 0, revenue: 0, orders: 0 };
      current.qty += Number(order.quantity || 1);
      current.revenue += Number(order.total_price || 0);
      current.orders += 1;
      map.set(key, current);
    });

    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
  }

  async function render() {
    const orders = await NB.list('orders', user.id, 'seller_id');
    const paid = orders.filter(order => order.payment_status === 'paid');
    const pending = orders.filter(order => order.payment_status === 'pending');
    const cancelled = orders.filter(order => order.payment_status === 'cancelled');
    const totalOmset = paid.reduce((sum, order) => sum + Number(order.total_price || 0), 0);
    const pendingNominal = pending.reduce((sum, order) => sum + Number(order.total_price || 0), 0);
    const averageOrder = paid.length ? Math.round(totalOmset / paid.length) : 0;
    const productRecap = buildProductRecap(orders);

    $('orderOmset').textContent = NB.money(totalOmset);
    $('orderPending').textContent = pending.length;
    $('orderPaid').textContent = paid.length;
    if ($('orderTotal')) $('orderTotal').textContent = orders.length;
    if ($('orderCancelled')) $('orderCancelled').textContent = cancelled.length;
    if ($('orderPendingNominal')) $('orderPendingNominal').textContent = NB.money(pendingNominal);
    if ($('orderAverage')) $('orderAverage').textContent = NB.money(averageOrder);
    if ($('orderBestProduct')) $('orderBestProduct').textContent = productRecap[0]?.product || '-';

    if ($('recapRows')) {
      $('recapRows').innerHTML = productRecap.map(item => `
        <tr>
          <td class="fw-semibold">${NB.escapeHtml(item.product)}</td>
          <td>${item.orders}</td>
          <td>${item.qty}</td>
          <td class="fw-bold text-green">${NB.money(item.revenue)}</td>
        </tr>
      `).join('') || '<tr><td colspan="4" class="text-center text-muted">Belum ada penjualan paid.</td></tr>';
    }

    $('orderRows').innerHTML = orders.map(order => `
      <tr>
        <td>
          <div class="fw-bold">${NB.escapeHtml(order.product_name)}</div>
          <small class="text-muted">${formatDate(order.created_at)}</small>
        </td>
        <td>${NB.escapeHtml(order.buyer_name)}<br><small>${NB.escapeHtml(order.buyer_phone)}</small></td>
        <td>${NB.money(order.total_price)}<br><small class="text-muted">Qty ${NB.escapeHtml(order.quantity || 1)}</small></td>
        <td>${NB.escapeHtml(order.payment_method)}</td>
        <td>${order.proof_image_url ? `<a href="${NB.escapeHtml(order.proof_image_url)}" target="_blank"><img src="${NB.escapeHtml(order.proof_image_url)}" class="proof-img" alt="Bukti"></a>` : '-'}</td>
        <td>${badge(order.payment_status)}</td>
        <td class="text-end">
          <button class="btn btn-sm btn-success" data-paid="${NB.escapeHtml(order.id)}" ${order.payment_status === 'paid' ? 'disabled' : ''}>Paid</button>
          <button class="btn btn-sm btn-outline-danger" data-cancel="${NB.escapeHtml(order.id)}" ${order.payment_status === 'cancelled' ? 'disabled' : ''}>Batal</button>
        </td>
      </tr>
    `).join('') || '<tr><td colspan="7" class="text-center text-muted">Belum ada pesanan.</td></tr>';

    document.querySelectorAll('[data-paid]').forEach(button => {
      button.addEventListener('click', async () => updateStatus(orders.find(item => String(item.id) === String(button.dataset.paid)), 'paid'));
    });

    document.querySelectorAll('[data-cancel]').forEach(button => {
      button.addEventListener('click', async () => updateStatus(orders.find(item => String(item.id) === String(button.dataset.cancel)), 'cancelled'));
    });
  }

  async function updateStatus(order, status) {
    if (!order) return;

    try {
      await NB.save('orders', { ...order, payment_status: status, paid_at: status === 'paid' ? NB.now() : null });
      nbToast(status === 'paid' ? 'Order dikonfirmasi paid.' : 'Order dibatalkan.');
      render();
    } catch (error) {
      nbToast(error.message || 'Gagal update order.', 'danger');
    }
  }

  render();
});
