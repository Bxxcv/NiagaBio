const SUPABASE_URL = process.env.SUPABASE_URL
  || process.env.NIAGABIO_SUPABASE_URL
  || process.env.NEXT_PUBLIC_SUPABASE_URL
  || 'https://mhybmqcfswljxvgtmuhf.supabase.co';

const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY
  || process.env.NIAGABIO_SUPABASE_ANON_KEY
  || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  || 'sb_publishable_OOa4ygxkWd2JO6jCGa-Cmg_UId6iVT5';

const BRAND = 'NiagaBio';
const DEFAULT_IMAGE = '/assets/img/og-niagabio.jpg';
const DEFAULT_ICON = '/assets/img/favicon-32x32.png?v=4';

function escapeHtml(value = '') {
  return String(value ?? '').replace(/[&<>'"]/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  }[char]));
}

function slugify(value = '') {
  return String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32);
}

function originFromRequest(req) {
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'niaga-bio.vercel.app';
  return `${proto}://${host}`;
}

function absoluteUrl(value, origin, fallback = DEFAULT_IMAGE) {
  const raw = String(value || '').trim();
  const safeFallback = fallback.startsWith('http') ? fallback : `${origin}${fallback.startsWith('/') ? fallback : `/${fallback}`}`;
  if (!raw) return safeFallback;

  try {
    if (raw.startsWith('//')) return `https:${raw}`;
    if (raw.startsWith('http://')) return raw.replace(/^http:\/\//i, 'https://');
    if (raw.startsWith('https://')) return raw;
    if (raw.startsWith('/')) return `${origin}${raw}`;
    return `${origin}/${raw.replace(/^\.\//, '')}`;
  } catch (error) {
    return safeFallback;
  }
}

function money(value) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0
  }).format(Number(value || 0));
}

function truncate(value, max = 220) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trim()}…`;
}

async function supabaseFetch(path, options = {}) {
  const response = await fetch(`${SUPABASE_URL}${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });

  if (!response.ok) {
    const message = await response.text().catch(() => '');
    throw new Error(message || `Supabase request failed: ${response.status}`);
  }

  return response.json();
}

async function getPublicProfile(username) {
  const cleanUsername = slugify(username);
  if (!cleanUsername) return null;

  try {
    const data = await supabaseFetch('/rest/v1/rpc/get_public_profile', {
      method: 'POST',
      body: JSON.stringify({ lookup_username: cleanUsername })
    });
    const row = Array.isArray(data) ? data[0] : data;
    if (row) return row;
  } catch (error) {
    // Fallback untuk database lama yang belum menjalankan SQL public profile RPC.
  }

  try {
    const query = new URLSearchParams({
      select: 'user_id,username,display_name,bio,avatar_url,whatsapp_number,theme_name,plan,status,plan_end_date',
      username: `eq.${cleanUsername}`,
      status: 'eq.active',
      limit: '1'
    });
    const rows = await supabaseFetch(`/rest/v1/profiles?${query.toString()}`);
    return Array.isArray(rows) ? rows[0] : null;
  } catch (error) {
    return null;
  }
}

async function getPublicProduct(userId, productId) {
  const cleanProductId = String(productId || '').trim();
  if (!userId || !cleanProductId) return null;

  try {
    const query = new URLSearchParams({
      select: 'id,name,price,description,image_url,category,is_active',
      user_id: `eq.${userId}`,
      id: `eq.${cleanProductId}`,
      is_active: 'eq.true',
      limit: '1'
    });
    const rows = await supabaseFetch(`/rest/v1/products?${query.toString()}`);
    return Array.isArray(rows) ? rows[0] : null;
  } catch (error) {
    return null;
  }
}

