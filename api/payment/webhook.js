const { signHmac, safeTimingEqual } = require('../../lib/buatqris');
const { supabaseRequest, readJson } = require('./_supabase');
const crypto = require('crypto');

module.exports.config = { api: { bodyParser: false } };

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

async function applyEvent(payload, deliveryId, eventType) {
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
      p_delivery_id: String(deliveryId || ''),
      p_event_type: String(eventType || ''),
      p_is_test: Boolean(payload.is_test)
    })
  });
  const data = await readJson(response);
  if (!response.ok) throw new Error(data?.message || data?.error || 'Gagal menyimpan event pembayaran.');
  return Array.isArray(data) ? data[0] : data;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const rawBody = await readRawBody(req);
    const signature = String(req.headers['x-buatqris-signature'] || '').trim();
    const signingSecret = String(process.env.BQ_SIGNING_SECRET || '').trim();
    if (!signingSecret) return res.status(500).json({ error: 'BQ_SIGNING_SECRET belum dikonfigurasi.' });

    const expected = signHmac(rawBody, signingSecret);
    if (!signature || !safeTimingEqual(expected, signature)) {
      return res.status(401).json({ error: 'Invalid webhook signature.' });
    }

    let payload;
    try {
      payload = JSON.parse(rawBody);
    } catch (_) {
      return res.status(400).json({ error: 'Invalid JSON payload.' });
    }

    const event = String(req.headers['x-buatqris-event'] || payload.event || '').trim();
    const deliveryId = String(req.headers['x-buatqris-delivery'] || payload.transaction_id || '').trim();
    if (!['payment.success', 'payment.expired', 'payment.failed'].includes(event)) {
      return res.status(200).json({ ok: true, skipped: true, event });
    }
    if (!payload.transaction_id) return res.status(400).json({ error: 'transaction_id missing.' });

    const applied = await applyEvent(payload, deliveryId, event);
    return res.status(200).json({ ok: true, event, status: payload.status, payment: applied || null });
  } catch (error) {
    console.error('[NiagaBio] webhook failed:', error);
    return res.status(500).json({ error: error.message || 'Webhook gagal diproses.' });
  }
};
