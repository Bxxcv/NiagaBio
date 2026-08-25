const { createQris } = require('../../lib/buatqris');
const { supabaseRequest, readJson } = require('./_supabase');

const RATE_WINDOW_MS = 60 * 1000;
const RATE_MAX = 12;
const rates = globalThis.__NIAGABIO_PAYMENT_CREATE_RATE__ || new Map();
globalThis.__NIAGABIO_PAYMENT_CREATE_RATE__ = rates;

function clientIp(req) {
  return String(req.headers['x-forwarded-for'] || '').split(',')[0].trim()
    || String(req.headers['x-real-ip'] || req.socket?.remoteAddress || 'unknown');
}

function limited(req) {
  const key = clientIp(req);
  const now = Date.now();
  const entry = rates.get(key) || { count: 0, resetAt: now + RATE_WINDOW_MS };
  if (entry.resetAt <= now) { entry.count = 0; entry.resetAt = now + RATE_WINDOW_MS; }
  entry.count += 1;
  rates.set(key, entry);
  if (rates.size > 500) {
    for (const [k, v] of rates) if (v.resetAt <= now) rates.delete(k);
  }
  return entry.count > RATE_MAX;
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''));
}

function callbackUrl(req) {
  const configured = String(process.env.BQ_CALLBACK_URL || '').trim();
  if (configured) return configured;
  const proto = String(req.headers['x-forwarded-proto'] || 'https').split(',')[0].trim();
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '').trim();
  if (!host) throw new Error('BQ_CALLBACK_URL wajib dikonfigurasi karena host request tidak tersedia.');
  return `${proto}://${host}/api/payment/webhook`;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (limited(req)) return res.status(429).json({ error: 'Terlalu banyak percobaan pembayaran. Coba lagi sebentar.' });

  try {
    const body = req.body || {};
    const orderId = String(body.order_id || '').trim();
    if (!isUuid(orderId)) return res.status(400).json({ error: 'order_id tidak valid.' });

    const orderResponse = await supabaseRequest(
      `/rest/v1/orders?id=eq.${encodeURIComponent(orderId)}&select=id,seller_id,product_name,total_price,platform_fee,withdrawal_reserve,buyer_total,payment_status,payment_method,payment_provider,provider_transaction_id,created_at&limit=1`
    );
    const orderRows = await readJson(orderResponse);
    if (!orderResponse.ok || !Array.isArray(orderRows)) {
      return res.status(502).json({ error: 'Gagal membaca order dari database.' });
    }
    const order = orderRows[0];
    if (!order) return res.status(404).json({ error: 'Order tidak ditemukan.' });
    if (String(order.payment_status) !== 'pending') {
      return res.status(409).json({ error: 'Order ini tidak lagi menunggu pembayaran.', status: order.payment_status });
    }
    if (String(order.payment_provider || '').toLowerCase() && String(order.provider_transaction_id || '').trim()) {
      return res.status(200).json({
        ok: true,
        existing: true,
        transaction_id: order.provider_transaction_id,
        amount: Number(order.buyer_total || 0)
      });
    }

    const settingsResponse = await supabaseRequest(
      '/rest/v1/app_settings?id=eq.global&select=payment_gateway_enabled,payment_provider,payment_sandbox&limit=1'
    );
    const settingsRows = await readJson(settingsResponse);
    if (!settingsResponse.ok || !Array.isArray(settingsRows) || !settingsRows[0]) {
      return res.status(502).json({ error: 'Pengaturan payment gateway tidak dapat dibaca.' });
    }
    const settings = settingsRows[0];
    if (settings.payment_gateway_enabled !== true) return res.status(503).json({ error: 'Payment gateway sedang dinonaktifkan.' });
    if (String(settings.payment_provider || '').toLowerCase() !== 'buatqris') {
      return res.status(503).json({ error: 'Provider payment gateway belum dikonfigurasi ke BuatQris.' });
    }

    const amount = Math.round(Number(order.buyer_total || 0));
    if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ error: 'Total pembayaran order tidak valid.' });

    const provider = await createQris({
      amount,
      description: `NiagaBio #${order.id}`,
      callbackUrl: callbackUrl(req),
      sandbox: settings.payment_sandbox === true
    });

    const transactionId = String(provider.transaction_id || '').trim();
    if (!transactionId) throw new Error('BuatQris tidak mengembalikan transaction_id.');

    const insertResponse = await supabaseRequest('/rest/v1/payment_transactions', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        order_id: order.id,
        seller_id: order.seller_id,
        provider: 'buatqris',
        provider_transaction_id: transactionId,
        status: String(provider.status || 'pending').toLowerCase(),
        requested_amount: amount,
        provider_total_amount: Number(provider.total_amount || amount),
        gateway_fee: Number(provider.admin_fee || 0),
        provider_credit_amount: Number(provider.credit_amount || 0),
        qr_url: String(provider.qr_url || ''),
        payment_url: String(provider.payment_url || ''),
        qris_method: String(provider.qris_method || ''),
        is_test: Boolean(provider.is_test ?? settings.payment_sandbox === true),
        expires_at: provider.expires_at || null
      })
    });
    const insertedRows = await readJson(insertResponse);
    if (!insertResponse.ok) {
      return res.status(502).json({ error: 'Transaksi provider dibuat, tetapi gagal dicatat di ledger lokal.', provider_transaction_id: transactionId });
    }

    const patchResponse = await supabaseRequest(`/rest/v1/orders?id=eq.${encodeURIComponent(order.id)}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        payment_method: 'qris_buatqris',
        payment_provider: 'buatqris',
        provider_transaction_id: transactionId,
        provider_status: String(provider.status || 'pending'),
        gateway_fee: Number(provider.admin_fee || 0),
        payment_expires_at: provider.expires_at || null,
        buyer_total: Number(provider.total_amount || amount)
      })
    });
    if (!patchResponse.ok) throw new Error('Gagal mengikat transaksi payment ke order.');

    return res.status(200).json({
      ok: true,
      transaction_id: transactionId,
      status: String(provider.status || 'pending'),
      amount,
      total_amount: Number(provider.total_amount || amount),
      gateway_fee: Number(provider.admin_fee || 0),
      qr_url: String(provider.qr_url || ''),
      qris_image: String(provider.qris_image || ''),
      payment_url: String(provider.payment_url || ''),
      expires_at: provider.expires_at || null,
      is_test: Boolean(provider.is_test ?? settings.payment_sandbox === true),
      ledger_id: insertedRows?.[0]?.id || null
    });
  } catch (error) {
    console.error('[NiagaBio] create payment failed:', error);
    return res.status(Number(error.statusCode) || 500).json({ error: error.message || 'Gagal membuat pembayaran.' });
  }
};
