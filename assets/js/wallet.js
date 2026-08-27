(() => {
  'use strict';
  const state = { summary: null, accounts: [], withdrawals: [], minimum: 10000, modal: null };
  const $ = (id) => document.getElementById(id);
  const money = (v) => NB.money(Number(v || 0));
  const esc = (v) => NB.escapeHtml(String(v ?? ''));
  const feeFor = (method) => ['dana','ovo','shopeepay'].includes(String(method || '').toLowerCase()) ? 2500 : 0;
  const fmtDate = (value) => value ? new Intl.DateTimeFormat('id-ID',{dateStyle:'medium',timeStyle:'short'}).format(new Date(value)) : '-';
  const token = async () => {
    if (!NB.sb?.auth) throw new Error('Sesi Supabase tidak tersedia.');
    const { data, error } = await NB.sb.auth.getSession();
    if (error || !data?.session?.access_token) throw new Error('Sesi login tidak ditemukan. Silakan login ulang.');
    return data.session.access_token;
  };
  async function api(path, options = {}) {
    const accessToken = await token();
    const response = await fetch(path, { ...options, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}`, ...(options.headers || {}) } });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body?.error || 'Permintaan gagal.');
    return body;
  }
  function renderSummary() {
    const s = state.summary || {};
    $('walletAvailable').textContent = money(s.available_balance);
    $('walletPending').textContent = `${money(s.pending_withdrawal)} sedang dalam proses penarikan`;
    $('walletEarned').textContent = money(s.total_earned);
    $('walletWithdrawn').textContent = money(s.total_withdrawn);
    $('walletReserve').textContent = money(s.reserve_accrued);
    $('walletReserveAvailable').textContent = money(s.reserve_available);
    $('modalAvailable').textContent = money(s.available_balance);
  }
  function renderAccounts() {
    const list = $('payoutAccountsList');
    if (!state.accounts.length) { list.innerHTML = '<div class="text-muted small">Belum ada rekening/e-wallet payout.</div>'; return; }
    list.innerHTML = state.accounts.map(a => `
      <div class="wallet-account-card">
        <div><div class="title">${esc(a.bank_name)} · ${esc(a.bank_account_masked || '')}</div><div class="meta">${esc(a.bank_holder || '-')} ${a.is_default ? '· Utama' : ''}</div></div>
        ${a.is_default ? '<span class="wallet-status success">Utama</span>' : ''}
      </div>
    `).join('');
  }
  function statusLabel(status) { const s=String(status||'').toLowerCase(); return s==='pending'?'Menunggu':(s==='approved'||s==='success'?'Berhasil':(s==='rejected'?'Ditolak':(s==='failed'?'Gagal':'Dibatalkan'))); }
  function renderWithdrawals() {
    const list = $('withdrawalRows');
    if (!state.withdrawals.length) { list.innerHTML = '<div class="text-muted py-4 text-center">Belum ada riwayat penarikan.</div>'; return; }
    list.innerHTML = state.withdrawals.map(w => `
      <div class="wallet-withdraw-row">
        <div><div class="title">${esc(w.bank_name)} · ${esc(w.bank_account_masked || '')}</div><div class="meta">${fmtDate(w.requested_at)} · Net ${money(w.net_amount)}</div></div>
        <div class="text-end"><div class="fw-bold">${money(w.amount)}</div><span class="wallet-status ${esc(String(w.status||''))}">${statusLabel(w.status)}</span></div>
      </div>
    `).join('');
  }
  function syncModalAccount() {
    const account = state.accounts.find(a => a.is_default) || state.accounts[0];
    const note = $('withdrawDestinationNote');
    $('withdrawAmount').setAttribute('min', String(state.minimum));
    note.textContent = account ? `Payout: ${account.bank_name} · ${account.bank_account_masked} · ${account.bank_holder}` : 'Simpan rekening/e-wallet payout utama terlebih dahulu.';
    const fee = account ? feeFor(account.method) : 0;
    $('withdrawFeeNote').textContent = fee > 0 ? `Estimasi fee provider ${money(fee)}. Reserve seller dipakai untuk menutup fee ini.` : 'Metode ini tercatat tanpa fee withdrawal provider pada konfigurasi saat ini.';
    $('confirmWithdrawBtn').disabled = !account;
  }
  async function load() {
    const data = await api('/api/withdraw/status');
    state.summary = data.summary || {};
    state.accounts = Array.isArray(data.accounts) ? data.accounts : [];
    state.withdrawals = Array.isArray(data.withdrawals) ? data.withdrawals : [];
    state.minimum = Math.max(Number(data.minimum || 10000), 10000);
    renderSummary(); renderAccounts(); renderWithdrawals(); syncModalAccount();
  }
  async function saveAccount(event) {
    event.preventDefault();
    const body = { method: $('payoutMethod').value, bank_name: $('bankName').value, bank_account: $('bankAccount').value, bank_holder: $('bankHolder').value, is_default: $('payoutDefault').checked };
    const button = event.submitter; if (button) button.disabled = true;
    try { await api('/api/withdraw/account', { method: 'POST', body: JSON.stringify(body) }); nbToast('Rekening/e-wallet payout berhasil disimpan.'); event.target.reset(); $('payoutDefault').checked = true; await load(); }
    catch (error) { nbToast(error.message, 'danger'); }
    finally { if (button) button.disabled = false; }
  }
  async function requestWithdraw(event) {
    event.preventDefault();
    const account = state.accounts.find(a => a.is_default) || state.accounts[0];
    if (!account) return nbToast('Simpan rekening/e-wallet payout terlebih dahulu.', 'danger');
    const amountText = $('withdrawAmount').value || '';
    const amount = Number(amountText.replace(/\D/g, ''));
    if (amount < state.minimum) return nbToast(`Minimum withdrawal ${money(state.minimum)}.`, 'danger');
    if (amount > Number(state.summary?.available_balance || 0)) return nbToast('Saldo tersedia tidak mencukupi.', 'danger');
    const button = $('confirmWithdrawBtn'); button.disabled = true; button.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Memproses';
    try {
      const data = await api('/api/withdraw/create', { method:'POST', body: JSON.stringify({ payout_account_id: account.id, amount }) });
      nbToast(`Withdrawal ${money(data.withdrawal?.amount || amount)} berhasil diajukan.`);
      state.modal.hide(); $('withdrawAmount').value=''; await load();
    } catch (error) { nbToast(error.message, 'danger'); }
    finally { button.disabled = false; button.innerHTML = '<i class="bi bi-send"></i> Tarik sekarang'; }
  }
  function bind() {
    state.modal = new bootstrap.Modal($('withdrawModal'));
    $('walletRefresh').addEventListener('click', () => load().catch(e => nbToast(e.message,'danger')));
    $('payoutForm').addEventListener('submit', saveAccount);
    $('withdrawForm').addEventListener('submit', requestWithdraw);
    $('payoutMethod').addEventListener('change', () => { const bankWrap=$('bankNameWrap'); bankWrap.hidden = $('payoutMethod').value !== 'bank'; if (bankWrap.hidden) $('bankName').value=''; });
    $('openWithdrawBtn').addEventListener('click', () => { renderSummary(); syncModalAccount(); state.modal.show(); });
    document.querySelectorAll('[data-rupiah-input]').forEach(input => input.addEventListener('input', e => { const digits=e.target.value.replace(/\D/g,''); e.target.value=digits?NB.money(Number(digits)).replace(/^Rp\s?/, 'Rp '):''; }));
  }
  document.addEventListener('DOMContentLoaded', async () => { try { await NB.requireAuth(); bind(); await load(); } catch (error) { nbToast(error.message, 'danger'); } });
})();
