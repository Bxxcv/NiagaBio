document.addEventListener('DOMContentLoaded', async () => {
  setActiveSide('orders');

  const user = await NB.requireAuth();
  if (!user) return;

  const $ = id => document.getElementById(id);
  const firstEl = (...ids) => ids.map(id => $(id)).find(Boolean) || null;
  const setText = (ids, value) => {
    const el = Array.isArray(ids) ? firstEl(...ids) : $(ids);
    if (el) el.textContent = String(value ?? '');
  };
  const setHtml = (id, value) => {
    const el = $(id);
    if (el) el.innerHTML = value;
  };
  let allOrders = [];
  let filteredOrders = [];

  function badge(status) {
    if (status === 'paid') return '<span class="badge text-bg-success">selesai</span>';
    if (status === 'cancelled') return '<span class="badge text-bg-secondary">batal</span>';
    return '<span class="badge text-bg-warning">menunggu</span>';
  }

  function formatDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  function isInsideDateFilter(order, filter) {
    if (filter === 'all') return true;
    const created = new Date(order.created_at);
    if (Number.isNaN(created.getTime())) return false;

    const now = new Date();
    if (filter === 'today') {
      return created.toDateString() === now.toDateString();
    }

    const days = filter === '7d' ? 7 : 30;
    const minTime = now.getTime() - days * 24 * 60 * 60 * 1000;
    return created.getTime() >= minTime;
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

  function computeSummary(orders) {
    const paid = orders.filter(order => order.payment_status === 'paid');
    const pending = orders.filter(order => order.payment_status === 'pending');
    const cancelled = orders.filter(order => order.payment_status === 'cancelled');
    const totalOmset = paid.reduce((sum, order) => sum + Number(order.total_price || 0), 0);
    const pendingNominal = pending.reduce((sum, order) => sum + Number(order.total_price || 0), 0);
    const averageOrder = paid.length ? Math.round(totalOmset / paid.length) : 0;
    const productRecap = buildProductRecap(orders);

    return { paid, pending, cancelled, totalOmset, pendingNominal, averageOrder, productRecap };
  }

  function applyFilters() {
    const query = ($('orderSearch')?.value || '').toLowerCase().trim();
    const rawStatus = $('statusFilter')?.value || 'all';
    const statusMap = { selesai: 'paid', batal: 'cancelled' };
    const status = statusMap[rawStatus] || rawStatus;
    const dateFilter = $('dateFilter')?.value || 'all';

    filteredOrders = allOrders.filter(order => {
      const text = `${order.product_name || ''} ${order.buyer_name || ''} ${order.buyer_phone || ''} ${order.payment_method || ''}`.toLowerCase();
      const matchText = !query || text.includes(query);
      const matchStatus = status === 'all' || order.payment_status === status;
      const matchDate = isInsideDateFilter(order, dateFilter);
      return matchText && matchStatus && matchDate;
    });

    renderTables(filteredOrders);
  }

  function proofHtml(order) {
    return order.proof_image_url
      ? `<a href="${NB.safeHref(order.proof_image_url)}" target="_blank" rel="noopener"><img src="${NB.safeImageUrl(order.proof_image_url)}" class="proof-img" alt="Bukti bayar"></a>`
      : '<span class="text-muted">-</span>';
  }

  function buyerWaUrl(order) {
    const phone = String(order.buyer_phone || '').replace(/[^0-9+]/g, '');
    const text = `Halo kak ${order.buyer_name || ''}, pesanan ${order.product_name || 'produk'} kamu statusnya ${order.payment_status || 'pending'}.`;
    return phone ? NB.whatsappUrl(phone, text) : '#';
  }

  function rowHtml(order) {
    return `
      <tr>
        <td>
          <div class="fw-bold">${NB.escapeHtml(order.product_name || '-')}</div>
          <small class="text-muted">${formatDate(order.created_at)}</small>
        </td>
        <td>
          <div>${NB.escapeHtml(order.buyer_name || '-')}</div>
          <small>${NB.escapeHtml(order.buyer_phone || '-')}</small>
        </td>
        <td>${NB.money(order.total_price)}<br><small class="text-muted">Qty ${NB.escapeHtml(order.quantity || 1)}</small></td>
        <td>${proofHtml(order)}</td>
        <td>${badge(order.payment_status)}</td>
        <td class="text-end">
          <div class="btn-group btn-group-sm">
            <a class="btn btn-outline-success ${order.buyer_phone ? '' : 'disabled'}" href="${NB.safeHref(buyerWaUrl(order))}" target="_blank" rel="noopener" title="WhatsApp pembeli"><i class="bi bi-whatsapp"></i></a>
            <button class="btn btn-success" data-paid="${NB.escapeHtml(order.id)}" ${order.payment_status === 'paid' ? 'disabled' : ''}>Selesai</button>
            <button class="btn btn-outline-danger" data-cancel="${NB.escapeHtml(order.id)}" ${order.payment_status === 'cancelled' ? 'disabled' : ''}>Batal</button>
          </div>
        </td>
      </tr>
    `;
  }

  function cardHtml(order) {
    return `
      <article class="order-card-mobile">
        <div class="order-card-head">
          <div>
            <strong>${NB.escapeHtml(order.product_name || '-')}</strong>
            <small>${formatDate(order.created_at)}</small>
          </div>
          ${badge(order.payment_status)}
        </div>
        <div class="order-card-body">
          <div><span>Pembeli</span><b>${NB.escapeHtml(order.buyer_name || '-')}</b></div>
          <div><span>WhatsApp</span><b>${NB.escapeHtml(order.buyer_phone || '-')}</b></div>
          <div><span>Qty</span><b>${NB.escapeHtml(order.quantity || 1)}</b></div>
          <div><span>Total</span><b>${NB.money(order.total_price)}</b></div>
        </div>
        <div class="order-card-proof">${proofHtml(order)}</div>
        <div class="order-card-actions">
          <a class="btn btn-outline-success ${order.buyer_phone ? '' : 'disabled'}" href="${NB.safeHref(buyerWaUrl(order))}" target="_blank" rel="noopener"><i class="bi bi-whatsapp me-1"></i>WA</a>
          <button class="btn btn-success" data-paid="${NB.escapeHtml(order.id)}" ${order.payment_status === 'paid' ? 'disabled' : ''}>Selesai</button>
          <button class="btn btn-outline-danger" data-cancel="${NB.escapeHtml(order.id)}" ${order.payment_status === 'cancelled' ? 'disabled' : ''}>Batal</button>
        </div>
      </article>
    `;
  }

  function attachActions(orders) {
    document.querySelectorAll('[data-paid]').forEach(button => {
      button.addEventListener('click', async () => updateStatus(orders.find(item => String(item.id) === String(button.dataset.paid)), 'paid'));
    });

    document.querySelectorAll('[data-cancel]').forEach(button => {
      button.addEventListener('click', async () => updateStatus(orders.find(item => String(item.id) === String(button.dataset.cancel)), 'cancelled'));
    });
  }

  function renderSummary(orders) {
    const { paid, pending, cancelled, totalOmset, pendingNominal, averageOrder, productRecap } = computeSummary(orders);

    setText('orderOmset', NB.money(totalOmset));
    setText('orderPending', pending.length);
    setText(['orderPaid', 'orderSelesai'], paid.length);
    setText('orderTotal', orders.length);
    setText(['orderCancelled', 'orderBatal'], `${cancelled.length} batal`);
    setText('orderPendingNominal', NB.money(pendingNominal));
    setText('orderAverage', NB.money(averageOrder));
    setText('orderBestProduct', productRecap[0]?.product || '-');

    if ($('recapRows')) {
      $('recapRows').innerHTML = productRecap.map(item => `
        <tr>
          <td class="fw-semibold">${NB.escapeHtml(item.product)}</td>
          <td>${item.orders}</td>
          <td>${item.qty}</td>
          <td class="fw-bold text-green">${NB.money(item.revenue)}</td>
        </tr>
      `).join('') || '<tr><td colspan="4" class="text-center text-muted py-4">Belum ada pesanan selesai. Pesanan yang sudah ditandai selesai akan masuk rekap di sini.</td></tr>';
    }
  }

  function renderTables(orders) {
    renderSummary(orders);
    setText('filteredCount', `${orders.length} order`);

    const empty = `<tr><td colspan="6"><div class="table-empty-action"><i class="bi bi-receipt"></i><b>Belum ada pesanan</b><span>Pesanan dari halaman toko akan muncul di sini setelah pembeli checkout.</span></div></td></tr>`;
    setHtml('orderRows', orders.map(rowHtml).join('') || empty);
    setHtml('orderCards', orders.map(cardHtml).join('') || '<div class="empty-state empty-action py-4"><i class="bi bi-receipt"></i><b>Belum ada pesanan</b><span>Pesanan dari halaman toko akan muncul di sini.</span></div>');
    attachActions(orders);
  }

  async function updateStatus(order, status) {
    if (!order) return;
    const label = status === 'paid' ? 'tandai pesanan selesai' : 'batalkan pesanan';
    if (!confirm(`Yakin mau ${label}?`)) return;

    try {
      await NB.save('orders', { ...order, payment_status: status, paid_at: status === 'paid' ? NB.now() : null });
      nbToast(status === 'paid' ? 'Pesanan ditandai selesai.' : 'Pesanan dibatalkan.');
      await loadOrders();
    } catch (error) {
      nbToast(error.message || 'Gagal update order.', 'danger');
    }
  }


  async function resetRecapData() {
    if (!allOrders.length) {
      nbToast('Belum ada pesanan untuk direset.', 'warning');
      return;
    }

    const ok = confirm('Reset rekap akan menghapus semua pesanan toko kamu. Lanjutkan?');
    if (!ok) return;

    try {
      await NB.resetSalesRecap(user.id);
      nbToast('Rekap penjualan berhasil direset.');
      await loadOrders();
    } catch (error) {
      nbToast(error.message || 'Gagal reset rekap. Jalankan patch SQL 05 jika fitur ini belum aktif.', 'danger');
    }
  }

  function exportCsv() {
    const header = ['Tanggal', 'Produk', 'Pembeli', 'WhatsApp', 'Qty', 'Total', 'Metode', 'Status'];
    const lines = filteredOrders.map(order => [
      formatDate(order.created_at),
      order.product_name || '',
      order.buyer_name || '',
      order.buyer_phone || '',
      order.quantity || 1,
      order.total_price || 0,
      order.payment_method || '',
      order.payment_status || ''
    ]);

    const csv = [header, ...lines]
      .map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rekap-niagabio-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function loadOrders() {
    allOrders = await NB.list('orders', user.id, 'seller_id');
    filteredOrders = [...allOrders];
    applyFilters();
  }

  ['orderSearch', 'statusFilter', 'dateFilter'].forEach(id => {
    const el = $(id);
    if (el) el.addEventListener('input', applyFilters);
    if (el) el.addEventListener('change', applyFilters);
  });

  $('resetFilterBtn')?.addEventListener('click', () => {
    if ($('orderSearch')) $('orderSearch').value = '';
    if ($('statusFilter')) $('statusFilter').value = 'all';
    if ($('dateFilter')) $('dateFilter').value = 'all';
    applyFilters();
  });

  $('exportCsvBtn')?.addEventListener('click', exportCsv);
  $('resetRecapBtn')?.addEventListener('click', resetRecapData);
  $('printBtn')?.addEventListener('click', () => window.print());

  try {
    await loadOrders();
  } catch (error) {
    nbToast(error.message || 'Gagal memuat pesanan.', 'danger');
    setHtml('orderRows', '<tr><td colspan="6" class="text-center text-danger">Gagal memuat pesanan.</td></tr>');
  }
});
