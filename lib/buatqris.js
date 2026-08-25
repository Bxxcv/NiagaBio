const crypto = require('crypto');

const DEFAULT_API_URL = 'https://api.buatqris.site';

function env(name, fallback = '') {
  const value = process.env[name];
  return value == null ? fallback : String(value).trim();
}

function requireEnv(name) {
  const value = env(name);
  if (!value) throw new Error(`${name} belum dikonfigurasi di Vercel Environment Variables.`);
  return value;
}

function providerApiUrl() {
  return env('BQ_API_URL', DEFAULT_API_URL).replace(/\/$/, '');
}

function numeric(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

async function buatQrisRequest(fields) {
  const accountId = requireEnv('BQ_ACCOUNT_ID');
  const secretToken = requireEnv('BQ_SECRET_TOKEN');
  const response = await fetch(providerApiUrl(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'NiagaBio/1.0'
    },
    body: new URLSearchParams({
      account_id: accountId,
      secret_token: secretToken,
      ...Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, String(value ?? '')]))
    }).toString()
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok || body?.success === false) {
    const message = body?.message || body?.error || `BuatQris HTTP ${response.status}`;
    const error = new Error(message);
    error.statusCode = response.status;
    error.providerBody = body;
    throw error;
  }

  return body?.data || body;
}

async function createQris({ amount, description, callbackUrl, sandbox }) {
  return buatQrisRequest({
    action: 'api_create_qris',
    amount: Math.round(numeric(amount)),
    description: String(description || 'Pembayaran NiagaBio').slice(0, 180),
    qris_method: env('BQ_QRIS_METHOD', 'qris_two'),
    callback_url: String(callbackUrl || '').trim(),
    test: sandbox ? 1 : 0
  });
}

async function checkStatus(transactionId) {
  return buatQrisRequest({
    action: 'api_check_status',
    transaction_id: String(transactionId || '').trim()
  });
}

function signHmac(rawBody, signingSecret) {
  return `sha256=${crypto.createHmac('sha256', signingSecret).update(rawBody).digest('hex')}`;
}

function safeTimingEqual(a, b) {
  const left = Buffer.from(String(a || ''));
  const right = Buffer.from(String(b || ''));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

module.exports = {
  env,
  requireEnv,
  createQris,
  checkStatus,
  signHmac,
  safeTimingEqual,
  numeric
};
