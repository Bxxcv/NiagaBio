(function () {
  'use strict';

  const cfg = window.NIAGABIO_CONFIG || {};
  const runtimeHost = String(location.hostname || '').toLowerCase();
  const runtimeProtocol = String(location.protocol || '').toLowerCase();
  const isLocalEnvironment = runtimeProtocol === 'file:' || ['localhost', '127.0.0.1', '::1'].includes(runtimeHost) || runtimeHost.endsWith('.localhost');
  const isProductionHost = runtimeHost === 'niaga-bio.vercel.app' || runtimeHost.endsWith('.vercel.app') || cfg.PRODUCTION === true;
  const isPlaceholder = value => !value || /YOUR_|PASTE_|_HERE/i.test(String(value));
  const urlReady = Boolean(cfg.SUPABASE_URL && !isPlaceholder(cfg.SUPABASE_URL));
  const keyReady = Boolean(cfg.SUPABASE_ANON_KEY && !isPlaceholder(cfg.SUPABASE_ANON_KEY));
  const demoRequested = cfg.DEMO_MODE === true;
  const localFallbackAllowed = Boolean(demoRequested && isLocalEnvironment && !isProductionHost);
  const canSupabase = Boolean(window.supabase && urlReady && keyReady && !localFallbackAllowed);
  let sb = null;

  if (demoRequested && !localFallbackAllowed) {
    console.warn('[NiagaBio] DEMO_MODE diabaikan karena halaman tidak berjalan di lingkungan lokal yang aman.');
  }

  try {
    sb = canSupabase ? window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY) : null;
  } catch (error) {
    console.error('[NiagaBio] Supabase gagal dibuat:', error.message);
    sb = null;
  }

  function productionGuardError(action = 'memproses data') {
    return new Error(`Koneksi database belum siap untuk ${action}. Refresh halaman. Jika masih terjadi, hubungi admin NiagaBio.`);
  }

  function assertDataLayer(action = 'memproses data') {
    if (sb || localFallbackAllowed) return true;
    throw productionGuardError(action);
  }

  function databaseReady() {
    return Boolean(sb || localFallbackAllowed);
  }

  function showDataLayerWarning() {
    if (databaseReady() || document.getElementById('nbDataLayerWarning')) return;
    const warning = document.createElement('div');
    warning.id = 'nbDataLayerWarning';
    warning.setAttribute('role', 'alert');
    warning.style.cssText = 'position:relative;z-index:9999;margin:0;padding:12px 16px;background:#fff3cd;color:#664d03;border-bottom:1px solid #ffecb5;font:14px/1.45 system-ui,-apple-system,Segoe UI,sans-serif;text-align:center';
    warning.textContent = 'Koneksi database NiagaBio belum siap. Refresh halaman. Jika masih terjadi, hubungi admin.';
    document.body.prepend(warning);
  }

  if (!databaseReady()) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', showDataLayerWarning, { once: true });
    else showDataLayerWarning();
  }

  const LS = {
    users: 'nb_users',
    session: 'nb_session',
    profiles: 'nb_profiles',
    products: 'nb_products',
    links: 'nb_links',
    socials: 'nb_socials',
    galleries: 'nb_galleries',
    checkout: 'nb_checkout_settings',
    orders: 'nb_orders',
    settings: 'nb_app_settings',
    premiumRequests: 'nb_premium_requests',
    passwordResetRequests: 'nb_password_reset_requests',
    notifications: 'nb_notifications'
  };

  const tableKeys = {
    profiles: LS.profiles,
    products: LS.products,
    custom_links: LS.links,
    social_links: LS.socials,
    gallery: LS.galleries,
    checkout_settings: LS.checkout,
    orders: LS.orders,
    app_settings: LS.settings,
    premium_requests: LS.premiumRequests,
    password_reset_requests: LS.passwordResetRequests,
    notifications: LS.notifications
  };

  const limits = {
    free: {
      products: 5,
      links: 5,
      socials: 3,
      gallery: 0,
      themes: ['service', 'minimal']
    },
    premium: {
      products: 500,
      links: 100,
      socials: 20,
      gallery: 50,
      themes: ['service', 'minimal', 'fashion', 'gadget', 'food', 'beauty', 'dark', 'luxury', 'neon', 'portfolio']
    }
  };

  const themes = [
    { id: 'service', name: 'Seller Green', premium: false, desc: 'Toko hijau modern untuk seller umum dan UMKM.' },
    { id: 'minimal', name: 'Clean Minimal', premium: false, desc: 'Template putih sederhana, rapi, dan cepat dibaca.' },
    { id: 'fashion', name: 'Editorial Fashion', premium: true, desc: 'Layout majalah dengan hero besar untuk brand fashion.' },
    { id: 'gadget', name: 'Tech Dashboard', premium: true, desc: 'Tampilan gelap grid untuk gadget dan produk digital.' },
    { id: 'food', name: 'Warm Menu', premium: true, desc: 'Layout menu hangat untuk kuliner, snack, dan resto.' },
    { id: 'beauty', name: 'Soft Beauty', premium: true, desc: 'Pastel premium untuk skincare, salon, dan beauty.' },
    { id: 'dark', name: 'Black Drop', premium: true, desc: 'Tampilan hitam kontras untuk drop, streetwear, dan premium store.' },
    { id: 'luxury', name: 'Gold Signature', premium: true, desc: 'Gold serif elegan untuk produk mahal dan eksklusif.' },
    { id: 'neon', name: 'Neon Creator', premium: true, desc: 'Cyber neon untuk kreator, game, dan brand anak muda.' },
    { id: 'portfolio', name: 'Creator Brutalist', premium: true, desc: 'Template kotak tebal ala portfolio/link store seperti contoh.' }
  ];

  const defaultSettings = {
    id: 'global',
    maintenance_mode: false,
    maintenance_message: 'Website sedang maintenance. Silakan coba lagi nanti.',
    allow_register: true,
    premium_price: Number(cfg.PREMIUM_PRICE || 80000),
    admin_whatsapp: '6281234567890',
    premium_qris_url: '',
    premium_note: 'Transfer sesuai nominal, lalu upload bukti pembayaran. Admin akan memproses upgrade setelah pembayaran valid.'
  };

  function read(key, fallback) {
    assertDataLayer('membaca data lokal');
    try {
      const value = JSON.parse(localStorage.getItem(key));
      return value ?? fallback;
    } catch (error) {
      return fallback;
    }
  }

  function write(key, value) {
    assertDataLayer('menyimpan data lokal');
    localStorage.setItem(key, JSON.stringify(value));
    return value;
  }

  function uid(prefix = 'id') {
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  }

  function isUuid(value) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''));
  }

  function slugify(value) {
    return String(value || '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 32);
  }

  function now() {
    return new Date().toISOString();
  }

  function money(value) {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0
    }).format(Number(value || 0));
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>'"]/g, char => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[char]));
  }

  function stripUnsafeControls(value) {
    return String(value ?? '').trim().replace(/[\u0000-\u001F\u007F\s]+/g, match => match.includes(' ') ? ' ' : '');
  }

  function isSafeRelativeHref(value) {
    const input = String(value || '').trim();
    if (!input || input.startsWith('//')) return false;
    if (/^[a-z][a-z0-9+.-]*:/i.test(input)) return false;
    return /^[a-z0-9._~!$&'()*+,;=@/%?#-]+$/i.test(input);
  }

  function normalizeExternalUrl(value, fallback = '#') {
    let input = stripUnsafeControls(value);
    if (!input) return fallback;

    const lower = input.toLowerCase().replace(/\s+/g, '');
    if (/^(javascript|data|vbscript|file|blob):/i.test(lower)) return fallback;

    if (/^[a-z][a-z0-9+.-]*:/i.test(input)) {
      try {
        const parsed = new URL(input);
        const protocol = parsed.protocol.toLowerCase();
        return ['https:', 'http:', 'mailto:', 'tel:'].includes(protocol) ? parsed.href : fallback;
      } catch (error) {
        return fallback;
      }
    }

    input = input.replace(/^\/\//, '');
    try {
      const parsed = new URL(`https://${input}`);
      return ['https:', 'http:'].includes(parsed.protocol.toLowerCase()) ? parsed.href : fallback;
    } catch (error) {
      return fallback;
    }
  }

  function safeHref(value, fallback = '#') {
    const input = stripUnsafeControls(value);
    if (!input) return escapeHtml(fallback);
    if (isSafeRelativeHref(input)) return escapeHtml(input);
    return escapeHtml(normalizeExternalUrl(input, fallback));
  }

  function normalizeImageUrl(value, fallback = 'assets/img/placeholder-product.svg') {
    const input = stripUnsafeControls(value);
    if (!input) return fallback;

    const lower = input.toLowerCase().replace(/\s+/g, '');
    if (/^(javascript|vbscript|file|blob):/i.test(lower)) return fallback;

    if (/^data:image\/(jpeg|jpg|png|webp);base64,/i.test(input)) {
      return localFallbackAllowed ? input : fallback;
    }

    if (/^(assets\/img\/|\/assets\/img\/)/i.test(input)) {
      return input;
    }

    if (/^(?!.*:)[a-z0-9._~!$&'()*+,;=@/%?#-]+\.(jpe?g|png|webp|svg)(\?.*)?$/i.test(input)) {
      return input;
    }

    try {
      const parsed = new URL(input);
      if (parsed.protocol !== 'https:') return fallback;

      const isSupabaseObject = /\.supabase\.co$/i.test(parsed.hostname) && parsed.pathname.includes('/storage/v1/object/public/');
      const hasSafeImageExtension = /\.(jpe?g|png|webp)(\?.*)?$/i.test(parsed.pathname + parsed.search);
      return (isSupabaseObject || hasSafeImageExtension) ? parsed.href : fallback;
    } catch (error) {
      return fallback;
    }
  }

  function safeImageUrl(value, fallback = 'assets/img/placeholder-product.svg') {
    return escapeHtml(normalizeImageUrl(value, fallback));
  }

  const PRIVATE_PROOF_BUCKET = 'niagabio-private';
  const proofSignedUrlCache = new Map();

  function parsePrivateProofRef(value) {
    const raw = stripUnsafeControls(value);
    const prefix = `private:${PRIVATE_PROOF_BUCKET}/`;
    if (!raw.toLowerCase().startsWith(prefix)) return null;

    const path = raw.slice(prefix.length);
    const match = path.match(/^(proofs|premium-proofs)\/([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\/([^/]+\.(?:jpe?g|png|webp))$/i);
    if (!match) return null;

    return {
      bucket: PRIVATE_PROOF_BUCKET,
      path,
      folder: match[1].toLowerCase(),
      ownerId: match[2].toLowerCase(),
      fileName: match[3]
    };
  }

  function makePrivateProofRef(path) {
    return `private:${PRIVATE_PROOF_BUCKET}/${path}`;
  }

  function isPrivateProofRef(value, folder = '', ownerId = '') {
    const parsed = parsePrivateProofRef(value);
    if (!parsed) return false;
    if (folder && parsed.folder !== String(folder).toLowerCase()) return false;
    if (ownerId && parsed.ownerId !== String(ownerId).toLowerCase()) return false;
    return true;
  }

  function normalizeProofReference(value, folder = 'proofs', ownerId = '') {
    const raw = stripUnsafeControls(value);
    const cleanFolder = String(folder || '').toLowerCase();
    const cleanOwnerId = String(ownerId || '').toLowerCase();

    if (!raw) return '';
    if (isPrivateProofRef(raw, cleanFolder, cleanOwnerId)) return raw;

    const publicUrl = normalizeImageUrl(raw, '');
    if (!publicUrl) return '';

    try {
      const parsed = new URL(publicUrl, location.origin);
      const path = parsed.pathname.toLowerCase();
      const extOk = /\.(jpe?g|png|webp)$/i.test(parsed.pathname);
      if (!extOk) return '';

      if (cleanFolder === 'proofs') {
        return path.includes('/storage/v1/object/public/niagabio/proofs/') ? publicUrl : '';
      }

      if (cleanFolder === 'premium-proofs') {
        const ownerPart = cleanOwnerId ? `/${cleanOwnerId}/` : '/';
        return path.includes(`/storage/v1/object/public/niagabio/premium-proofs${ownerPart}`) ? publicUrl : '';
      }
    } catch (error) {
      return '';
    }

    return '';
  }

  async function getProofDisplayUrl(value) {
    const parsed = parsePrivateProofRef(value);
    if (!parsed) return normalizeImageUrl(value, '');
    if (!sb) return '';

    const cacheKey = `${parsed.bucket}/${parsed.path}`;
    const cached = proofSignedUrlCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now() + 15000) return cached.url;

    const { data, error } = await sb.storage.from(parsed.bucket).createSignedUrl(parsed.path, 300);
    if (error) throw error;

    const signedUrl = data?.signedUrl || '';
    if (signedUrl) {
      proofSignedUrlCache.set(cacheKey, { url: signedUrl, expiresAt: Date.now() + 285000 });
    }
    return signedUrl;
  }

  async function hydrateProofLinks(root = document) {
    const scope = root || document;
    const elements = Array.from(scope.querySelectorAll('[data-proof-ref]'));
    await Promise.all(elements.map(async element => {
      const ref = element.getAttribute('data-proof-ref') || '';
      try {
        const url = await getProofDisplayUrl(ref);
        if (!url) throw new Error('Bukti tidak tersedia.');

        if (element.tagName === 'IMG') {
          element.src = url;
          element.classList.remove('is-proof-loading');
          return;
        }

        if (element.tagName === 'A') {
          element.href = url;
          element.classList.remove('disabled', 'is-proof-loading');
          element.removeAttribute('aria-disabled');
        }
      } catch (error) {
        if (element.tagName === 'IMG') {
          element.alt = 'Bukti bayar tidak bisa dimuat';
          element.classList.add('is-proof-error');
          return;
        }

        if (element.tagName === 'A') {
          element.removeAttribute('href');
          element.classList.add('disabled', 'is-proof-error');
          element.setAttribute('aria-disabled', 'true');
          element.textContent = 'Bukti tidak bisa dibuka';
        }
      }
    }));
  }

  function assertSafeImageUrl(value, fallback = '') {
    const raw = String(value || '').trim();
    const normalized = normalizeImageUrl(raw, fallback);
    if (raw && !normalized) {
      throw new Error('URL gambar tidak valid atau tidak aman.');
    }
    return normalized;
  }

  function safeIconClass(value, fallback = 'bi-link-45deg') {
    const icon = String(value || '').trim();
    return /^bi-[a-z0-9-]+$/i.test(icon) ? icon : fallback;
  }

  function normalizePhone(phone) {
    let value = String(phone || '').replace(/[^0-9]/g, '');
    if (value.startsWith('0')) value = `62${value.slice(1)}`;
    return value;
  }

  function socialIcon(platform) {
    const key = String(platform || '').toLowerCase().trim();
    return {
      instagram: 'bi-instagram',
      whatsapp: 'bi-whatsapp',
      wa: 'bi-whatsapp',
      tiktok: 'bi-tiktok',
      facebook: 'bi-facebook',
      youtube: 'bi-youtube',
      x: 'bi-twitter-x',
      twitter: 'bi-twitter-x',
      telegram: 'bi-telegram',
      shopee: 'bi-bag-heart',
      tokopedia: 'bi-shop-window',
      lazada: 'bi-shop',
      marketplace: 'bi-shop-window',
      maps: 'bi-geo-alt',
      website: 'bi-globe2'
    }[key] || 'bi-link-45deg';
  }

  function detectLinkIcon(url = '', title = '') {
    const value = `${url} ${title}`.toLowerCase();

    if (/wa\.me|whatsapp|api\.whatsapp|chat\.whatsapp/.test(value)) return 'bi-whatsapp';
    if (/instagram\.com|(^|\s)ig($|\s)|instagram/.test(value)) return 'bi-instagram';
    if (/tiktok\.com|tiktok/.test(value)) return 'bi-tiktok';
    if (/facebook\.com|fb\.com|facebook/.test(value)) return 'bi-facebook';
    if (/youtube\.com|youtu\.be|youtube/.test(value)) return 'bi-youtube';
    if (/telegram\.me|t\.me|telegram/.test(value)) return 'bi-telegram';
    if (/shopee\.co|shopee/.test(value)) return 'bi-bag-heart';
    if (/tokopedia\.com|tokopedia/.test(value)) return 'bi-shop-window';
    if (/lazada\.co|lazada/.test(value)) return 'bi-shop';
    if (/maps\.app\.goo\.gl|google\.com\/maps|maps|lokasi|alamat/.test(value)) return 'bi-geo-alt';
    if (/mailto:|email|gmail/.test(value)) return 'bi-envelope';
    if (/tel:|telepon|phone/.test(value)) return 'bi-telephone';
    if (/drive\.google|docs\.google/.test(value)) return 'bi-file-earmark-text';
    if (/github\.com|github/.test(value)) return 'bi-github';
    if (/price|harga|katalog|catalog|produk|product/.test(value)) return 'bi-bag';

    return 'bi-link-45deg';
  }

  function getLimits(plan) {
    return limits[plan === 'premium' ? 'premium' : 'free'];
  }

  function isPremium(profile) {
    if (!profile) return false;

    const status = String(profile.status || 'active').toLowerCase();
    if (status === 'blocked') return false;

    const role = String(profile.role || '').toLowerCase();
    const plan = String(profile.plan || '').toLowerCase();
    if (role !== 'admin' && plan !== 'premium') return false;

    const endDate = profile.plan_end_date;
    if (!endDate || endDate === 'null' || endDate === 'undefined') return true;

    const timestamp = new Date(endDate).getTime();
    if (Number.isNaN(timestamp)) return true;

    return timestamp > Date.now();
  }

  function whatsappUrl(phone, text) {
    const cleanPhone = normalizePhone(phone);
    return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text || 'Halo kak.')}`;
  }

  function makeSafeUsername(base, forceSuffix = false) {
    let safeBase = slugify(base);
    if (safeBase.length < 3) safeBase = `user-${Date.now().toString(36)}`;
    safeBase = safeBase.slice(0, 24).replace(/-+$/g, '') || 'user';

    if (!forceSuffix) return safeBase;

    const suffix = Math.random().toString(36).slice(2, 6);
    return `${safeBase}-${suffix}`.slice(0, 32).replace(/-+$/g, '');
  }

  function uniqueUsername(base) {
    const used = read(LS.profiles, []).map(profile => profile.username);
    let value = makeSafeUsername(base);
    let index = 1;
    while (used.includes(value)) {
      value = `${makeSafeUsername(base).slice(0, 26)}-${index++}`.slice(0, 32).replace(/-+$/g, '');
    }
    return value;
  }

  function publicProfilePayload(profile) {
    const allowed = [
      'id',
      'user_id',
      'email',
      'username',
      'display_name',
      'bio',
      'avatar_url',
      'whatsapp_number',
      'theme_name',
      'created_at'
    ];
    const payload = {};
    allowed.forEach(key => {
      if (profile[key] !== undefined) payload[key] = profile[key];
    });
    if (payload.id && !isUuid(payload.id)) delete payload.id;
    return payload;
  }

  function seedDemo() {
    if (!localFallbackAllowed) return;
    if (localStorage.getItem('nb_seeded_v2')) return;

    const adminId = 'user_admin';
    const sellerId = 'user_demo';

    write(LS.settings, { ...defaultSettings });
    write(LS.users, [
      { id: adminId, email: cfg.ADMIN_EMAIL || 'admin@niagabio.local', password: 'admin123', created_at: now() },
      { id: sellerId, email: 'demo@niagabio.local', password: 'demo123', created_at: now() }
    ]);

    write(LS.profiles, [
      {
        id: 'profile_admin',
        user_id: adminId,
        email: cfg.ADMIN_EMAIL || 'admin@niagabio.local',
        username: 'admin',
        display_name: 'Admin NiagaBio',
        bio: 'Admin utama platform.',
        avatar_url: 'assets/img/logo.jpg',
        whatsapp_number: defaultSettings.admin_whatsapp,
        plan: 'premium',
        role: 'admin',
        status: 'active',
        plan_end_date: '2099-12-31T00:00:00Z',
        theme_name: 'service',
        created_at: now(),
        updated_at: now()
      },
      {
        id: 'profile_demo',
        user_id: sellerId,
        email: 'demo@niagabio.local',
        username: 'demo',
        display_name: 'Niaga Store',
        bio: 'Katalog produk pilihan dengan checkout WhatsApp dan QRIS manual.',
        avatar_url: 'assets/img/logo.jpg',
        whatsapp_number: defaultSettings.admin_whatsapp,
        plan: 'premium',
        role: 'user',
        status: 'active',
        plan_end_date: '2099-12-31T00:00:00Z',
        theme_name: 'service',
        created_at: now(),
        updated_at: now()
      }
    ]);

    write(LS.products, [
      { id: 'prd_1', user_id: sellerId, name: 'Hoodie Basic', price: 120000, description: 'Hoodie nyaman untuk harian.', image_url: 'assets/img/placeholder-product.svg', category: 'Fashion', is_active: true, is_featured: true, sort_order: 1, created_at: now() },
      { id: 'prd_2', user_id: sellerId, name: 'Kaos Oversize', price: 85000, description: 'Kaos bahan adem dan cutting oversize.', image_url: 'assets/img/placeholder-product.svg', category: 'Fashion', is_active: true, is_featured: true, sort_order: 2, created_at: now() },
      { id: 'prd_3', user_id: sellerId, name: 'Paket Stiker UMKM', price: 45000, description: 'Stiker custom untuk packaging.', image_url: 'assets/img/placeholder-product.svg', category: 'Bisnis', is_active: true, is_featured: false, sort_order: 3, created_at: now() }
    ]);

    write(LS.links, [
      { id: 'lnk_1', user_id: sellerId, title: 'Katalog Lengkap', url: 'https://example.com', icon: 'bi-bag', is_active: true, sort_order: 1, click_count: 0, created_at: now() },
      { id: 'lnk_2', user_id: sellerId, title: 'Lokasi Toko', url: 'https://maps.google.com', icon: 'bi-geo-alt', is_active: true, sort_order: 2, click_count: 0, created_at: now() }
    ]);

    write(LS.socials, [
      { id: 'soc_1', user_id: sellerId, platform: 'instagram', url: 'https://instagram.com/', sort_order: 1, created_at: now() },
      { id: 'soc_2', user_id: sellerId, platform: 'whatsapp', url: 'https://wa.me/6281234567890', sort_order: 2, created_at: now() },
      { id: 'soc_3', user_id: sellerId, platform: 'tiktok', url: 'https://tiktok.com/', sort_order: 3, created_at: now() }
    ]);

    write(LS.galleries, [
      { id: 'gal_1', user_id: sellerId, image_url: 'assets/img/placeholder-product.svg', caption: 'Contoh gallery produk', sort_order: 1, created_at: now() }
    ]);

    write(LS.checkout, [
      { id: 'chk_1', user_id: sellerId, checkout_mode: 'whatsapp', whatsapp_number: '6281234567890', qris_enabled: false, qris_image_url: '', qris_name: 'NIAGA STORE', payment_note: 'Transfer sesuai nominal lalu upload bukti pembayaran.', created_at: now() }
    ]);

    write(LS.premiumRequests, []);
    write(LS.notifications, []);

    write(LS.orders, [
      { id: 'ord_1', seller_id: sellerId, buyer_name: 'Rizky', buyer_phone: '628111111111', product_id: 'prd_1', product_name: 'Hoodie Basic', quantity: 1, total_price: 120000, payment_method: 'whatsapp', payment_status: 'paid', proof_image_url: '', created_at: now(), paid_at: now() },
      { id: 'ord_2', seller_id: sellerId, buyer_name: 'Dina', buyer_phone: '628222222222', product_id: 'prd_2', product_name: 'Kaos Oversize', quantity: 2, total_price: 170000, payment_method: 'qris_manual', payment_status: 'pending', proof_image_url: '', created_at: now(), paid_at: null }
    ]);

    localStorage.setItem('nb_seeded_v1', '1');
    localStorage.setItem('nb_seeded_v2', '1');
  }

  seedDemo();

  async function uploadFile(file, folder = 'products', options = {}) {
    if (!file) return '';

    const allowedTypes = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp'
    };
    const maxSize = 3 * 1024 * 1024;
    const mime = String(file.type || '').toLowerCase();

    if (!allowedTypes[mime]) {
      throw new Error('Format file tidak didukung. Pakai JPG, PNG, atau WEBP.');
    }

    if (file.size > maxSize) {
      throw new Error('Ukuran file maksimal 3MB.');
    }

    const ext = allowedTypes[mime];
    const cleanFolder = String(folder || 'products').trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
    const allowedFolders = ['avatars', 'products', 'gallery', 'qris', 'premium-proofs', 'premium-qris', 'proofs'];
    if (!allowedFolders.includes(cleanFolder)) throw new Error('Folder upload tidak valid.');

    if (sb) {
      const randomId = window.crypto?.randomUUID ? window.crypto.randomUUID() : uid('file');
      const randomName = `${Date.now().toString(36)}-${randomId}.${ext}`;

      if (cleanFolder === 'proofs') {
        const sellerId = String(options.sellerId || options.ownerId || '').trim();
        if (!isUuid(sellerId)) throw new Error('Seller tidak valid untuk upload bukti bayar.');

        const path = `proofs/${sellerId}/${randomName}`;
        const { error } = await sb.storage.from(PRIVATE_PROOF_BUCKET).upload(path, file, {
          cacheControl: '3600',
          contentType: mime,
          upsert: false
        });
        if (error) throw error;
        return makePrivateProofRef(path);
      }

      if (cleanFolder === 'premium-proofs') {
        const user = await currentUser();
        if (!user) throw new Error('Login diperlukan untuk upload bukti upgrade.');

        const path = `premium-proofs/${user.id}/${randomName}`;
        const { error } = await sb.storage.from(PRIVATE_PROOF_BUCKET).upload(path, file, {
          cacheControl: '3600',
          contentType: mime,
          upsert: false
        });
        if (error) throw error;
        return makePrivateProofRef(path);
      }

      const user = await currentUser();
      if (!user) throw new Error('Login diperlukan untuk upload file.');

      if (cleanFolder === 'premium-qris') {
        const profile = await getProfile(user.id);
        if (String(profile?.role || '').toLowerCase() !== 'admin') {
          throw new Error('Hanya admin yang boleh upload QRIS premium.');
        }
      }

      const path = `${cleanFolder}/${user.id}/${randomName}`;
      const { error } = await sb.storage.from('niagabio').upload(path, file, {
        cacheControl: '3600',
        contentType: mime,
        upsert: false
      });
      if (error) throw error;
      const { data } = sb.storage.from('niagabio').getPublicUrl(path);
      return data.publicUrl;
    }

    assertDataLayer('upload file');
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function currentUser() {
    if (sb) {
      const { data, error } = await sb.auth.getUser();
      if (error) return null;
      return data.user ? { id: data.user.id, email: data.user.email } : null;
    }

    const id = localStorage.getItem(LS.session);
    if (!id) return null;
    return read(LS.users, []).find(user => user.id === id) || null;
  }

  async function signUp(email, password, name) {
    const cleanEmail = String(email || '').trim().toLowerCase();
    const displayName = String(name || '').trim() || cleanEmail.split('@')[0];

    if (sb) {
      const { data, error } = await sb.auth.signUp({
        email: cleanEmail,
        password,
        options: { data: { display_name: displayName } }
      });
      if (error) throw error;

      if (data.user) {
        let lastProfileError = null;

        for (let attempt = 0; attempt < 3; attempt += 1) {
          try {
            await upsertProfile({
              user_id: data.user.id,
              email: cleanEmail,
              username: makeSafeUsername(displayName || cleanEmail.split('@')[0], attempt > 0),
              display_name: displayName,
              bio: '',
              avatar_url: 'assets/img/logo.jpg',
              whatsapp_number: '',
              theme_name: 'service'
            });
            lastProfileError = null;
            break;
          } catch (profileError) {
            lastProfileError = profileError;
            const message = String(profileError.message || '').toLowerCase();
            const isUsernameConflict = message.includes('duplicate') || message.includes('unique') || message.includes('23505');
            if (!isUsernameConflict) break;
          }
        }

        if (lastProfileError) {
          console.warn('[NiagaBio] Profile belum dibuat otomatis:', lastProfileError.message);
        }
      }

      return data.user;
    }

    const users = read(LS.users, []);
    if (users.some(user => user.email === cleanEmail)) throw new Error('Email sudah terdaftar.');

    const user = { id: uid('user'), email: cleanEmail, password, created_at: now() };
    users.push(user);
    write(LS.users, users);
    localStorage.setItem(LS.session, user.id);

    const profiles = read(LS.profiles, []);
    profiles.push({
      id: uid('profile'),
      user_id: user.id,
      email: cleanEmail,
      username: uniqueUsername(displayName || cleanEmail.split('@')[0]),
      display_name: displayName || 'User NiagaBio',
      bio: '',
      avatar_url: 'assets/img/logo.jpg',
      whatsapp_number: '',
      plan: 'free',
      role: localFallbackAllowed && cleanEmail === String(cfg.ADMIN_EMAIL || 'admin@niagabio.local').toLowerCase() ? 'admin' : 'user',
      status: 'active',
      plan_end_date: null,
      theme_name: 'service',
      created_at: now(),
      updated_at: now()
    });
    write(LS.profiles, profiles);
    return user;
  }

  async function signIn(email, password) {
    const cleanEmail = String(email || '').trim().toLowerCase();

    if (sb) {
      const { data, error } = await sb.auth.signInWithPassword({ email: cleanEmail, password });
      if (error) throw error;
      return data.user;
    }

    const user = read(LS.users, []).find(item => item.email === cleanEmail && item.password === password);
    if (!user) throw new Error('Email atau password salah.');
    localStorage.setItem(LS.session, user.id);
    return user;
  }

  async function signOut() {
    if (sb) await sb.auth.signOut();
    localStorage.removeItem(LS.session);
  }


  function passwordResetRedirectUrl() {
    return `${location.origin}/reset-password`;
  }

  async function requestPasswordReset(email, note = '') {
    const cleanEmail = String(email || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      throw new Error('Email tidak valid.');
    }

    if (sb) {
      const { data, error } = await sb.rpc('request_password_reset', {
        requester_email: cleanEmail,
        requester_note: String(note || '').trim()
      });
      if (error) {
        const message = String(error.message || '').toLowerCase();
        if (message.includes('request_password_reset') || message.includes('could not find the function')) {
          throw new Error('Fitur lupa password belum aktif. Jalankan supabase/11_password_reset_requests.sql dulu.');
        }
        throw error;
      }
      return data;
    }

    const profiles = read(LS.profiles, []);
    const profile = profiles.find(item => String(item.email || '').toLowerCase() === cleanEmail);
    const row = {
      id: uid('pwdreq'),
      user_id: profile?.user_id || null,
      email: cleanEmail,
      display_name: profile?.display_name || '',
      username: profile?.username || '',
      user_note: String(note || '').trim(),
      status: 'pending',
      reset_sent_count: 0,
      created_at: now(),
      updated_at: now()
    };
    const rows = read(LS.passwordResetRequests, []);
    rows.unshift(row);
    write(LS.passwordResetRequests, rows.slice(0, 200));

    read(LS.profiles, [])
      .filter(item => item.role === 'admin' && item.status !== 'blocked' && item.status !== 'deleted')
      .forEach(admin => localCreateNotification({
        user_id: admin.user_id,
        actor_user_id: profile?.user_id || null,
        type: 'password_reset_request_new',
        title: 'Request lupa password',
        message: `${cleanEmail} meminta bantuan reset password.`,
        link_url: 'admin#requests',
        metadata: { request_id: row.id, request_email: cleanEmail }
      }));

    return { success: true, id: row.id };
  }

  async function sendPasswordResetEmail(email) {
    const cleanEmail = String(email || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      throw new Error('Email tidak valid.');
    }

    if (sb) {
      const { data, error } = await sb.auth.resetPasswordForEmail(cleanEmail, {
        redirectTo: passwordResetRedirectUrl()
      });
      if (error) throw error;
      return data;
    }

    return { success: true };
  }

  async function updatePassword(password) {
    if (String(password || '').length < 6) throw new Error('Password minimal 6 karakter.');

    if (sb) {
      const { data, error } = await sb.auth.updateUser({ password: String(password) });
      if (error) throw error;
      return data;
    }

    const user = await currentUser();
    if (!user) throw new Error('Session reset password tidak ditemukan. Buka ulang link reset dari email.');
    const users = read(LS.users, []);
    const index = users.findIndex(item => item.id === user.id);
    if (index < 0) throw new Error('User tidak ditemukan.');
    users[index] = { ...users[index], password: String(password) };
    write(LS.users, users);
    return true;
  }

  async function requireAuth() {
    const user = await currentUser();
    if (!user) {
      location.href = 'login';
      return null;
    }
    return user;
  }

  async function getProfile(userId) {
    if (sb) {
      const { data, error } = await sb.from('profiles').select('*').eq('user_id', userId).maybeSingle();
      if (error) throw error;
      return data;
    }

    return read(LS.profiles, []).find(profile => profile.user_id === userId) || null;
  }

  async function getProfileByUsername(username) {
    const cleanUsername = slugify(username);

    if (sb) {
      // Public page tidak boleh lagi select * dari profiles.
      // SQL 12 menyediakan RPC safe yang hanya mengembalikan field public + is_premium boolean.
      const { data, error } = await sb.rpc('get_public_profile', { lookup_username: cleanUsername });

      if (!error) {
        const row = Array.isArray(data) ? data[0] : data;
        if (!row) return null;

        return {
          user_id: row.user_id,
          username: row.username,
          display_name: row.display_name,
          bio: row.bio,
          avatar_url: row.avatar_url,
          whatsapp_number: row.whatsapp_number,
          theme_name: row.theme_name || 'service',
          status: 'active',
          plan: row.is_premium ? 'premium' : 'free',
          plan_end_date: row.is_premium ? '2099-12-31T00:00:00Z' : null,
          is_public_profile: true
        };
      }

      const message = String(error.message || '').toLowerCase();
      if (!message.includes('get_public_profile') && !message.includes('could not find the function')) {
        throw error;
      }

      // Fallback sementara kalau SQL 12 belum dijalankan. Setelah SQL 12 aktif, path ini tidak dipakai.
      const { data: fallbackData, error: fallbackError } = await sb
        .from('profiles')
        .select('user_id, username, display_name, bio, avatar_url, whatsapp_number, theme_name, plan, status, plan_end_date')
        .eq('username', cleanUsername)
        .eq('status', 'active')
        .maybeSingle();
      if (fallbackError) throw fallbackError;
      return fallbackData;
    }

    return read(LS.profiles, []).find(profile => profile.username === cleanUsername && profile.status !== 'blocked') || null;
  }

  async function upsertProfile(profile) {
    if (sb) {
      const payload = publicProfilePayload(profile);
      if (!payload.user_id) {
        const user = await currentUser();
        if (!user) throw new Error('Kamu harus login dulu.');
        payload.user_id = user.id;
      }

      const { data, error } = await sb.from('profiles').upsert(payload, { onConflict: 'user_id' }).select().single();
      if (error) throw error;
      return data;
    }

    const rows = read(LS.profiles, []);
    let index = rows.findIndex(item => item.user_id === profile.user_id);
    if (index < 0 && profile.id) index = rows.findIndex(item => item.id === profile.id);

    if (index >= 0) rows[index] = { ...rows[index], ...profile, updated_at: now() };
    else rows.push({ ...profile, id: profile.id || uid('profile'), created_at: now(), updated_at: now() });

    write(LS.profiles, rows);
    return rows[index >= 0 ? index : rows.length - 1];
  }


  async function setProfileTheme(themeId) {
    const cleanTheme = String(themeId || 'service').trim().toLowerCase();

    if (sb) {
      const { data, error } = await sb.rpc('set_profile_theme', { new_theme: cleanTheme });
      if (error) throw error;
      return data;
    }

    const user = await currentUser();
    if (!user) throw new Error('Kamu harus login dulu.');

    const rows = read(LS.profiles, []);
    const index = rows.findIndex(profile => profile.user_id === user.id);
    if (index < 0) throw new Error('Profile tidak ditemukan.');

    const profile = rows[index];
    const selected = themes.find(theme => theme.id === cleanTheme);
    if (!selected) throw new Error('Tema tidak valid.');
    if (selected.premium && !isPremium(profile)) throw new Error('Tema ini khusus Premium.');

    rows[index] = { ...profile, theme_name: cleanTheme, updated_at: now() };
    write(LS.profiles, rows);
    return rows[index];
  }

  async function list(table, userId, field = 'user_id') {
    if (sb) {
      let query = sb.from(table).select('*').eq(field, userId);
      if (['orders', 'checkout_settings'].includes(table)) {
        query = query.order('created_at', { ascending: false });
      } else {
        query = query.order('sort_order', { ascending: true }).order('created_at', { ascending: false });
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    }

    const key = tableKeys[table];
    const rows = read(key, []).filter(item => item[field] === userId);
    rows.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0) || String(b.created_at || '').localeCompare(a.created_at || ''));
    return rows;
  }

  function normalizePayloadForTable(table, row) {
    const payload = { ...row };

    if (table === 'products') {
      payload.name = String(payload.name || '').trim().slice(0, 120);
      if (payload.name.length < 2) throw new Error('Nama produk wajib diisi.');
      payload.description = String(payload.description || '').slice(0, 1000);
      payload.category = String(payload.category || '').trim().slice(0, 80);
      payload.price = Math.max(0, Number(payload.price || 0));
      payload.image_url = assertSafeImageUrl(payload.image_url || 'assets/img/placeholder-product.svg', 'assets/img/placeholder-product.svg');
    }

    if (table === 'custom_links') {
      payload.title = String(payload.title || '').trim().slice(0, 80);
      if (!payload.title) throw new Error('Judul link wajib diisi.');
      payload.url = normalizeExternalUrl(payload.url || '', '');
      if (!payload.url) throw new Error('URL link tidak valid.');
      payload.icon = safeIconClass(payload.icon || detectLinkIcon(payload.url, payload.title));
    }

    if (table === 'social_links') {
      payload.platform = String(payload.platform || 'website').toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 30) || 'website';
      payload.url = normalizeExternalUrl(payload.url || '', '');
      if (!payload.url) throw new Error('URL social media tidak valid.');
    }

    if (table === 'gallery') {
      payload.image_url = assertSafeImageUrl(payload.image_url || '', '');
      if (!payload.image_url) throw new Error('Gambar gallery wajib diisi.');
      payload.caption = String(payload.caption || '').slice(0, 160);
    }

    if (table === 'checkout_settings') {
      payload.whatsapp_number = normalizePhone(payload.whatsapp_number || '');
      payload.qris_image_url = assertSafeImageUrl(payload.qris_image_url || '', '');
      payload.qris_name = String(payload.qris_name || '').trim().slice(0, 80);
      payload.payment_note = String(payload.payment_note || '').slice(0, 500);
    }

    return payload;
  }

  function preparePublicOrderPayload(row) {
    const paymentMethod = String(row.payment_method || 'qris_manual').toLowerCase();
    if (!['qris_manual', 'qris_whatsapp'].includes(paymentMethod)) {
      throw new Error('Checkout hanya menerima pembayaran QRIS manual. Gunakan tombol WhatsApp untuk tanya penjual.');
    }

    const buyerName = String(row.buyer_name || '').trim().slice(0, 80);
    if (buyerName.length < 2) throw new Error('Nama pembeli wajib diisi minimal 2 karakter.');

    const buyerPhone = normalizePhone(row.buyer_phone || '');
    if (buyerPhone.length < 8 || buyerPhone.length > 18) throw new Error('Nomor WhatsApp pembeli tidak valid.');

    const quantity = Math.max(1, Number(row.quantity || 1));
    const proofUrl = normalizeProofReference(row.proof_image_url || '', 'proofs', row.seller_id || '');
    if (!proofUrl) {
      throw new Error('Bukti pembayaran wajib diupload sebelum kirim pesanan.');
    }

    return {
      seller_id: row.seller_id,
      product_id: row.product_id,
      buyer_name: buyerName,
      buyer_phone: buyerPhone,
      quantity,
      payment_method: paymentMethod,
      proof_image_url: proofUrl
    };
  }

  async function createPublicOrder(row) {
    const payload = preparePublicOrderPayload(row);

    if (!payload.seller_id || !isUuid(payload.seller_id)) throw new Error('Seller tidak valid.');
    if (!payload.product_id || !isUuid(payload.product_id)) throw new Error('Produk tidak valid.');

    if (sb) {
      const { data, error } = await sb.rpc('create_public_order', {
        target_seller_id: payload.seller_id,
        target_product_id: payload.product_id,
        buyer_name_input: payload.buyer_name,
        buyer_phone_input: payload.buyer_phone,
        quantity_input: payload.quantity,
        proof_image_url_input: payload.proof_image_url,
        payment_method_input: payload.payment_method
      });

      if (!error) return Array.isArray(data) ? data[0] : data;

      const message = String(error.message || '').toLowerCase();
      const missingRpc = message.includes('create_public_order') || message.includes('could not find the function') || message.includes('schema cache');
      if (missingRpc) {
        throw new Error('Checkout belum siap. Jalankan SQL supabase/15_order_proof_antispam_hardening.sql di Supabase SQL Editor, lalu deploy ulang.');
      }
      throw error;
    }

    // Local/demo fallback hanya boleh berjalan di lingkungan lokal yang sengaja mengaktifkan DEMO_MODE.
    // Production wajib lewat RPC supaya harga, status, dan proof divalidasi database.
    assertDataLayer('membuat pesanan');
    return await save('orders', {
      seller_id: payload.seller_id,
      buyer_name: payload.buyer_name,
      buyer_phone: payload.buyer_phone,
      product_id: payload.product_id,
      quantity: payload.quantity,
      payment_method: payload.payment_method,
      proof_image_url: payload.proof_image_url,
      payment_status: 'pending',
      paid_at: null,
      created_at: now()
    });
  }


  async function save(table, row) {
    const preparedRow = normalizePayloadForTable(table, row);

    if (sb) {
      let payload = preparedRow;
      if (payload.id && !isUuid(payload.id)) delete payload.id;

      if (table === 'orders') {
        if (payload.id) {
          payload = {
            id: payload.id,
            payment_status: payload.payment_status
          };
        } else {
          payload = {
            seller_id: payload.seller_id,
            buyer_name: String(payload.buyer_name || '').trim(),
            buyer_phone: normalizePhone(payload.buyer_phone),
            product_id: payload.product_id,
            quantity: Math.max(1, Number(payload.quantity || 1)),
            payment_method: payload.payment_method || 'whatsapp',
            proof_image_url: normalizeImageUrl(payload.proof_image_url || '', '')
          };
        }
      }

      if (payload.id) {
        const { data, error } = await sb.from(table).update(payload).eq('id', payload.id).select().single();
        if (error) throw error;
        return data;
      }

      const { data, error } = await sb.from(table).insert(payload).select().single();
      if (error) throw error;
      return data;
    }

    const key = tableKeys[table];
    const rows = read(key, []);
    let index = rows.findIndex(item => item.id === preparedRow.id);

    if (table === 'orders' && index < 0) {
      const product = read(LS.products, []).find(item => item.id === preparedRow.product_id);
      if (product) {
        preparedRow.product_name = product.name;
        preparedRow.total_price = Number(product.price || 0) * Number(preparedRow.quantity || 1);
        preparedRow.payment_status = 'pending';
        preparedRow.paid_at = null;
      }
    }

    if (index >= 0) rows[index] = { ...rows[index], ...preparedRow, updated_at: now() };
    else rows.push({ ...preparedRow, id: preparedRow.id || uid(table.slice(0, 3)), created_at: now(), updated_at: now() });

    write(key, rows);
    const saved = rows[index >= 0 ? index : rows.length - 1];

    if (table === 'orders' && index < 0 && saved.seller_id) {
      localCreateNotification({
        user_id: saved.seller_id,
        type: 'order_new',
        title: 'Pesanan baru',
        message: `${saved.buyer_name || 'Pembeli'} memesan ${saved.product_name || 'produk'} (${money(saved.total_price)}).`,
        link_url: 'orders',
        metadata: { order_id: saved.id }
      });
    }

    return saved;
  }

  async function remove(table, id) {
    if (sb) {
      const { error } = await sb.from(table).delete().eq('id', id);
      if (error) throw error;
      return true;
    }

    const key = tableKeys[table];
    write(key, read(key, []).filter(item => item.id !== id));
    return true;
  }

  async function all(table) {
    if (sb) {
      const { data, error } = await sb.from(table).select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    }

    return read(tableKeys[table], []);
  }

  async function getSettings() {
    if (sb) {
      const { data, error } = await sb.from('app_settings').select('*').eq('id', 'global').maybeSingle();
      if (error) {
        console.warn('[NiagaBio] Gagal mengambil app_settings:', error.message);
        return { ...defaultSettings };
      }
      return { ...defaultSettings, ...(data || {}) };
    }

    return { ...defaultSettings, ...read(LS.settings, defaultSettings) };
  }

  async function saveSettings(settings) {
    const payload = {
      id: 'global',
      maintenance_mode: Boolean(settings.maintenance_mode),
      maintenance_message: String(settings.maintenance_message || defaultSettings.maintenance_message),
      allow_register: Boolean(settings.allow_register),
      premium_price: Number(settings.premium_price || defaultSettings.premium_price),
      admin_whatsapp: normalizePhone(settings.admin_whatsapp || defaultSettings.admin_whatsapp),
      premium_qris_url: normalizeImageUrl(settings.premium_qris_url || '', ''),
      premium_note: String(settings.premium_note || defaultSettings.premium_note)
    };

    if (sb) {
      const user = await currentUser();
      payload.updated_by = user?.id || null;
      const { data, error } = await sb.from('app_settings').upsert(payload, { onConflict: 'id' }).select().single();
      if (error) throw error;
      return data;
    }

    write(LS.settings, { ...payload, updated_at: now() });
    return read(LS.settings, defaultSettings);
  }

  async function adminUpdateProfile(userId, fields) {
    if (sb) {
      const { data, error } = await sb.rpc('admin_update_profile_system_fields', {
        target_user_id: userId,
        new_role: fields.role ?? null,
        new_plan: fields.plan ?? null,
        new_status: fields.status ?? null,
        new_plan_end_date: fields.plan_end_date ?? null
      });
      if (error) throw error;
      return data;
    }

    const rows = read(LS.profiles, []);
    const index = rows.findIndex(profile => profile.user_id === userId);
    if (index < 0) throw new Error('Profile tidak ditemukan.');
    rows[index] = { ...rows[index], ...fields, updated_at: now() };
    if (rows[index].plan === 'free') rows[index].plan_end_date = null;
    write(LS.profiles, rows);
    return rows[index];
  }

  async function createPremiumRequest(payload) {
    const user = await currentUser();
    if (!user) throw new Error('Kamu harus login dulu.');

    const row = {
      user_id: user.id,
      email: user.email,
      shop_name: String(payload.shop_name || '').trim(),
      owner_name: String(payload.owner_name || '').trim(),
      proof_url: normalizeProofReference(payload.proof_url || '', 'premium-proofs', user.id),
      note: String(payload.note || ''),
      status: 'pending',
      created_at: now()
    };

    if (!row.shop_name || !row.owner_name || !row.proof_url) {
      throw new Error('Nama toko, nama pemilik, dan bukti transfer wajib diisi.');
    }

    if (sb) {
      const { data, error } = await sb.from('premium_requests').insert(row).select().single();
      if (error) throw error;
      return data;
    }

    const rows = read(LS.premiumRequests, []);
    rows.push({ ...row, id: uid('req'), updated_at: now() });
    write(LS.premiumRequests, rows);

    read(LS.profiles, [])
      .filter(profile => profile.role === 'admin' && profile.status !== 'blocked' && profile.status !== 'deleted')
      .forEach(admin => localCreateNotification({
        user_id: admin.user_id,
        actor_user_id: user.id,
        type: 'premium_request_new',
        title: 'Request Premium baru',
        message: `${row.shop_name} mengirim pengajuan upgrade Premium.`,
        link_url: 'admin#requests',
        metadata: { request_id: rows[rows.length - 1].id }
      }));

    return rows[rows.length - 1];
  }


  async function listPasswordResetRequests(limit = 100) {
    if (sb) {
      const { data, error } = await sb
        .from('password_reset_requests')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(Number(limit || 100));
      if (error) {
        const message = String(error.message || '').toLowerCase();
        if (message.includes('password_reset_requests')) {
          console.warn('[NiagaBio] Tabel password_reset_requests belum aktif. Jalankan SQL 11.');
          return [];
        }
        throw error;
      }
      return data || [];
    }

    return read(LS.passwordResetRequests, [])
      .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))
      .slice(0, Number(limit || 100));
  }

  async function adminUpdatePasswordResetRequest(requestId, status = 'sent') {
    if (!requestId) throw new Error('Request tidak valid.');
    const cleanStatus = String(status || 'sent').toLowerCase();

    if (sb) {
      const { data, error } = await sb.rpc('admin_update_password_reset_request', {
        request_id: requestId,
        new_status: cleanStatus
      });
      if (error) throw error;
      return data;
    }

    const rows = read(LS.passwordResetRequests, []);
    const index = rows.findIndex(item => String(item.id) === String(requestId));
    if (index < 0) throw new Error('Request lupa password tidak ditemukan.');
    rows[index] = {
      ...rows[index],
      status: cleanStatus,
      reviewed_by: (await currentUser())?.id || null,
      sent_at: cleanStatus === 'sent' ? now() : rows[index].sent_at || null,
      reset_sent_count: cleanStatus === 'sent' ? Number(rows[index].reset_sent_count || 0) + 1 : Number(rows[index].reset_sent_count || 0),
      updated_at: now()
    };
    write(LS.passwordResetRequests, rows);
    return rows[index];
  }


  function localCreateNotification(row) {
    const rows = read(LS.notifications, []);
    const notification = {
      id: row.id || uid('notif'),
      user_id: row.user_id,
      actor_user_id: row.actor_user_id || null,
      type: String(row.type || 'info'),
      title: String(row.title || 'Notifikasi'),
      message: String(row.message || ''),
      link_url: isSafeRelativeHref(row.link_url || '') ? String(row.link_url).trim() : normalizeExternalUrl(row.link_url || 'notifications', 'notifications'),
      metadata: row.metadata || {},
      is_read: Boolean(row.is_read),
      read_at: row.read_at || null,
      created_at: row.created_at || now()
    };
    rows.unshift(notification);
    write(LS.notifications, rows.slice(0, 200));
    return notification;
  }

  async function listNotifications(limit = 50) {
    if (sb) {
      const { data, error } = await sb
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(Number(limit || 50));
      if (error) throw error;
      return data || [];
    }

    const user = await currentUser();
    if (!user) return [];
    return read(LS.notifications, [])
      .filter(item => item.user_id === user.id)
      .sort((a, b) => String(b.created_at || '').localeCompare(a.created_at || ''))
      .slice(0, Number(limit || 50));
  }

  async function unreadNotificationsCount() {
    if (sb) {
      const { count, error } = await sb
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('is_read', false);
      if (error) throw error;
      return count || 0;
    }

    const user = await currentUser();
    if (!user) return 0;
    return read(LS.notifications, []).filter(item => item.user_id === user.id && !item.is_read).length;
  }

  async function markNotificationRead(id) {
    if (!id) return false;

    if (sb) {
      const { error } = await sb
        .from('notifications')
        .update({ is_read: true, read_at: now() })
        .eq('id', id);
      if (error) throw error;
      return true;
    }

    const rows = read(LS.notifications, []);
    const index = rows.findIndex(item => String(item.id) === String(id));
    if (index >= 0) rows[index] = { ...rows[index], is_read: true, read_at: now() };
    write(LS.notifications, rows);
    return true;
  }

  async function markAllNotificationsRead() {
    if (sb) {
      const { error } = await sb
        .from('notifications')
        .update({ is_read: true, read_at: now() })
        .eq('is_read', false);
      if (error) throw error;
      return true;
    }

    const user = await currentUser();
    if (!user) return false;
    const rows = read(LS.notifications, []).map(item => item.user_id === user.id ? { ...item, is_read: true, read_at: now() } : item);
    write(LS.notifications, rows);
    return true;
  }


  async function resetSalesRecap(userId) {
    if (sb) {
      const { data, error } = await sb.rpc('reset_my_sales_recap');
      if (error) throw error;
      return data;
    }

    const user = await currentUser();
    const sellerId = userId || user?.id;
    if (!sellerId) throw new Error('Session tidak ditemukan.');
    write(LS.orders, read(LS.orders, []).filter(order => order.seller_id !== sellerId));
    return true;
  }

  async function adminReviewPremiumRequest(requestId, action = 'approved', days = 30) {
    if (sb) {
      const { data, error } = await sb.rpc('admin_review_premium_request', {
        request_id: requestId,
        action_status: action,
        premium_days: Number(days || 30)
      });
      if (error) throw error;
      return data;
    }

    const requests = read(LS.premiumRequests, []);
    const requestIndex = requests.findIndex(item => item.id === requestId);
    if (requestIndex < 0) throw new Error('Request tidak ditemukan.');

    requests[requestIndex] = {
      ...requests[requestIndex],
      status: action === 'approved' ? 'approved' : 'rejected',
      reviewed_at: now(),
      updated_at: now()
    };
    write(LS.premiumRequests, requests);

    if (action === 'approved') {
      const endDate = new Date(Date.now() + Number(days || 30) * 24 * 60 * 60 * 1000).toISOString();
      await adminUpdateProfile(requests[requestIndex].user_id, {
        plan: 'premium',
        status: 'active',
        plan_end_date: endDate
      });
    }

    localCreateNotification({
      user_id: requests[requestIndex].user_id,
      type: action === 'approved' ? 'premium_approved' : 'premium_rejected',
      title: action === 'approved' ? 'Upgrade Premium disetujui' : 'Upgrade Premium ditolak',
      message: action === 'approved'
        ? 'Akun kamu sudah Premium. Fitur tema, gallery, dan QRIS sudah aktif.'
        : 'Pengajuan Premium kamu ditolak. Cek kembali bukti pembayaran atau hubungi admin.',
      link_url: action === 'approved' ? 'dashboard' : 'upgrade',
      metadata: { request_id: requests[requestIndex].id }
    });

    return requests[requestIndex];
  }

  async function adminSoftDeleteUser(userId) {
    if (sb) {
      const { data, error } = await sb.rpc('admin_soft_delete_user', { target_user_id: userId });
      if (error) throw error;
      return data;
    }

    const user = await currentUser();
    if (user?.id === userId) throw new Error('Admin tidak boleh menghapus akun sendiri.');

    const profiles = read(LS.profiles, []);
    const index = profiles.findIndex(profile => profile.user_id === userId);
    if (index < 0) throw new Error('Profile tidak ditemukan.');
    profiles[index] = { ...profiles[index], status: 'deleted', plan: 'free', plan_end_date: null, updated_at: now() };
    write(LS.profiles, profiles);

    ['products', 'custom_links', 'social_links', 'gallery', 'checkout_settings'].forEach(table => {
      const key = tableKeys[table];
      write(key, read(key, []).filter(item => item.user_id !== userId));
    });

    return profiles[index];
  }

  window.NB = {
    sb,
    cfg,
    canSupabase,
    localFallbackAllowed,
    isLocalEnvironment,
    isProductionHost,
    databaseReady,
    assertDataLayer,
    themes,
    limits,
    uid,
    isUuid,
    slugify,
    now,
    money,
    escapeHtml,
    normalizeExternalUrl,
    normalizeImageUrl,
    normalizeProofReference,
    parsePrivateProofRef,
    getProofDisplayUrl,
    hydrateProofLinks,
    safeHref,
    safeImageUrl,
    assertSafeImageUrl,
    safeIconClass,
    normalizePhone,
    socialIcon,
    detectLinkIcon,
    getLimits,
    isPremium,
    whatsappUrl,
    uploadFile,
    currentUser,
    signUp,
    signIn,
    signOut,
    requestPasswordReset,
    sendPasswordResetEmail,
    updatePassword,
    requireAuth,
    getProfile,
    getProfileByUsername,
    upsertProfile,
    setProfileTheme,
    list,
    save,
    remove,
    all,
    getSettings,
    saveSettings,
    adminUpdateProfile,
    createPremiumRequest,
    listPasswordResetRequests,
    adminUpdatePasswordResetRequest,
    resetSalesRecap,
    createPublicOrder,
    adminReviewPremiumRequest,
    adminSoftDeleteUser,
    listNotifications,
    unreadNotificationsCount,
    markNotificationRead,
    markAllNotificationsRead
  };
})();
