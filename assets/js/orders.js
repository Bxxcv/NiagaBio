document.addEventListener('DOMContentLoaded', async () => {
  setActiveSide('orders');

  const user = await NB.requireAuth();
  if (!user) return;

  async function render() {
    const orders = await NB.list('orders', user.id, 'seller_id');
    const paid = orders.filter(order => order.payment_status === 'paid');

    orderOmset.textContent = NB.money(paid.reduce((sum, order) => sum + Number(order.total_price || 0), 0));
    orderPending.textContent = orders.filter(order => order.payment_status === 'pending').length;
    orderPaid.textContent = paid.length;

    orderRows.innerHTML = orders.map(order => `
      <tr>
        <td>
          <div class="fw-bold">${NB.escapeHtml(order.product_name)}</div>
          <small class="text-muted">${new Date(order.created_at).toLocaleString('id-ID')}</small>
        </td>
        <td>${NB.escapeHtml(order.buyer_name)}<br><small>${NB.escapeHtml(order.buyer_phone)}</small></td>
        <td>${NB.money(order.total_price)}</td>
        <td>${NB.escapeHtml(order.payment_method)}</td>
        <td>${order.proof_image_url ? `<a href="${NB.escapeHtml(order.proof_image_url)}" target="_blank"><img src="${NB.escapeHtml(order.proof_image_url)}" class="proof-img" alt="Bukti"></a>` : '-'}</td>
        <td><span class="badge ${order.payment_status === 'paid' ? 'text-bg-success' : order.payment_status === 'cancelled' ? 'text-bg-secondary' : 'text-bg-warning'}">${NB.escapeHtml(order.payment_status)}</span></td>
        <td class="text-end">
          <button class="btn btn-sm btn-success" data-paid="${order.id}" ${order.payment_status === 'paid' ? 'disabled' : ''}>Paid</button>
          <button class="btn btn-sm btn-outline-danger" data-cancel="${order.id}" ${order.payment_status === 'cancelled' ? 'disabled' : ''}>Batal</button>
        </td>
      </tr>
    `).join('') || '<tr><td colspan="7" class="text-center text-muted">Belum ada pesanan.</td></tr>';

    document.querySelectorAll('[data-paid]').forEach(button => {
      button.addEventListener('click', async () => updateStatus(orders.find(item => item.id === button.dataset.paid), 'paid'));
    });

    document.querySelectorAll('[data-cancel]').forEach(button => {
      button.addEventListener('click', async () => updateStatus(orders.find(item => item.id === button.dataset.cancel), 'cancelled'));
    });
  }

  async function updateStatus(order, status) {
    if (!order) return;

    try {
      await NB.save('orders', {
        ...order,
        payment_status: status,
        paid_at: status === 'paid' ? NB.now() : null
      });
      nbToast(status === 'paid' ? 'Order dikonfirmasi paid.' : 'Order dibatalkan.');
      render();
    } catch (error) {
      nbToast(error.message || 'Gagal update order.', 'danger');
    }
  }

  render();
});
