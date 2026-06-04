document.addEventListener('DOMContentLoaded', async()=>{
  setActiveSide('dashboard');
  const user = await NB.requireAuth(); if(!user) return;
  const profile = await NB.getProfile(user.id);
  document.querySelectorAll('[data-user-name]').forEach(el=>el.textContent = profile?.display_name || user.email);
  document.querySelectorAll('[data-plan]').forEach(el=>{ el.textContent = profile?.plan==='premium'?'Premium':'Free'; el.className='badge-soft'; });
  const products = await NB.list('products', user.id);
  const orders = await NB.list('orders', user.id, 'seller_id');
  const paid = orders.filter(o=>o.payment_status==='paid');
  const pending = orders.filter(o=>o.payment_status==='pending');
  const total = paid.reduce((s,o)=>s+Number(o.total_price||0),0);
  document.getElementById('metricProducts').textContent = products.length;
  document.getElementById('metricOrders').textContent = orders.length;
  document.getElementById('metricPending').textContent = pending.length;
  document.getElementById('metricRevenue').textContent = NB.money(total);
  const tbody=document.getElementById('recentOrders');
  tbody.innerHTML = orders.slice(0,5).map(o=>`<tr><td class="fw-bold">${NB.escapeHtml(o.product_name)}</td><td>${NB.escapeHtml(o.buyer_name)}</td><td>${NB.money(o.total_price)}</td><td><span class="badge ${o.payment_status==='paid'?'text-bg-success':o.payment_status==='cancelled'?'text-bg-secondary':'text-bg-warning'}">${NB.escapeHtml(o.payment_status)}</span></td></tr>`).join('') || `<tr><td colspan="4" class="text-center text-muted">Belum ada pesanan.</td></tr>`;
});