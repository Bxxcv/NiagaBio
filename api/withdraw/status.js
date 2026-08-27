const { authenticateUser, sb, json, maskAccount } = require('./_auth');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const user = await authenticateUser(req);
    const summaryResponse = await sb('/rest/v1/rpc/get_seller_wallet_summary', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ target_seller_id: user.id }) });
    const summaryRows = await json(summaryResponse);
    if (!summaryResponse.ok || !summaryRows?.[0]) return res.status(502).json({ error: 'Gagal membaca saldo seller.' });
    const rowsResponse = await sb(`/rest/v1/withdrawal_requests?seller_id=eq.${encodeURIComponent(user.id)}&select=id,amount,expected_provider_fee,provider_fee,reserve_held,reserve_used,net_amount,status,provider_status,provider_withdrawal_id,bank_name,bank_holder,bank_account,method,is_test,requested_at,processed_at,failure_reason&order=created_at.desc&limit=30`);
    const rows = await json(rowsResponse);
    if (!rowsResponse.ok) throw new Error(rows?.message || rows?.error || 'Gagal membaca riwayat withdrawal.');
    const settingsResponse = await sb('/rest/v1/app_settings?id=eq.global&select=withdrawal_minimum,withdrawal_enabled&limit=1');
    const settingsRows = await json(settingsResponse);
    if (!settingsResponse.ok || !settingsRows?.[0]) throw new Error('Pengaturan withdrawal tidak tersedia.');
    const settings = settingsRows[0];
    const accountResponse = await sb(`/rest/v1/seller_payout_accounts?seller_id=eq.${encodeURIComponent(user.id)}&select=id,method,bank_name,bank_holder,bank_account,is_default,updated_at&order=is_default.desc,updated_at.desc`);
    const accounts = await json(accountResponse);
    if (!accountResponse.ok) throw new Error(accounts?.message || accounts?.error || 'Gagal membaca payout account.');
    return res.status(200).json({
      ok: true,
      minimum: Math.max(Number(settings.withdrawal_minimum || 10000), 10000),
      withdrawal_enabled: settings.withdrawal_enabled !== false,
      summary: {
        total_earned: Number(summaryRows[0].total_earned || 0),
        pending_withdrawal: Number(summaryRows[0].pending_withdrawal || 0),
        total_withdrawn: Number(summaryRows[0].total_withdrawn || 0),
        available_balance: Number(summaryRows[0].available_balance || 0),
        reserve_accrued: Number(summaryRows[0].reserve_accrued || 0),
        reserve_held: Number(summaryRows[0].reserve_held || 0),
        reserve_used: Number(summaryRows[0].reserve_used || 0),
        reserve_available: Number(summaryRows[0].reserve_available || 0)
      },
      accounts: (Array.isArray(accounts) ? accounts : []).map(row => ({ ...row, bank_account_masked: maskAccount(row.bank_account), bank_account: undefined })),
      withdrawals: (Array.isArray(rows) ? rows : []).map(row => ({ ...row, bank_account_masked: maskAccount(row.bank_account), bank_account: undefined }))
    });
  } catch (error) {
    console.error('[NiagaBio] withdrawal status failed:', error);
    return res.status(Number(error.statusCode) || 500).json({ error: error.message || 'Gagal membaca wallet seller.' });
  }
};
