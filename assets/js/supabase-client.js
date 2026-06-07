(function () {
  'use strict';

  const cfg = window.NIAGABIO_CONFIG || {};
  const isPlaceholder = value => !value || /YOUR_|PASTE_|_HERE/i.test(String(value));
  const urlReady = Boolean(cfg.SUPABASE_URL && !isPlaceholder(cfg.SUPABASE_URL));
  const keyReady = Boolean(cfg.SUPABASE_ANON_KEY && !isPlaceholder(cfg.SUPABASE_ANON_KEY));
  const canSupabase = Boolean(window.supabase && urlReady && keyReady && cfg.DEMO_MODE !== true);
  let sb = null;

  try {
    sb = canSupabase ? window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY) : null;
  } catch (error) {
    console.warn('[NiagaBio] Supabase config belum valid, fallback ke demo/localStorage:', error.message);
    sb = null;
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
    premiumRequests: 'nb_premium_requests'
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
    premium_requests: LS.premiumRequests
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
    try {
      const value = JSON.parse(localStorage.getItem(key));
      return value ?? fallback;
    } catch (error) {
      return fallback;
    }
  }

  function write(key, value) {
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
      return cfg.DEMO_MODE === true || !sb ? input : fallback;
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

  function uniqueUsername(base) {
    const safeBase = slugify(base) || 'user';
    const used = read(LS.profiles, []).map(profile => profile.username);
    let value = safeBase;
    let index = 1;
    while (used.includes(value)) {
      value = `${safeBase}-${index++}`;
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
    if (localStorage.getItem('nb_seeded_v2')) return;

    const adminId = 'user_admin';
    const sellerId = 'user_demo';

    write(LS.settings, { ...defaultSettings });
    write(LS.users, [
      { id: adminId, email: cfg.ADMIN_EMAIL || 'unrageunrage@gmail.com', password: 'admin123', created_at: now() },
      { id: sellerId, email: 'demo@niagabio.local', password: 'demo123', created_at: now() }
    ]);

    write(LS.profiles, [
      {
        id: 'profile_admin',
        user_id: adminId,
        email: cfg.ADMIN_EMAIL || 'unrageunrage@gmail.com',
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

    write(LS.orders, [
      { id: 'ord_1', seller_id: sellerId, buyer_name: 'Rizky', buyer_phone: '628111111111', product_id: 'prd_1', product_name: 'Hoodie Basic', quantity: 1, total_price: 120000, payment_method: 'whatsapp', payment_status: 'paid', proof_image_url: '', created_at: now(), paid_at: now() },
      { id: 'ord_2', seller_id: sellerId, buyer_name: 'Dina', buyer_phone: '628222222222', product_id: 'prd_2', product_name: 'Kaos Oversize', quantity: 2, total_price: 170000, payment_method: 'qris_manual', payment_status: 'pending', proof_image_url: '', created_at: now(), paid_at: null }
    ]);

    localStorage.setItem('nb_seeded_v1', '1');
    localStorage.setItem('nb_seeded_v2', '1');
  }

  seedDemo();

  async function uploadFile(file, folder = 'products') {
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
      let path = `proofs/${randomName}`;

      if (cleanFolder !== 'proofs') {
        const user = await currentUser();
        if (!user) throw new Error('Login diperlukan untuk upload file.');

        if (cleanFolder === 'premium-qris') {
          const profile = await getProfile(user.id);
          if (String(profile?.role || '').toLowerCase() !== 'admin') {
            throw new Error('Hanya admin yang boleh upload QRIS premium.');
          }
        }

        path = `${cleanFolder}/${user.id}/${randomName}`;
      }

      const { error } = await sb.storage.from('niagabio').upload(path, file, {
        cacheControl: '3600',
        contentType: mime,
        upsert: false
      });
      if (error) throw error;
      const { data } = sb.storage.from('niagabio').getPublicUrl(path);
      return data.publicUrl;
    }

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
        try {
          await upsertProfile({
            user_id: data.user.id,
            email: cleanEmail,
            username: slugify(displayName || cleanEmail.split('@')[0]) || `user-${Date.now()}`,
            display_name: displayName,
            bio: '',
            avatar_url: 'assets/img/logo.jpg',
            whatsapp_number: '',
            theme_name: 'service'
          });
        } catch (profileError) {
          console.warn('[NiagaBio] Profile belum dibuat otomatis:', profileError.message);
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
      role: cleanEmail === (cfg.ADMIN_EMAIL || '').toLowerCase() ? 'admin' : 'user',
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
      const { data, error } = await sb.from('profiles').select('*').eq('username', cleanUsername).eq('status', 'active').maybeSingle();
      if (error) throw error;
      return data;
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

  async function save(table, row) {
    if (sb) {
      let payload = { ...row };
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
    let index = rows.findIndex(item => item.id === row.id);

    if (table === 'orders' && index < 0) {
      const product = read(LS.products, []).find(item => item.id === row.product_id);
      if (product) {
        row.product_name = product.name;
        row.total_price = Number(product.price || 0) * Number(row.quantity || 1);
        row.payment_status = 'pending';
        row.paid_at = null;
      }
    }

    if (index >= 0) rows[index] = { ...rows[index], ...row, updated_at: now() };
    else rows.push({ ...row, id: row.id || uid(table.slice(0, 3)), created_at: now(), updated_at: now() });

    write(key, rows);
    return rows[index >= 0 ? index : rows.length - 1];
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
      proof_url: normalizeImageUrl(payload.proof_url || '', ''),
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
    return rows[rows.length - 1];
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
    safeHref,
    safeImageUrl,
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
    resetSalesRecap,
    adminReviewPremiumRequest,
    adminSoftDeleteUser
  };
})();
