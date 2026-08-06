const crypto = require('crypto');

let cachedAccessToken = null;
let cachedAccessTokenExpiresAt = 0;

const RATE_WINDOW_MS = 5 * 60 * 1000;
const RATE_MAX_REQUESTS = 60;
const rateStore = globalThis.__NIAGABIO_PUSH_RATE__ || new Map();
globalThis.__NIAGABIO_PUSH_RATE__ = rateStore;

const ALLOWED_TYPES = new Set([
  'order_new',
  'order_status_updated',
  'premium_approved',
  'premium_rejected',
  'premium_request_new'
]);

function clientIp(req) {
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return forwarded || String(req.headers['x-real-ip'] || req.socket?.remoteAddress || 'unknown');
}

function rateLimit(req) {
  const now = Date.now();
  const key = clientIp(req);
  const current = rateStore.get(key) || { count: 0, resetAt: now + RATE_WINDOW_MS };

  if (current.resetAt <= now) {
    current.count = 0;
    current.resetAt = now + RATE_WINDOW_MS;
  }

  current.count += 1;
  rateStore.set(key, current);

  if (rateStore.size > 500) {
    for (const [storedKey, storedValue] of rateStore.entries()) {
      if (!storedValue || storedValue.resetAt <= now) rateStore.delete(storedKey);
    }
  }

  return {
    allowed: current.count <= RATE_MAX_REQUESTS,
    retryAfter: Math.max(1, Math.ceil((current.resetAt - now) / 1000))
  };
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || '').trim());
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

  const projectId = process.env.FCM_PROJECT_ID;
  const clientEmail = process.env.FCM_CLIENT_EMAIL;
  const privateKey = String(process.env.FCM_PRIVATE_KEY || '').replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error('FCM service account credentials are not configured.');
  }

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

  const tokenData = await tokenResponse.json().catch(() => ({}));
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

async function getNotification(notificationId) {
  const response = await supabaseRequest(
    `/rest/v1/notifications?id=eq.${encodeURIComponent(notificationId)}&select=id,user_id,type,title,message,link_url,metadata,created_at&limit=1`
  );
  const rows = await response.json().catch(() => []);
  if (!response.ok) throw new Error(`Supabase notification query failed: ${response.status}`);
  return Array.isArray(rows) ? rows[0] || null : null;
}

async function claimDelivery(notificationId) {
  const insertResponse = await supabaseRequest('/rest/v1/push_delivery_log', {
    method: 'POST',
    headers: { Prefer: 'resolution=ignore-duplicates,return=representation' },
    body: JSON.stringify({ notification_id: notificationId, status: 'sending' })
  });

  if (!insertResponse.ok && insertResponse.status !== 409) {
    const text = await insertResponse.text().catch(() => '');
    throw new Error(`Push delivery log insert failed: ${insertResponse.status} ${text}`.trim());
  }

  const inserted = await insertResponse.json().catch(() => []);
  if (Array.isArray(inserted) && inserted.length > 0) {
    return { claimed: true, row: inserted[0] };
  }

  const existingResponse = await supabaseRequest(
    `/rest/v1/push_delivery_log?notification_id=eq.${encodeURIComponent(notificationId)}&select=id,notification_id,status,updated_at&limit=1`
  );
  const existingRows = await existingResponse.json().catch(() => []);
  if (!existingResponse.ok || !existingRows?.[0]) {
    throw new Error('Gagal membaca status push delivery.');
  }

  const existing = existingRows[0];
  const status = String(existing.status || '').toLowerCase();
  const updatedAt = new Date(existing.updated_at || 0).getTime();
  const stale = !updatedAt || (Date.now() - updatedAt > 2 * 60 * 1000);

  if (status === 'sent' || (status === 'sending' && !stale)) {
    return { claimed: false, row: existing, reason: status === 'sent' ? 'already_sent' : 'already_processing' };
  }

  const retryResponse = await supabaseRequest(
    `/rest/v1/push_delivery_log?notification_id=eq.${encodeURIComponent(notificationId)}`,
    {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ status: 'sending', last_error: null, updated_at: new Date().toISOString() })
    }
  );
  const retryRows = await retryResponse.json().catch(() => []);
  if (!retryResponse.ok) throw new Error(`Push delivery retry claim failed: ${retryResponse.status}`);
  return { claimed: true, row: retryRows?.[0] || existing };
}

