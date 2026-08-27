const { authenticateUser, sb, json, normalizeAccount, maskAccount } = require('./_auth');

module.exports = async function handler(req, res) {
  if (!['GET', 'POST'].includes(req.method)) return res.status(405).json({ error: 'Method not allowed' });
  try {
    const user = await authenticateUser(req);
    if (req.method === 'GET') {
      const response = await sb(`/rest/v1/seller_payout_accounts?seller_id=eq.${encodeURIComponent(user.id)}&select=id,method,bank_name,bank_account,bank_holder,is_default,updated_at&order=is_default.desc,updated_at.desc`);
      const rows = await json(response);
      if (!response.ok) throw new Error(rows?.message || rows?.error || 'Gagal membaca rekening payout.');
      return res.status(200).json({ ok: true, accounts: (Array.isArray(rows) ? rows : []).map(row => ({ ...row, bank_account_masked: maskAccount(row.bank_account), bank_account: undefined })) });
    }

    const account = normalizeAccount(req.body || {});
    const id = String(req.body?.id || '').trim();
    if (req.body?.is_default === true) {
      await sb(`/rest/v1/seller_payout_accounts?seller_id=eq.${encodeURIComponent(user.id)}&is_default=eq.true`, { method: 'PATCH', body: JSON.stringify({ is_default: false, updated_at: new Date().toISOString() }) });
    }
    const payload = {
      seller_id: user.id,
      method: account.method,
      bank_name: account.bankName,
      bank_account: account.bankAccount,
      bank_holder: account.bankHolder,
      is_default: req.body?.is_default !== false,
      updated_at: new Date().toISOString()
    };
    const response = await sb(id
      ? `/rest/v1/seller_payout_accounts?id=eq.${encodeURIComponent(id)}&seller_id=eq.${encodeURIComponent(user.id)}`
      : '/rest/v1/seller_payout_accounts', {
        method: id ? 'PATCH' : 'POST',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify(id ? { ...payload, seller_id: undefined } : payload)
      });
    const rows = await json(response);
    if (!response.ok) throw new Error(rows?.message || rows?.error || 'Gagal menyimpan rekening payout.');
    const row = Array.isArray(rows) ? rows[0] : rows;
    return res.status(200).json({ ok: true, account: { id: row.id, method: row.method, bank_name: row.bank_name, bank_holder: row.bank_holder, bank_account_masked: maskAccount(account.bankAccount), is_default: row.is_default } });
  } catch (error) {
    console.error('[NiagaBio] withdrawal account failed:', error);
    return res.status(Number(error.statusCode) || 500).json({ error: error.message || 'Gagal mengelola rekening payout.' });
  }
};