function renderShareHtml({ title, description, image, url, redirectUrl, origin }) {
  const safeTitle = escapeHtml(title);
  const safeDescription = escapeHtml(description);
  const safeImage = escapeHtml(image);
  const safeUrl = escapeHtml(url);
  const safeRedirectUrl = escapeHtml(redirectUrl || url);
  const safeIcon = escapeHtml(absoluteUrl(DEFAULT_ICON, origin, DEFAULT_ICON));

  return `<!doctype html>
<html lang="id">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${safeTitle}</title>
  <meta name="description" content="${safeDescription}">
  <link rel="icon" href="${safeIcon}" sizes="32x32" type="image/png">
  <link rel="shortcut icon" href="${safeIcon}" type="image/png">
  <meta property="og:site_name" content="${BRAND}">
  <meta property="og:type" content="website">
  <meta property="og:title" content="${safeTitle}">
  <meta property="og:description" content="${safeDescription}">
  <meta property="og:image" content="${safeImage}">
  <meta property="og:image:secure_url" content="${safeImage}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:url" content="${safeUrl}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${safeTitle}">
  <meta name="twitter:description" content="${safeDescription}">
  <meta name="twitter:image" content="${safeImage}">
  <meta http-equiv="refresh" content="1; url=${safeRedirectUrl}">
</head>
<body style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;margin:0;min-height:100vh;display:grid;place-items:center;background:#f6fbf7;color:#13251c">
  <main style="max-width:520px;padding:24px;text-align:center">
    <img src="${safeImage}" alt="" style="width:86px;height:86px;object-fit:cover;border-radius:24px;margin-bottom:14px">
    <h1 style="font-size:1.35rem;margin:0 0 8px">${safeTitle}</h1>
    <p style="line-height:1.6;color:#526055;margin:0 0 18px">${safeDescription}</p>
    <a href="${safeRedirectUrl}" style="display:inline-flex;padding:11px 16px;border-radius:999px;background:#0f9f68;color:#fff;text-decoration:none;font-weight:700">Buka toko</a>
  </main>
</body>
</html>`;
}

module.exports = async function handler(req, res) {
  const origin = originFromRequest(req);
  const username = slugify(req.query.username || req.query.u || '');
  const productId = String(req.query.product || req.query.p || '').trim();

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=86400');

  const fallbackUrl = `${origin}/u?username=${encodeURIComponent(username || 'demo-account')}`;

  if (!username) {
    res.status(200).send(renderShareHtml({
      title: `${BRAND} - Link Bio dan Katalog Produk`,
      description: 'Buat link bio toko, katalog produk, checkout QRIS manual, dan dashboard pesanan sederhana.',
      image: absoluteUrl(DEFAULT_IMAGE, origin),
      url: `${origin}/`,
      redirectUrl: `${origin}/`,
      origin
    }));
    return;
  }

  const profile = await getPublicProfile(username);

  if (!profile) {
    res.status(200).send(renderShareHtml({
      title: `Toko tidak ditemukan - ${BRAND}`,
      description: 'Link toko ini belum tersedia atau toko sedang tidak aktif.',
      image: absoluteUrl(DEFAULT_IMAGE, origin),
      url: fallbackUrl,
      redirectUrl: fallbackUrl,
      origin
    }));
    return;
  }

  const storeName = profile.display_name || profile.username || 'Toko';
  const storeUrl = `${origin}/u?username=${encodeURIComponent(profile.username || username)}`;
  const storeImage = absoluteUrl(profile.avatar_url || DEFAULT_IMAGE, origin);
  let title = `${storeName} - ${BRAND}`;
  let description = truncate(profile.bio || 'Lihat katalog produk, link penting, dan checkout toko ini di NiagaBio.');
  let image = storeImage;
  let redirectUrl = storeUrl;
  let canonicalUrl = `${origin}/s/${encodeURIComponent(profile.username || username)}`;

  if (productId) {
    const product = await getPublicProduct(profile.user_id, productId);
    if (product) {
      title = `${product.name} - ${storeName}`;
      description = truncate(product.description || `${product.name} tersedia di ${storeName}. Harga ${money(product.price)}.`);
      image = absoluteUrl(product.image_url || profile.avatar_url || DEFAULT_IMAGE, origin);
      redirectUrl = `${storeUrl}&product=${encodeURIComponent(product.id)}`;
      canonicalUrl = `${origin}/s/${encodeURIComponent(profile.username || username)}/${encodeURIComponent(product.id)}`;
    }
  }

  res.status(200).send(renderShareHtml({
    title,
    description,
    image,
    url: canonicalUrl,
    redirectUrl,
    origin
  }));
};
