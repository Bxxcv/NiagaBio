# NiagaBio — Realtime + Push Notifications

> Updated: 2026-08-06 — badge realtime + foreground system popup + SQL 21 webhook bridge.

```text
orders INSERT
  -> notify_order_insert()
  -> notifications INSERT
      ├─ Supabase Realtime
      │    -> notification-runtime.js (unread badge)
      │    -> push-notifications.js (toast + NiaPulse + system popup)
      │
      └─ SQL 21 trigger / pg_net
           -> /api/send-push
           -> FCM HTTP v1
           -> firebase-messaging-sw.js
           -> Android/browser system notification
```

`common.js` tidak diperlukan untuk menjalankan push notification. Sistem badge memakai `assets/js/notification-runtime.js` sehingga tidak mengubah customisasi `common.js` pengguna.

## File penting

- `assets/js/notification-runtime.js` — badge unread realtime di sidebar + topbar.
- `assets/js/push-notifications.js` — Supabase Realtime, foreground system popup, NiaPulse, FCM token.
- `firebase-messaging-sw.js` — background push + click routing.
- `assets/js/firebase-config.js` — Firebase Web App config + VAPID public key.
- `api/send-push.js` — server-side FCM HTTP v1 sender.
- `supabase/20_push_notifications.sql` — tabel token + RPC + Realtime publication.
- `supabase/21_push_webhook.sql` — trigger database -> Vercel `/api/send-push`.
- `assets/audio/niapulse-order.mp3` — sound order baru untuk foreground.

## Vercel Environment Variables

Set di **Production**:

```text
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
FCM_PROJECT_ID
FCM_CLIENT_EMAIL
FCM_PRIVATE_KEY
PUSH_WEBHOOK_SECRET
```

`SUPABASE_SERVICE_ROLE_KEY` dan `FCM_PRIVATE_KEY` hanya boleh ada di Vercel server environment. Jangan masukkan ke frontend, GitHub, SQL public file, atau Firebase Web App config.

## Firebase Web App

Isi `assets/js/firebase-config.js` dengan **Web App config publik** dan **Web Push VAPID public key**. Jangan masukkan service-account private key di file ini.

## Supabase

1. Jalankan `supabase/20_push_notifications.sql`.
2. Pastikan hasil query menunjukkan:
   - `push_subscriptions_exists = true`
   - `register_rpc_exists = true`
   - `notifications_in_realtime = true`
3. Buka `supabase/21_push_webhook.sql`.
4. Ganti hanya:
   ```sql
   PUSH_WEBHOOK_SECRET_DI_SINI
   ```
   dengan nilai yang sama persis dengan Vercel `PUSH_WEBHOOK_SECRET`. SQL 21 menyimpan secret tersebut di Supabase Vault dan hanya membaca nilai terdekripsi ketika trigger berjalan.
5. Jalankan SQL 21 satu kali. Jika secret sudah pernah dibuat di Vault, jangan buat secret kedua dengan nama berbeda; gunakan nama `niagabio_push_webhook_secret`.
6. Hasil query terakhir seharusnya menunjukkan:
   - `notifications_exists = true`
   - `push_subscriptions_exists = true`
   - `webhook_trigger_exists = true`
   - `vault_secret_exists = true`

## Dashboard Seller

1. Login ke dashboard.
2. Tekan **Aktifkan notifikasi**.
3. Izinkan notifikasi browser/Android.
4. Tekan **Tes suara** untuk memastikan NiaPulse dapat diputar.
5. Pastikan status berubah menjadi **Notifikasi perangkat aktif**.

Setelah izin aktif:

- Saat dashboard terbuka: Realtime -> toast -> badge -> NiaPulse -> system notification.
- Saat dashboard ditutup/background: SQL trigger -> Vercel -> FCM -> service worker -> system notification.

## Badge Notifikasi

`notification-runtime.js` menambahkan badge angka otomatis ke:

- menu sidebar `Notifikasi`;
- ikon lonceng topbar.

Perubahan unread count dipicu langsung oleh event `niagabio:notification`, `niagabio:notification-read`, dan `niagabio:notifications-cleared`, lalu tetap direfresh saat tab kembali aktif.

## Suara

NiaPulse adalah sound original NiagaBio. Pada foreground, file ini diputar untuk `order_new` jika setting **Suara aktif**.

Pada background, web push mengikuti kemampuan browser/Android. Suara sistem tidak dapat dipaksa memakai file MP3 custom melalui Web Notification API.

## Tes end-to-end

### Skenario A — Dashboard terbuka

1. HP A login sebagai seller.
2. HP A buka Dashboard.
3. Pastikan menu `Notifikasi` menampilkan badge saat ada unread.
4. HP B membuat order publik.
5. Expected:
   - toast muncul;
   - NiaPulse diputar;
   - getar jika didukung;
   - system notification muncul;
   - badge unread bertambah +1;
   - halaman Notifikasi ter-update tanpa reload manual.

### Skenario B — Dashboard ditutup

1. HP A sudah mengaktifkan push.
2. Tutup/minimize dashboard.
3. HP B membuat order.
4. Expected:
   - SQL 21 trigger berjalan;
   - `/api/send-push` menerima request 200;
   - FCM mengirim push;
   - service worker menampilkan popup sistem;
   - tap notification membuka `/orders`.

## Troubleshooting

### Status Firebase belum siap

Periksa `assets/js/firebase-config.js`, lalu redeploy.

### Badge tidak muncul

Periksa:

- `assets/js/notification-runtime.js` termuat di halaman protected;
- user mempunyai `notifications` unread;
- RLS memungkinkan user membaca notifikasi miliknya.

### Dashboard terbuka tetapi tidak ada system popup

Pastikan:

- izin browser = Granted;
- push sudah diaktifkan setidaknya satu kali;
- service worker `/firebase-messaging-sw.js` terdaftar;
- browser mengizinkan system notifications.

### Dashboard tertutup tetapi tidak ada push

Periksa:

- `PUSH_WEBHOOK_SECRET` Vercel;
- SQL 21 sudah dijalankan;
- `webhook_trigger_exists = true`;
- Vercel Function Logs `/api/send-push`;
- FCM service account credential;
- `push_subscriptions.is_active = true`.

### Push terkirim ke device lama

Token perangkat dapat berjumlah lebih dari satu per seller. Token invalid akan dinonaktifkan oleh `/api/send-push` jika FCM mengembalikan error `UNREGISTERED`.
