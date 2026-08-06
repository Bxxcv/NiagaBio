# NiagaBio — Realtime + Push Notifications (FINAL)

Updated: 2026-08-06

## Arsitektur

```text
Buyer membuat order
  -> public.create_public_order()
  -> orders INSERT
  -> notify_order_insert()
  -> notifications INSERT
       |
       +--> Supabase Realtime
       |     -> badge unread realtime
       |     -> toast
       |     -> NiaPulse
       |     -> system notification saat dashboard aktif
       |
       +--> pg_net trigger
             -> POST /api/send-push { notification_id }
             -> Vercel membaca notification + push_subscriptions
             -> FCM HTTP v1
             -> firebase-messaging-sw.js
             -> system notification saat background
```

## Penting

Versi final **tidak lagi memakai `PUSH_WEBHOOK_SECRET` atau Supabase Vault** untuk bridge webhook.

Webhook hanya mengirim `notification_id`. Endpoint Vercel kemudian mengambil record notifikasi secara server-side menggunakan `SUPABASE_SERVICE_ROLE_KEY`, melakukan idempotency melalui `push_delivery_log`, lalu mengirim FCM ke token perangkat seller.

Ini membuat setup lebih sederhana dan menghindari error yang sebelumnya terjadi karena secret Vercel dan secret Vault tidak sinkron.

## File penting

- `assets/js/notification-runtime.js` — badge unread realtime di sidebar + topbar.
- `assets/js/push-notifications.js` — Supabase Realtime, foreground system popup, NiaPulse, registrasi FCM token.
- `firebase-messaging-sw.js` — background push + click routing.
- `assets/js/firebase-config.js` — Firebase Web App config + VAPID public key.
- `api/send-push.js` — server-side FCM HTTP v1 sender + idempotency.
- `supabase/22_push_notifications_final.sql` — patch final untuk notification trigger, Realtime, push token, delivery log, dan pg_net bridge.
- `assets/audio/niapulse-order.mp3` — sound order baru untuk foreground.

`common.js` tidak diperlukan untuk menjalankan push. Custom `common.js` Anda tetap dipertahankan dan overlay mobile bukan button `Tutup menu`.

## SETUP SINGKAT

### 1. Vercel Environment Variables

Pastikan **Production** memiliki:

```text
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
FCM_PROJECT_ID
FCM_CLIENT_EMAIL
FCM_PRIVATE_KEY
```

Tidak perlu menambahkan `PUSH_WEBHOOK_SECRET` untuk sistem final ini. Jika variable lama masih ada, boleh dibiarkan atau dihapus; kode final tidak menggunakannya.

`SUPABASE_SERVICE_ROLE_KEY` dan `FCM_PRIVATE_KEY` hanya untuk server Vercel. Jangan taruh di frontend atau `firebase-config.js`.

### 2. Firebase

File `assets/js/firebase-config.js` harus berisi konfigurasi **Firebase Web App public** dan **Web Push VAPID public key**.

Tidak boleh berisi:

- service account private key;
- `FCM_PRIVATE_KEY`;
- `SUPABASE_SERVICE_ROLE_KEY`.

### 3. Supabase — jalankan SATU SQL saja

Buka Supabase SQL Editor dan jalankan:

```text
supabase/22_push_notifications_final.sql
```

Tidak perlu menjalankan SQL 20 atau SQL 21 untuk setup baru. SQL final ini mengulangi bagian yang dibutuhkan secara idempotent dan juga memperbaiki trigger lama dari SQL 21.

Hasil terakhir yang diharapkan:

```text
notifications_exists = true
push_subscriptions_exists = true
push_delivery_log_exists = true
order_notification_trigger_exists = true
push_webhook_trigger_exists = true
notifications_in_realtime = true
```

### 4. Deploy ulang Vercel

Setelah SQL final dijalankan dan env Vercel benar:

```text
GitHub push / Redeploy Production
```

### 5. Aktifkan di HP seller

Login sebagai seller -> Dashboard -> **Aktifkan notifikasi** -> Izinkan.

Tekan **Tes suara** untuk mengecek NiaPulse.

## Hasil yang diharapkan

### Dashboard seller terbuka

```text
Order baru
-> notifications INSERT
-> Realtime
-> popup sistem
-> toast
-> NiaPulse
-> badge +1
```

### Dashboard seller ditutup / background

```text
Order baru
-> notifications INSERT
-> pg_net
-> /api/send-push
-> FCM
-> system notification Android/browser
```

## Badge Notifikasi

`notification-runtime.js` menambahkan badge angka otomatis ke:

- menu sidebar `Notifikasi`;
- ikon lonceng topbar.

Badge diperbarui melalui event:

- `niagabio:notification`
- `niagabio:notification-read`
- `niagabio:notifications-cleared`

Badge juga refresh saat tab kembali aktif dan melalui polling fallback.

## Idempotency

`push_delivery_log` mencegah satu `notification_id` diproses berkali-kali secara normal.

Status:

```text
sending
sent
failed
no_device
```

Token FCM yang sudah tidak valid akan dinonaktifkan ketika FCM mengembalikan error `UNREGISTERED` atau `SENDER_ID_MISMATCH`.

## Tes 2 HP

### Skenario A — Dashboard terbuka

1. HP A login seller.
2. Tekan Aktifkan notifikasi.
3. Pastikan permission = Granted.
4. HP B membuat order baru.
5. HP A harus menerima popup sistem, toast, sound NiaPulse, dan badge unread +1.

### Skenario B — Dashboard background

1. HP A sudah mengaktifkan push.
2. Minimize/tutup dashboard.
3. HP B membuat order baru.
4. HP A harus menerima push notification dari FCM.

## Troubleshooting cepat

### Status Firebase belum siap

Periksa:

```text
assets/js/firebase-config.js
```

Pastikan Web App config + VAPID public key benar, lalu redeploy.

### Tidak ada badge

Pastikan SQL final sudah dijalankan dan seller memang memiliki row unread pada `public.notifications`.

### Tidak ada popup saat dashboard terbuka

Pastikan:

- permission Notification = Granted;
- dashboard sudah dimuat ulang setelah permission;
- service worker terdaftar;
- Realtime `public.notifications` aktif.

### Tidak ada push saat background

Periksa:

- 5 env Vercel server sudah benar;
- `push_subscriptions` memiliki token aktif;
- SQL `22_push_notifications_final.sql` berhasil;
- `push_webhook_trigger_exists = true`;
- Vercel Function Logs pada `/api/send-push`;
- Firebase service account punya izin mengirim FCM.

### Tes manual endpoint

Endpoint menerima:

```json
{
  "notification_id": "UUID-NOTIFIKASI"
}
```

Gunakan hanya untuk debugging server-side. Endpoint mengambil isi notifikasi sendiri dari Supabase dan tidak menerima `user_id`, `title`, atau `device_token` dari client sebagai sumber kebenaran.
