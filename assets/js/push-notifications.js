(function () {
  'use strict';

  const FIREBASE_SDK_VERSION = '12.17.1';
  const SOUND_KEY = 'niagabio_notification_sound_enabled';
  const PUSH_KEY_PREFIX = 'niagabio_push_enabled_';
  const AUDIO_URL = '/assets/audio/niapulse-order.mp3';
  const CROSS_TAB_EVENT_KEY = 'niagabio_recent_notification_events_v1';

  let messaging = null;
  let pushReady = false;
  let realtimeChannel = null;
  let currentUserId = null;
  let handledIds = new Set();
  let audio = null;
  let foregroundListenerBound = false;
  let serviceWorkerRegistration = null;

  const config = () => window.NIAGABIO_FIREBASE_CONFIG || {};
  const isPlaceholder = value => !value || /YOUR_|_HERE/i.test(String(value));

  const firebaseConfigured = () => {
    const c = config();
    return Boolean(c.apiKey && c.projectId && c.messagingSenderId && c.appId && c.vapidKey)
      && !isPlaceholder(c.apiKey)
      && !isPlaceholder(c.projectId)
      && !isPlaceholder(c.vapidKey);
  };

  function getPanel() {
    return document.getElementById('pushNotificationCard');
  }

  function setStatus(text, tone = 'muted') {
    const el = document.getElementById('pushNotificationStatus');
    if (!el) return;
    el.textContent = text;
    el.dataset.tone = tone;
  }

  function setButton(text, disabled = false) {
    const button = document.getElementById('enablePushNotifications');
    if (!button) return;
    button.innerHTML = `<i class="bi ${disabled ? 'bi-check2-circle' : 'bi-bell'}"></i> ${text}`;
    button.disabled = disabled;
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[data-niaga-push-src="${src}"]`);
      if (existing) {
        if (existing.dataset.loaded === 'true') return resolve();
        existing.addEventListener('load', resolve, { once: true });
        existing.addEventListener('error', reject, { once: true });
        return;
      }

      const script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.dataset.niagaPushSrc = src;
      script.addEventListener('load', () => {
        script.dataset.loaded = 'true';
        resolve();
      }, { once: true });
      script.addEventListener('error', () => reject(new Error(`Gagal memuat ${src}`)), { once: true });
      document.head.appendChild(script);
    });
  }

  async function ensureFirebase() {
    if (pushReady && messaging) return true;
    if (!firebaseConfigured()) return false;

    await loadScript(`https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}/firebase-app-compat.js`);
    await loadScript(`https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}/firebase-messaging-compat.js`);

    if (!window.firebase) throw new Error('Firebase SDK belum tersedia.');
    if (!firebase.apps.length) firebase.initializeApp(config());

    messaging = firebase.messaging();
    pushReady = true;
    return true;
  }

  function soundEnabled() {
    return localStorage.getItem(SOUND_KEY) !== 'false';
  }

  function updateSoundUi() {
    const button = document.getElementById('toggleNotificationSound');
    if (!button) return;
    const enabled = soundEnabled();
    button.innerHTML = `<i class="bi ${enabled ? 'bi-volume-up' : 'bi-volume-mute'}"></i> Suara ${enabled ? 'aktif' : 'mati'}`;
    button.setAttribute('aria-pressed', enabled ? 'true' : 'false');
  }

  function playOrderSound() {
    if (!soundEnabled()) return;
    try {
      if (!audio) {
        audio = new Audio(AUDIO_URL);
        audio.preload = 'auto';
        audio.volume = 0.78;
      }
      audio.currentTime = 0;
      const promise = audio.play();
      if (promise?.catch) promise.catch(() => {});
    } catch (_) {}
  }

  function rememberNotification(id) {
    if (!id) return true;
    if (handledIds.has(id)) return false;

    handledIds.add(id);
    if (handledIds.size > 80) {
      handledIds = new Set(Array.from(handledIds).slice(-50));
    }

    // Cross-tab dedupe: seller sering membuka dashboard + pesanan bersamaan.
    // Hanya satu tab yang boleh memainkan toast/sound untuk event yang sama.
    try {
      const now = Date.now();
      const recent = JSON.parse(localStorage.getItem(CROSS_TAB_EVENT_KEY) || '{}');
      Object.keys(recent).forEach(key => {
        if (now - Number(recent[key] || 0) > 120000) delete recent[key];
      });
      if (recent[id] && now - Number(recent[id]) < 30000) return false;
      recent[id] = now;
      const keys = Object.keys(recent);
      if (keys.length > 80) {
        keys.sort((a, b) => Number(recent[a]) - Number(recent[b]));
        keys.slice(0, keys.length - 80).forEach(key => delete recent[key]);
      }
      localStorage.setItem(CROSS_TAB_EVENT_KEY, JSON.stringify(recent));
    } catch (_) {}

    return true;
  }

  function notificationLink(notification) {
    const link = String(notification?.link_url || '/seller/orders').trim();
    if (/^https?:\/\//i.test(link)) return link;
    return link.startsWith('/') ? link : `/${link}`;
  }

  async function showSystemNotification(notification) {
    if (!notification || !('Notification' in window) || Notification.permission !== 'granted') return;

    const title = String(notification.title || 'Notifikasi baru').slice(0, 120);
    const body = String(notification.message || '').slice(0, 500);
    const type = String(notification.type || 'info');
    const id = String(notification.id || `notification_${Date.now()}`);
    const link = notificationLink(notification);
    const options = {
      body,
      icon: '/assets/img/icon-192.png',
      badge: '/assets/img/favicon-32x32.png',
      tag: `niagabio-${id}`,
      renotify: false,
      requireInteraction: type === 'order_new',
      vibrate: type === 'order_new' ? [120, 70, 120] : [100],
      data: { link }
    };

    try {
      if (!serviceWorkerRegistration && 'serviceWorker' in navigator) {
        serviceWorkerRegistration = await navigator.serviceWorker.getRegistration('/')
          || await navigator.serviceWorker.ready;
      }

      if (serviceWorkerRegistration?.showNotification) {
        await serviceWorkerRegistration.showNotification(title, options);
        return;
      }

      if (typeof Notification === 'function') {
        new Notification(title, options);
      }
    } catch (error) {
      console.warn('[NiagaBio] System notification gagal:', error.message);
    }
  }

  function showForegroundNotification(notification, source = 'realtime') {
    if (!notification || !rememberNotification(notification.id)) return;

    const type = String(notification.type || '').toLowerCase();
    const title = notification.title || 'Notifikasi baru';
    const message = notification.message || '';

    if (typeof window.nbToast === 'function') {
      window.nbToast(`${title}${message ? ` — ${message}` : ''}`, type === 'order_new' ? 'success' : 'info');
    }

    if (type === 'order_new') {
      playOrderSound();
      if (navigator.vibrate) navigator.vibrate([120, 70, 120]);
    }

    // Popup sistem Android/browser ketika halaman sedang aktif.
    // Untuk background, FCM service worker menangani popup secara native.
    void showSystemNotification(notification);

    try {
      window.dispatchEvent(new CustomEvent('niagabio:notification', {
        detail: { notification, source }
      }));
    } catch (_) {}

    if (typeof window.NB_NOTIFY_CROSS_TAB === 'function') {
      window.NB_NOTIFY_CROSS_TAB('notification', { detail: { notification, source } });
    }

    if (typeof window.NB_REFRESH_NOTIFICATIONS === 'function') {
      void window.NB_REFRESH_NOTIFICATIONS();
    }
  }

  async function registerRealtime(user) {
    if (!window.NB?.sb || !user?.id) return;

    if (realtimeChannel) {
      try { await NB.sb.removeChannel(realtimeChannel); } catch (_) {}
      realtimeChannel = null;
    }

    currentUserId = user.id;
    realtimeChannel = NB.sb
      .channel(`seller-notifications:${user.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${user.id}`
      }, payload => {
        showForegroundNotification(payload?.new, 'realtime');
      })
      .subscribe(status => {
        if (status === 'SUBSCRIBED') {
          const hint = document.getElementById('pushNotificationHint');
          if (hint && !pushReady) {
            hint.textContent = 'Realtime aktif saat dashboard terbuka. Aktifkan push agar tetap menerima notifikasi saat dashboard ditutup.';
          }
        }
      });
  }

  async function registerPush(user) {
    if (!('Notification' in window) || !('serviceWorker' in navigator)) {
      setStatus('Browser ini belum mendukung push notification.', 'danger');
      return false;
    }

    if (!firebaseConfigured()) {
      setStatus('Firebase belum dikonfigurasi oleh admin.', 'warning');
      return false;
    }

    let permission = Notification.permission;
    if (permission === 'default') permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      setStatus(
        permission === 'denied'
          ? 'Notifikasi diblokir browser. Izinkan dari pengaturan situs.'
          : 'Izin notifikasi belum diberikan.',
        'warning'
      );
      return false;
    }

    const ready = await ensureFirebase();
    if (!ready) throw new Error('Konfigurasi Firebase belum siap.');

    serviceWorkerRegistration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', { scope: '/' });
    await navigator.serviceWorker.ready;

    const token = await messaging.getToken({
      vapidKey: config().vapidKey,
      serviceWorkerRegistration
    });

    if (!token) throw new Error('Token push tidak berhasil dibuat.');

    await NB.registerPushSubscription(token, navigator.platform || 'Browser');
    localStorage.setItem(`${PUSH_KEY_PREFIX}${user.id}`, 'true');
    setStatus('Notifikasi perangkat aktif. Pesanan baru akan dikirim ke HP ini.', 'success');
    setButton('Notifikasi aktif', true);

    if (!foregroundListenerBound) {
      foregroundListenerBound = true;
      messaging.onMessage(payload => {
        const data = payload?.data || {};
        showForegroundNotification({
          id: data.notification_id || `fcm_${Date.now()}`,
          type: data.type || 'info',
          title: data.title || 'Notifikasi baru',
          message: data.body || '',
          link_url: data.link || '/seller/notifications',
          created_at: new Date().toISOString(),
          is_read: false
        }, 'fcm');
      });
    }

    return true;
  }

  function setupUi(user) {
    const panel = getPanel();
    if (!panel) return;

    const enableButton = document.getElementById('enablePushNotifications');
    const testSoundButton = document.getElementById('testNotificationSound');
    const toggleSoundButton = document.getElementById('toggleNotificationSound');

    updateSoundUi();

    toggleSoundButton?.addEventListener('click', () => {
      const next = !soundEnabled();
      localStorage.setItem(SOUND_KEY, String(next));
      updateSoundUi();
      if (next) playOrderSound();
    });

    testSoundButton?.addEventListener('click', () => {
      playOrderSound();
      if (typeof window.nbToast === 'function') nbToast('Suara pesanan NiagaBio diputar.', 'success');
    });

    enableButton?.addEventListener('click', async () => {
      enableButton.disabled = true;
      setStatus('Menyiapkan notifikasi perangkat...', 'muted');
      try {
        const ok = await registerPush(user);
        if (!ok) enableButton.disabled = false;
      } catch (error) {
        console.error('[NiagaBio] Push setup gagal:', error);
        setStatus(error.message || 'Gagal mengaktifkan notifikasi.', 'danger');
        enableButton.disabled = false;
      }
    });

    if (
      'Notification' in window &&
      Notification.permission === 'granted' &&
      localStorage.getItem(`${PUSH_KEY_PREFIX}${user.id}`) === 'true'
    ) {
      setStatus('Notifikasi browser sudah diizinkan. Token perangkat akan diperbarui otomatis saat tersedia.', 'success');
      setButton('Notifikasi aktif', true);
    }
  }

  async function init() {
    if (!window.NB?.currentUser) return;

    const user = await NB.currentUser();
    if (!user) return;

    currentUserId = user.id;
    setupUi(user);
    await registerRealtime(user);

    if ('Notification' in window && Notification.permission === 'granted' && firebaseConfigured()) {
      try {
        await registerPush(user);
      } catch (error) {
        console.warn('[NiagaBio] Auto refresh push token dilewati:', error.message);
      }
    }

    const panel = getPanel();
    if (panel && !firebaseConfigured()) {
      setStatus('Realtime aktif. Push HP belum siap karena konfigurasi Firebase belum diisi.', 'warning');
    }
  }

  window.NB_PUSH = {
    init,
    playOrderSound,
    enable: async () => {
      const user = await NB.currentUser();
      return user ? registerPush(user) : false;
    },
    getCurrentUserId: () => currentUserId
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { void init(); }, { once: true });
  } else {
    void init();
  }
})();
