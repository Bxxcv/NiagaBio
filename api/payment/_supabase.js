function supabaseConfig() {
  const baseUrl = String(process.env.SUPABASE_URL || '').replace(/\/$/, '');
  const serviceKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '');
  if (!baseUrl || !serviceKey) throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY belum dikonfigurasi.');
  return { baseUrl, serviceKey };
}

async function supabaseRequest(path, options = {}) {
  const { baseUrl, serviceKey } = supabaseConfig();
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

async function readJson(response) {
  return response.json().catch(() => ({}));
}

module.exports = { supabaseRequest, readJson };
