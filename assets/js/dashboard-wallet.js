(() => {
  'use strict';
  const money = (v) => NB.money(Number(v || 0));
  async function run() {
    const el = document.getElementById('dashboardWalletAvailable');
    const meta = document.getElementById('dashboardWalletMeta');
    if (!el || !NB.sb?.auth) return;
    try {
      const { data } = await NB.sb.auth.getSession();
      const token = data?.session?.access_token;
      if (!token) return;
      const res = await fetch('/api/withdraw/status', { headers: { Authorization: `Bearer ${token}` } });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || 'Saldo tidak tersedia.');
      el.textContent = money(body.summary?.available_balance);
      meta.textContent = `${money(body.summary?.pending_withdrawal)} sedang diproses · Total ditarik ${money(body.summary?.total_withdrawn)}`;
    } catch (error) {
      if (meta) meta.textContent = error.message || 'Saldo belum tersedia.';
    }
  }
  document.addEventListener('DOMContentLoaded', run);
})();
