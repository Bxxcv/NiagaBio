const { authenticateUser, sb, json, isUuid } = require('./_auth');
const { env, requireEnv, numeric } = require('../../lib/buatqris');

function callProvider(fields) {
  const apiUrl = env('BQ_API_URL', 'https://api.buatqris.site').replace(/\/$/, '');
  const accountId = requireEnv('BQ_ACCOUNT_ID');
  const secretToken = requireEnv('BQ_SECRET_TOKEN');
  return fetch(apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'NiagaBio/1.0' },
    body: new URLSearchParams({ account_id: accountId, secret_token: secretToken, ...fields }).toString()
  }).then(async response => {
    const body = await response.json().catch(() => ({}));
    if (!response.ok || body?.success === false) throw Object.assign(new Error(body?.message || body?.error || `BuatQris HTTP ${response.status}`), { statusCode: response.status, providerBody: body });
    return body?.data || body;
  });
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const user = await authenticateUser(req);
    const body = req.body || {};
    const payoutAccountId = String(body.payout_account_id || '').trim();
    const amount = Math.floor(Number(body.amount || 0));
    if (!isUuid(payoutAccountId)) return res.status(400).json({ error: 'Payout account tidak valid.' });
    if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ error: 'Nominal withdrawal tidak valid.' });

    const accountResponse = await sb(`/rest/v1/seller_payout_accounts?id=eq.${encodeURIComponent(payoutAccountId)}&seller_id=eq.${encodeURIComponent(user.id)}&select=id,method,bank_name,bank_account,bank_holder&limit=1`);
    const accountRows = await json(accountResponse);
    if (!accountResponse.ok || !accountRows?.[0]) return res.status(404).json({ error: 'Rekening payout tidak ditemukan.' });
    const account = accountRows[0];

    const expectedFee = ['dana', 'ovo', 'shopeepay'].includes(String(account.method).toLowerCase()) ? 2500 : 0;
    const settingsResponse = await sb('/rest/v1/app_settings?id=eq.global&select=payment_sandbox,withdrawal_enabled,withdrawal_minimum&limit=1');
    const settingsRows = await json(settingsResponse);
    if (!settingsResponse.ok || !settingsRows?.[0]) return res.status(502).json({ error: 'Pengaturan withdrawal tidak tersedia.' });
    const settings = settingsRows[0];
    if (settings.withdrawal_enabled === false) return res.status(503).json({ error: 'Withdrawal sedang dinonaktifkan.' });

    const reserveResponse = await sb('/rest/v1/rpc/reserve_seller_withdrawal', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        target_seller_id: user.id,
        target_payout_account_id: payoutAccountId,
        requested_amount: amount,
        expected_fee: expectedFee,
        is_test_input: settings.payment_sandbox === true
      })
    });
    const reserved = await json(reserveResponse);
    if (!reserveResponse.ok || !reserved?.[0]) return res.status(Number(reserveResponse.status) || 400).json({ error: reserved?.message || reserved?.error || 'Withdrawal tidak dapat dicadangkan.' });
    const requestRow = reserved[0];

    try {
      const provider = await callProvider({
        action: 'api_withdraw',
        amount: String(amount),
        bank_name: account.bank_name,
        bank_account: account.bank_account,
        bank_holder: account.bank_holder
      });
      const withdrawalId = String(provider.withdrawal_id || provider.transaction_id || '').trim();
      if (!withdrawalId) throw new Error('BuatQris tidak mengembalikan withdrawal_id.');

      const patch = await sb(`/rest/v1/withdrawal_requests?id=eq.${encodeURIComponent(requestRow.id)}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify({
          provider_withdrawal_id: withdrawalId,
          provider_transaction_id: String(provider.transaction_id || withdrawalId),
          provider_status: String(provider.status || 'pending').toLowerCase(),
          provider_fee: numeric(provider.fee, expectedFee),
          net_amount: numeric(provider.net_amount, amount - numeric(provider.fee, expectedFee)),
          status: ['approved', 'success'].includes(String(provider.status || '').toLowerCase()) ? String(provider.status).toLowerCase() : 'pending',
          reserve_used: ['approved', 'success'].includes(String(provider.status || '').toLowerCase()) ? numeric(provider.fee, expectedFee) : 0,
          reserve_held: ['approved', 'success'].includes(String(provider.status || '').toLowerCase()) ? 0 : expectedFee,
          is_test: Boolean(provider.is_test ?? settings.payment_sandbox === true),
          processed_at: ['approved', 'success'].includes(String(provider.status || '').toLowerCase()) ? (provider.processed_at || new Date().toISOString()) : null,
          updated_at: new Date().toISOString()
        })
      });
      const rows = await json(patch);
      if (!patch.ok) throw new Error('Withdrawal dibuat di provider tetapi gagal dicatat di ledger lokal.');
      const result = rows?.[0] || requestRow;
      return res.status(200).json({
        ok: true,
        withdrawal: {
          id: result.id,
          provider_withdrawal_id: result.provider_withdrawal_id,
          status: result.status,
          amount: Number(result.amount),
          provider_fee: Number(result.provider_fee),
          net_amount: Number(result.net_amount),
          is_test: Boolean(result.is_test)
        }
      });
    } catch (providerError) {
      await sb(`/rest/v1/withdrawal_requests?id=eq.${encodeURIComponent(requestRow.id)}`, {
        method: 'PATCH', headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ status: 'failed', provider_status: 'failed', reserve_held: 0, failure_reason: String(providerError.message || 'Provider withdrawal gagal.').slice(0, 500), updated_at: new Date().toISOString(), processed_at: new Date().toISOString() })
      });
      throw providerError;
    }
  } catch (error) {
    console.error('[NiagaBio] withdrawal create failed:', error);
    return res.status(Number(error.statusCode) || 500).json({ error: error.message || 'Withdrawal gagal diproses.' });
  }
};
