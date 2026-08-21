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
  let sellerProfile = null;

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
    if (!order.proof_image_url) return '<span class="text-muted">-</span>';

    const ref = NB.escapeHtml(order.proof_image_url);
    return `
      <a href="#" target="_blank" rel="noopener" data-proof-ref="${ref}" class="proof-link is-proof-loading">
        <img src="assets/img/placeholder-product.svg" data-proof-ref="${ref}" class="proof-img is-proof-loading" alt="Bukti bayar">
      </a>
    `;
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
            <a class="nb-btn nb-btn-commerce nb-btn-sm ${order.buyer_phone ? '' : 'disabled'}" href="${NB.safeHref(buyerWaUrl(order))}" target="_blank" rel="noopener" title="WhatsApp pembeli"><i class="bi bi-whatsapp"></i></a>
            <button class="nb-btn nb-btn-commerce nb-btn-sm" data-paid="${NB.escapeHtml(order.id)}" ${order.payment_status === 'paid' ? 'disabled' : ''}>Selesai</button>
            <button class="nb-btn nb-btn-danger nb-btn-sm" data-cancel="${NB.escapeHtml(order.id)}" ${order.payment_status === 'cancelled' ? 'disabled' : ''}>Batal</button>
            <button class="nb-btn nb-btn-ghost nb-btn-sm" data-print-note="${NB.escapeHtml(order.id)}" title="Cetak nota"><i class="bi bi-printer"></i></button>
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
          <a class="nb-btn nb-btn-commerce nb-btn-sm ${order.buyer_phone ? '' : 'disabled'}" href="${NB.safeHref(buyerWaUrl(order))}" target="_blank" rel="noopener"><i class="bi bi-whatsapp me-1"></i>WA</a>
          <button class="nb-btn nb-btn-commerce nb-btn-sm" data-paid="${NB.escapeHtml(order.id)}" ${order.payment_status === 'paid' ? 'disabled' : ''}>Selesai</button>
          <button class="nb-btn nb-btn-danger nb-btn-sm" data-cancel="${NB.escapeHtml(order.id)}" ${order.payment_status === 'cancelled' ? 'disabled' : ''}>Batal</button>
          <button class="nb-btn nb-btn-ghost nb-btn-sm" data-print-note="${NB.escapeHtml(order.id)}"><i class="bi bi-printer me-1"></i>Nota</button>
        </div>
      </article>
    `;
  }

  function paymentMethodLabel(value) {
    const labels = {
      whatsapp: 'WhatsApp',
      qris_manual: 'QRIS Manual',
      qris_whatsapp: 'QRIS + WhatsApp'
    };
    return labels[value] || value || '-';
  }

  function orderStatusLabel(value) {
    const labels = { paid: 'Selesai', pending: 'Menunggu', cancelled: 'Dibatalkan' };
    return labels[value] || value || '-';
  }

  function printSummary() {
    try {
      const { paid, pending, cancelled, totalOmset, pendingNominal, averageOrder, productRecap } = computeSummary(filteredOrders);
      const sellerName = sellerProfile?.display_name || 'Toko NiagaBio';
      const safe = value => NB.escapeHtml(value ?? '-');
      const period = $('dateFilter')?.selectedOptions?.[0]?.textContent || 'Semua';
      const topProducts = productRecap.slice(0, 5);
      const popup = window.open('', '_blank', 'width=720,height=820');
      if (!popup) {
        nbToast('Popup diblokir browser. Izinkan popup untuk mencetak ringkasan.', 'warning');
        return;
      }

      popup.document.open();
      popup.document.write(`<!doctype html>
