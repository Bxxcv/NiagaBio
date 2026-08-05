/* NiagaBio FCM background service worker. Keep public Firebase config only. */
importScripts('https://www.gstatic.com/firebasejs/12.17.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.17.1/firebase-messaging-compat.js');
importScripts('/assets/js/firebase-config.js');

const config = self.NIAGABIO_FIREBASE_CONFIG || {};
const configured = Boolean(
  config.apiKey &&
  config.projectId &&
  config.messagingSenderId &&
  config.appId &&
  config.vapidKey &&
  !/YOUR_|_HERE/i.test(String(config.apiKey)) &&
  !/YOUR_|_HERE/i.test(String(config.projectId))
);

if (configured) {
  firebase.initializeApp(config);
  const messaging = firebase.messaging();

  messaging.onBackgroundMessage(payload => {
    const data = payload?.data || {};
    const title = data.title || 'Pesanan baru masuk';
    const body = data.body || 'Ada aktivitas baru di NiagaBio.';
    const rawLink = String(data.link || '/orders').trim();
    const link = rawLink.startsWith('/') ? rawLink : `/${rawLink.replace(/^\/+/, '')}`;
    const tag = `niagabio-${data.notification_id || Date.now()}`;

    return self.registration.showNotification(title, {
      body,
      icon: '/assets/img/icon-192.png',
      badge: '/assets/img/favicon-32x32.png',
      tag,
      renotify: true,
      requireInteraction: data.type === 'order_new',
      vibrate: [120, 70, 120],
      data: { link }
    });
  });
}

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const link = event.notification?.data?.link || '/orders';
  const destination = new URL(link, self.location.origin).href;

  event.waitUntil((async () => {
    const clientsList = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of clientsList) {
      if ('focus' in client) {
        await client.focus();
        if ('navigate' in client && client.url !== destination) {
          try { await client.navigate(destination); } catch (_) {}
        }
        return;
      }
    }
    if (clients.openWindow) await clients.openWindow(destination);
  })());
});
