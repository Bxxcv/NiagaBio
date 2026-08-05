(function () {
  'use strict';

  const FIREBASE_SDK_VERSION = '12.17.1';
  const SOUND_KEY = 'niagabio_notification_sound_enabled';
  const PUSH_KEY_PREFIX = 'niagabio_push_enabled_';
  const AUDIO_URL = '/assets/audio/niapulse-order.mp3';
  let messaging = null;
  let pushReady = false;
  let realtimeChannel = null;
  let currentUserId = null;
  let handledIds = new Set();
  let audio = null;
  let foregroundListenerBound = false;

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
      script.addEventListener('load', () => { script.dataset.loaded = 'true'; resolve(); }, { once: true });
      script.addEventListener('error', () => reject(new Error(`Gagal memuat ${src}`)), { once: true });
      document.head.appendChild(script);
    });
  }

  async function ensureFirebase() {
    if (pushReady && messaging) return true;
    if (!firebaseConfigured()) return false;
    await loadScript('/assets/js/firebase-config.js');
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
    if (!id) return false;
    if (handledIds.has(id)) return false;
    handledIds.add(id);
    if (handledIds.size > 60) handledIds = new Set(Array.from(handledIds).slice(-40));
    return true;
  }

  function notificationLink(notification) {
    const link = String(notification?.link_url || 'orders').trim();
    if (/^https?:\/\//i.test(link)) return link;
    return link.startsWith('/') ? link : `/${link}`;
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

    try {
      window.dispatchEvent(new CustomEvent('niagabio:notification', {
        detail: { notification, source }
      }));
    } catch (_) {}

    if (window.NB_REFRESH_NOTIFICATIONS) window.NB_REFRESH_NOTIFICATIONS();
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
          if (hint && !pushReady) hint.textContent = 'Realtime aktif saat dashboard terbuka. Aktifkan push agar tetap menerima notifikasi saat dashboard ditutup.';
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
      setStatus(permission === 'denied' ? 'Notifikasi diblokir browser. Izinkan dari pengaturan situs.' : 'Izin notifikasi belum diberikan.', 'warning');
      return false;
    }

    await ensureFirebase();
    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', { scope: '/' });
    const token = await messaging.getToken({
      vapidKey: config().vapidKey,
      serviceWorkerRegistration: registration
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
          link_url: data.link || 'notifications',
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
      localStorage.setItem(SOUND_KEY, String(!soundEnabled()));
      updateSoundUi();
      if (soundEnabled()) playOrderSound();
    });

    testSoundButton?.addEventListener('click', () => {
      playOrderSound();
      nbToast('Suara pesanan NiagaBio diputar.', 'success');
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

    if ('Notification' in window && Notification.permission === 'granted' && localStorage.getItem(`${PUSH_KEY_PREFIX}${user.id}`) === 'true') {
      setStatus('Notifikasi browser sudah diizinkan. Tekan aktifkan kembali jika token perangkat perlu diperbarui.', 'success');
      setButton('Notifikasi aktif', true);
    }
  }

  async function init() {
    if (!window.NB?.currentUser) return;
    const user = await NB.currentUser();
    if (!user) return;

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
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