<html lang="id">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Ringkasan Penjualan</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#f3f5f4;color:#111827;font:14px/1.5 Inter,Arial,sans-serif}.report{width:min(100%,680px);margin:24px auto;background:#fff;padding:28px;border:1px solid #e5e7eb;border-radius:16px}.head{border-bottom:1px solid #e5e7eb;padding-bottom:16px}.head h1{margin:0;font-size:22px}.head p{margin:4px 0 0;color:#64748b}.kpis{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin:18px 0}.kpi{padding:14px;border:1px solid #e5e7eb;border-radius:12px}.kpi small{display:block;color:#64748b;margin-bottom:3px}.kpi b{font-size:18px}.title{font-weight:800;margin:20px 0 10px}.table{width:100%;border-collapse:collapse}.table th,.table td{padding:9px 6px;border-bottom:1px solid #e5e7eb;text-align:left}.table th:last-child,.table td:last-child{text-align:right}.foot{margin-top:20px;color:#64748b;font-size:11px;text-align:center}.actions{text-align:center;margin:0 auto 18px}button{border:0;border-radius:9px;padding:9px 14px;background:#111827;color:#fff;font-weight:700}@media print{body{background:#fff}.report{width:100%;margin:0;border:0;border-radius:0;padding:0}.actions{display:none}}
</style></head>
<body>
<div class="actions"><button onclick="window.print()">Cetak Ringkasan</button></div>
<main class="report">
  <header class="head"><h1>Ringkasan Penjualan</h1><p>${safe(sellerName)} · Periode ${safe(period)} · ${safe(new Date().toLocaleDateString('id-ID'))}</p></header>
  <section class="kpis">
    <div class="kpi"><small>Omset Selesai</small><b>${safe(NB.money(totalOmset))}</b></div>
    <div class="kpi"><small>Pesanan Selesai</small><b>${paid.length}</b></div>
    <div class="kpi"><small>Menunggu</small><b>${pending.length} · ${safe(NB.money(pendingNominal))}</b></div>
    <div class="kpi"><small>Dibatalkan</small><b>${cancelled.length}</b></div>
    <div class="kpi"><small>Rata-rata Order</small><b>${safe(NB.money(averageOrder))}</b></div>
    <div class="kpi"><small>Total Pesanan</small><b>${filteredOrders.length}</b></div>
  </section>
  <div class="title">Top 5 Produk Berdasarkan Omset</div>
  <table class="table"><thead><tr><th>Produk</th><th>Selesai</th><th>Qty</th><th>Omset</th></tr></thead><tbody>
    ${topProducts.map(item => `<tr><td>${safe(item.product)}</td><td>${item.orders}</td><td>${item.qty}</td><td>${safe(NB.money(item.revenue))}</td></tr>`).join('') || '<tr><td colspan="4">Belum ada pesanan selesai.</td></tr>'}
  </tbody></table>
  <footer class="foot">Ringkasan dibuat dari pesanan yang sedang aktif pada filter halaman. Detail transaksi tetap tersedia di daftar Pesanan Masuk.</footer>
</main></body></html>`);
      popup.document.close();
      popup.focus();
      setTimeout(() => popup.print(), 300);
    } catch (error) {
      nbToast(error.message || 'Gagal menyiapkan ringkasan.', 'danger');
    }
  }

  async function printNote(order) {
    if (!order) return;

    try {
      if (!sellerProfile) {
        try { sellerProfile = await NB.getProfile(user.id); } catch (_) { sellerProfile = null; }
      }

      const popup = window.open('', '_blank', 'width=480,height=760');
      if (!popup) {
        nbToast('Popup diblokir browser. Izinkan popup untuk mencetak nota.', 'warning');
        return;
      }

      const sellerName = sellerProfile?.display_name || 'Toko NiagaBio';
      const sellerUsername = sellerProfile?.username ? `@${sellerProfile.username}` : '';
      const safe = value => NB.escapeHtml(value ?? '-');
      const total = NB.money(order.total_price);
      const qty = Number(order.quantity || 1);
      const unitPrice = Number(order.total_price || 0) / Math.max(qty, 1);
      const status = orderStatusLabel(order.payment_status);

      popup.document.open();
      popup.document.write(`<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Nota ${safe(order.id)}</title>
