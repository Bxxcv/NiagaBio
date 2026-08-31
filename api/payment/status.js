const { checkStatus } = require('../../lib/buatqris');
const { supabaseRequest, readJson } = require('./_supabase');

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''));
}

async function applyEvent(payload) {
  const response = await supabaseRequest('/rest/v1/rpc/apply_buatqris_payment_event', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      p_transaction_id: String(payload.transaction_id || ''),
      p_status: String(payload.status || 'pending'),
      p_amount: Number(payload.amount || 0),
      p_total_amount: Number(payload.total_amount || 0),
      p_credit_amount: Number(payload.credit_amount || 0),
      p_admin_fee: Number(payload.admin_fee || 0),
      p_qris_method: String(payload.qris_method || ''),
      p_paid_at: payload.paid_at || null,
      p_expires_at: payload.expires_at || null,
      p_delivery_id: String(payload.delivery_id || ''),
      p_event_type: String(payload.event || 'api_check_status'),
      p_is_test: Boolean(payload.is_test)
    })
  });
  const data = await readJson(response);
  if (!response.ok) throw new Error(data?.message || data?.error || 'Gagal sinkron status pembayaran.');
  return Array.isArray(data) ? data[0] : data;
}

const RATE_WINDOW_MS = 60 * 1000;
const RATE_MAX = 30;
const rates = globalThis.__NIAGABIO_PAYMENT_STATUS_RATE__ || new Map();
globalThis.__NIAGABIO_PAYMENT_STATUS_RATE__ = rates;

function rateLimited(req) {
  const key = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || String(req.socket?.remoteAddress || 'unknown');
  const now = Date.now();
  const entry = rates.get(key) || { count: 0, resetAt: now + RATE_WINDOW_MS };
  if (entry.resetAt <= now) { entry.count = 0; entry.resetAt = now + RATE_WINDOW_MS; }
  entry.count += 1;
  rates.set(key, entry);
  return entry.count > RATE_MAX;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (rateLimited(req)) return res.status(429).json({ error: 'Terlalu banyak pengecekan status. Coba lagi sebentar.' });

  try {
    const orderId = String(req.body?.order_id || '').trim();
    if (!isUuid(orderId)) return res.status(400).json({ error: 'order_id tidak valid.' });

    const paymentResponse = await supabaseRequest(
      `/rest/v1/payment_transactions?order_id=eq.${encodeURIComponent(orderId)}&select=id,order_id,provider_transaction_id,status,requested_amount,provider_total_amount,gateway_fee,provider_credit_amount,qr_url,qris_image,payment_url,expires_at,paid_at,is_test&order=created_at.desc&limit=1`
    );
    const rows = await readJson(paymentResponse);
    if (!paymentResponse.ok || !rows?.[0]) return res.status(404).json({ error: 'Transaksi pembayaran belum dibuat.' });

    const tx = rows[0];
    const localStatus = String(tx.status || 'pending').toLowerCase();
    if (localStatus !== 'pending') {
      return res.status(200).json({ ok: true, status: localStatus, payment: tx });
    }

    const provider = await checkStatus(tx.provider_transaction_id);
    const status = String(provider.status || 'pending').toLowerCase();
    if (['success', 'expired', 'failed'].includes(status)) {
      const applied = await applyEvent({
        ...provider,
        transaction_id: tx.provider_transaction_id,
        event: status === 'success' ? 'payment.success' : status === 'expired' ? 'payment.expired' : 'payment.failed'
      });
      return res.status(200).json({ ok: true, status, payment: applied || tx });
    }

    return res.status(200).json({ ok: true, status: 'pending', payment: tx });
  } catch (error) {
    console.error('[NiagaBio] payment status failed:', error);
    return res.status(Number(error.statusCode) || 500).json({ error: error.message || 'Gagal mengecek pembayaran.' });
  }
};