async function updateDelivery(notificationId, patch) {
  try {
    await supabaseRequest(
      `/rest/v1/push_delivery_log?notification_id=eq.${encodeURIComponent(notificationId)}`,
      {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ ...patch, updated_at: new Date().toISOString() })
      }
    );
  } catch (_) {}
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

function isInvalidTokenError(body) {
  const details = body?.error?.details || [];
  return details.some(item => ['UNREGISTERED', 'SENDER_ID_MISMATCH'].includes(String(item?.errorCode || '').toUpperCase()));
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

  const rate = rateLimit(req);
  if (!rate.allowed) {
    res.setHeader('Retry-After', String(rate.retryAfter));
    return res.status(429).json({ error: 'Too many requests' });
  }

  try {
    const payload = req.body || {};
    const notificationId = String(payload.notification_id || payload.record?.id || '').trim();

    if (!isUuid(notificationId)) {
      return res.status(400).json({ error: 'Missing or invalid notification_id' });
    }

    const notification = await getNotification(notificationId);
    if (!notification) return res.status(404).json({ error: 'Notification not found' });

    const type = String(notification.type || 'info');
    if (!ALLOWED_TYPES.has(type)) {
      return res.status(200).json({ ok: true, skipped: true, reason: 'notification type not configured for push' });
    }

    const claim = await claimDelivery(notificationId);
    if (!claim.claimed) {
      return res.status(200).json({ ok: true, skipped: true, reason: claim.reason || 'already_processed' });
    }

    const tokenResponse = await supabaseRequest(
      `/rest/v1/push_subscriptions?user_id=eq.${encodeURIComponent(notification.user_id)}&is_active=eq.true&select=id,device_token,device_name`
    );
    const subscriptions = await tokenResponse.json().catch(() => []);
    if (!tokenResponse.ok) throw new Error(`Supabase token query failed: ${tokenResponse.status}`);

    if (!Array.isArray(subscriptions) || subscriptions.length === 0) {
      await updateDelivery(notificationId, { status: 'no_device', delivered_to: 0, last_error: null });
      return res.status(200).json({ ok: true, sent: 0, reason: 'no_active_device' });
    }

    const data = {
      notification_id: notification.id,
      type: notification.type,
      title: notification.title,
      body: notification.message,
      link: notification.link_url || '/notifications'
    };

    const results = [];
    let sentCount = 0;
    let lastError = null;

    for (const subscription of subscriptions) {
      try {
        const result = await sendToFcm(subscription.device_token, data);
        const ok = Boolean(result.ok);
        if (ok) sentCount += 1;
        if (!ok) lastError = result.body?.error?.message || `FCM HTTP ${result.status}`;
        results.push({ id: subscription.id, ok, status: result.status });

        if (!ok && isInvalidTokenError(result.body)) {
          await deactivateToken(subscription.id);
        }
      } catch (error) {
        lastError = error.message || 'FCM send failed';
        results.push({ id: subscription.id, ok: false, status: 500 });
      }
    }

    await updateDelivery(notificationId, {
      status: sentCount > 0 ? 'sent' : 'failed',
      delivered_to: sentCount,
      last_error: sentCount > 0 ? null : lastError
    });

    return res.status(200).json({
      ok: sentCount > 0,
      notification_id: notificationId,
      user_id: notification.user_id,
      sent: sentCount,
      devices: results.length,
      results
    });
  } catch (error) {
    console.error('[NiagaBio Push] Error:', error);
    return res.status(500).json({ error: error.message || 'Push send failed' });
  }
};