<style>
  *{box-sizing:border-box}
  body{margin:0;background:#f3f5f4;color:#111827;font:14px/1.5 Inter,Arial,sans-serif}
  .receipt{width:min(100%,420px);margin:24px auto;background:#fff;padding:28px;border:1px solid #e5e7eb;border-radius:16px}
  .brand{text-align:center;padding-bottom:18px;border-bottom:1px dashed #cbd5e1}
  .brand h1{margin:0;font-size:22px;letter-spacing:-.02em}
  .brand p{margin:3px 0 0;color:#64748b;font-size:12px}
  .title{margin:20px 0 12px;font-weight:800;font-size:16px}
  .row{display:flex;justify-content:space-between;gap:18px;padding:7px 0}
  .row span:first-child{color:#64748b}
  .row span:last-child{text-align:right;font-weight:600;overflow-wrap:anywhere}
  .items{margin:10px 0 16px;padding:12px 0;border-top:1px solid #e5e7eb;border-bottom:1px solid #e5e7eb}
  .total{display:flex;justify-content:space-between;gap:18px;margin-top:14px;padding-top:14px;border-top:2px solid #111827;font-size:17px;font-weight:900}
  .status{display:inline-block;margin-top:12px;padding:5px 10px;border-radius:999px;background:#ecfdf3;color:#047857;font-weight:800;font-size:12px}
  .status.pending{background:#fffbeb;color:#a16207}.status.cancelled{background:#f1f5f9;color:#475569}
  .foot{margin-top:22px;padding-top:14px;border-top:1px dashed #cbd5e1;text-align:center;color:#64748b;font-size:11px}
  .actions{display:flex;justify-content:center;gap:8px;margin:0 auto 18px}
  button{border:0;border-radius:9px;padding:9px 14px;background:#111827;color:#fff;font-weight:700;cursor:pointer}
  @media print{body{background:#fff}.receipt{width:100%;margin:0;border:0;border-radius:0;padding:0}.actions{display:none}}
</style>
</head>
<body>
<div class="actions"><button onclick="window.print()">Cetak Nota</button><button onclick="window.close()">Tutup</button></div>
<main class="receipt">
  <header class="brand">
    <h1>${safe(sellerName)}</h1>
    <p>${safe(sellerUsername || 'NiagaBio')}</p>
  </header>
  <div class="title">Nota Pembelian</div>
  <div class="row"><span>No. Pesanan</span><span>${safe(String(order.id).slice(0, 8).toUpperCase())}</span></div>
  <div class="row"><span>Tanggal</span><span>${safe(formatDate(order.created_at))}</span></div>
  <div class="row"><span>Pembeli</span><span>${safe(order.buyer_name)}</span></div>
  <div class="row"><span>WhatsApp</span><span>${safe(order.buyer_phone)}</span></div>
  <div class="items">
    <div class="row"><span>${safe(order.product_name)}</span><span>${qty} × ${safe(NB.money(unitPrice))}</span></div>
    <div class="row"><span>Metode Pembayaran</span><span>${safe(paymentMethodLabel(order.payment_method))}</span></div>
  </div>
  <div class="total"><span>Total</span><span>${safe(total)}</span></div>
  <div class="status ${order.payment_status === 'pending' ? 'pending' : order.payment_status === 'cancelled' ? 'cancelled' : ''}">${safe(status)}</div>
  <footer class="foot">Terima kasih telah berbelanja di ${safe(sellerName)}.<br>Nota dibuat dari NiagaBio.</footer>
</main>
</body>
</html>`);
      popup.document.close();
      popup.focus();
      setTimeout(() => popup.print(), 300);
    } catch (error) {
      nbToast(error.message || 'Gagal menyiapkan nota.', 'danger');
    }
  }

  function attachActions(orders) {
    document.querySelectorAll('[data-paid]').forEach(button => {
      button.addEventListener('click', async () => updateStatus(orders.find(item => String(item.id) === String(button.dataset.paid)), 'paid'));
    });

    document.querySelectorAll('[data-cancel]').forEach(button => {
      button.addEventListener('click', async () => updateStatus(orders.find(item => String(item.id) === String(button.dataset.cancel)), 'cancelled'));
    });

    document.querySelectorAll('[data-print-note]').forEach(button => {
      button.addEventListener('click', async () => printNote(orders.find(item => String(item.id) === String(button.dataset.printNote))));
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
      $('recapRows').innerHTML = productRecap.slice(0, 5).map(item => `
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
    NB.hydrateProofLinks(document);
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
  $('printBtn')?.addEventListener('click', printSummary);

  try {
    await loadOrders();
  } catch (error) {
    nbToast(error.message || 'Gagal memuat pesanan.', 'danger');
    setHtml('orderRows', '<tr><td colspan="6" class="text-center text-danger">Gagal memuat pesanan.</td></tr>');
  }
});
