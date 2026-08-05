const crypto = require('crypto');

let cachedAccessToken = null;
let cachedAccessTokenExpiresAt = 0;

function timingSafeEqualText(a, b) {
  if (!a || !b) return false;
  const aa = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (aa.length !== bb.length) return false;
  return crypto.timingSafeEqual(aa, bb);
}

function base64url(value) {
  return Buffer.from(value).toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

async function createGoogleAccessToken() {
  const now = Math.floor(Date.now() / 1000);
  if (cachedAccessToken && cachedAccessTokenExpiresAt > now + 60) return cachedAccessToken;

  const clientEmail = process.env.FCM_CLIENT_EMAIL;
  const privateKey = String(process.env.FCM_PRIVATE_KEY || '').replace(/\\n/g, '\n');
  if (!clientEmail || !privateKey) throw new Error('FCM service account credentials are not configured.');

  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = base64url(JSON.stringify({
    iss: clientEmail,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600
  }));
  const unsigned = `${header}.${payload}`;
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(unsigned);
  signer.end();
  const signature = signer.sign(privateKey);
  const assertion = `${unsigned}.${signature.toString('base64url')}`;

  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion
    }).toString()
  });

  const tokenData = await tokenResponse.json();
  if (!tokenResponse.ok || !tokenData.access_token) {
    throw new Error(`Google OAuth token failed: ${tokenData.error_description || tokenData.error || tokenResponse.status}`);
  }

  cachedAccessToken = tokenData.access_token;
  cachedAccessTokenExpiresAt = now + Number(tokenData.expires_in || 3600);
  return cachedAccessToken;
}

async function supabaseRequest(path, options = {}) {
  const baseUrl = String(process.env.SUPABASE_URL || '').replace(/\/$/, '');
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!baseUrl || !serviceKey) throw new Error('Supabase server credentials are not configured.');

  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });

  return response;
}

async function deactivateToken(id) {
  try {
    await supabaseRequest(`/rest/v1/push_subscriptions?id=eq.${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ is_active: false, updated_at: new Date().toISOString() })
    });
  } catch (_) {}
}

async function sendToFcm(token, data) {
  const projectId = process.env.FCM_PROJECT_ID;
  const accessToken = await createGoogleAccessToken();
  const response = await fetch(`https://fcm.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/messages:send`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      message: {
        token,
        data: {
          notification_id: String(data.notification_id || ''),
          type: String(data.type || 'info'),
          title: String(data.title || 'Notifikasi NiagaBio').slice(0, 120),
          body: String(data.body || '').slice(0, 500),
          link: String(data.link || '/notifications').slice(0, 180)
        }
      }
    })
  });

  const body = await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, body };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const webhookSecret = req.headers['x-push-webhook-secret'];
  if (!timingSafeEqualText(webhookSecret, process.env.PUSH_WEBHOOK_SECRET)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const payload = req.body || {};
    const record = payload.record || {};
    const userId = record.user_id;
    if (!userId) return res.status(400).json({ error: 'Missing record.user_id' });

    const allowedTypes = new Set([
      'order_new',
      'order_status_updated',
      'premium_approved',
      'premium_rejected',
      'premium_request_new'
    ]);
    if (!allowedTypes.has(String(record.type || 'info'))) {
      return res.status(200).json({ ok: true, skipped: true, reason: 'notification type not configured for push' });
    }

    const tokenResponse = await supabaseRequest(
      `/rest/v1/push_subscriptions?user_id=eq.${encodeURIComponent(userId)}&is_active=eq.true&select=id,device_token,device_name`
    );
    const subscriptions = await tokenResponse.json();
    if (!tokenResponse.ok) throw new Error(`Supabase token query failed: ${tokenResponse.status}`);

    const data = {
      notification_id: record.id,
      type: record.type,
      title: record.title,
      body: record.message,
      link: record.link_url || 'notifications'
    };

    const results = [];
    for (const subscription of subscriptions || []) {
      const result = await sendToFcm(subscription.device_token, data);
      results.push({ id: subscription.id, ok: result.ok, status: result.status });

      const details = result.body?.error?.details || [];
      const unregistered = details.some(item => item?.errorCode === 'UNREGISTERED');
      if (unregistered) await deactivateToken(subscription.id);
    }

    return res.status(200).json({ ok: true, user_id: userId, sent: results });
  } catch (error) {
    console.error('[NiagaBio Push] Error:', error);
    return res.status(500).json({ error: error.message || 'Push send failed' });
  }
};
