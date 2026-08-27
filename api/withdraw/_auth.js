const crypto = require('crypto');

function cfg() {
  const baseUrl = String(process.env.SUPABASE_URL || '').replace(/\/$/, '');
  const serviceKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '');
  if (!baseUrl || !serviceKey) throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY belum dikonfigurasi.');
  return { baseUrl, serviceKey };
}

async function authenticateUser(req) {
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) throw Object.assign(new Error('Login diperlukan.'), { statusCode: 401 });
  const { baseUrl, serviceKey } = cfg();
  const response = await fetch(`${baseUrl}/auth/v1/user`, {
    headers: { apikey: serviceKey, Authorization: `Bearer ${token}` }
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body?.id) throw Object.assign(new Error('Sesi login tidak valid.'), { statusCode: 401 });
  return body;
}

async function sb(path, options = {}) {
  const { baseUrl, serviceKey } = cfg();
  return fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
}

async function json(response) { return response.json().catch(() => ({})); }

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''));
}

function expectedFee(method) {
  return ['dana', 'ovo', 'shopeepay'].includes(String(method || '').toLowerCase()) ? 2500 : 0;
}

function normalizeAccount(body = {}) {
  const method = String(body.method || '').trim().toLowerCase();
  const allowed = new Set(['bank', 'gopay', 'dana', 'ovo', 'shopeepay']);
  if (!allowed.has(method)) throw new Error('Metode payout tidak didukung.');
  let bankName = String(body.bank_name || '').trim();
  const bankAccount = String(body.bank_account || '').replace(/\D/g, '');
  const bankHolder = String(body.bank_holder || '').trim().replace(/\s+/g, ' ');
  if (method !== 'bank') bankName = method === 'gopay' ? 'GoPay' : method === 'dana' ? 'DANA' : method === 'ovo' ? 'OVO' : 'ShopeePay';
  if (!bankName || !/^\d{6,30}$/.test(bankAccount) || bankHolder.length < 2 || bankHolder.length > 100) {
    throw new Error('Data rekening/e-wallet tidak valid.');
  }
  return { method, bankName, bankAccount, bankHolder };
}

function maskAccount(value) {
  const s = String(value || '');
  if (s.length <= 4) return '••••';
  return `${'•'.repeat(Math.max(2, s.length - 4))}${s.slice(-4)}`;
}

module.exports = { authenticateUser, sb, json, isUuid, expectedFee, normalizeAccount, maskAccount };
