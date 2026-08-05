# NiagaBio — Setup Notifikasi Realtime + Push HP

Implementasi ini memakai:

- Supabase `notifications` sebagai sumber event.
- Supabase Realtime untuk notifikasi instan saat seller sedang membuka dashboard.
- Firebase Cloud Messaging (FCM) untuk push ke HP saat dashboard/background.
- Vercel Function `/api/send-push` sebagai pengirim FCM server-side.
- Sound original `NiaPulse` (`assets/audio/niapulse-order.mp3`) untuk notifikasi pesanan saat aplikasi sedang terbuka.

> Catatan: Web Push tidak memberi kontrol universal atas suara notifikasi sistem saat aplikasi berada di background. Suara `NiaPulse` digunakan di foreground. Saat background, Android/browser yang menentukan suara dan perilaku notifikasi sistem.

## 1. Jalankan SQL Supabase

Jalankan:

```text
supabase/20_push_notifications.sql
```

Pastikan hasil verifikasi terakhir menunjukkan:

```text
push_subscriptions_exists = true
register_rpc_exists = true
notifications_in_realtime = true
```

Jika `notifications_in_realtime = false`, buka Supabase Dashboard → Database → Replication/Realtime → aktifkan tabel `public.notifications`.

## 2. Buat Firebase Web App

Di Firebase Console:

1. Buat project baru atau gunakan project Firebase khusus NiagaBio Push.
2. Tambahkan Web App.
3. Aktifkan Cloud Messaging.
4. Pada Web Push certificates, buat/generate VAPID key pair.
5. Catat Firebase Web App config.
6. Buka Service Accounts dan buat private key service account. File JSON private key **jangan** dimasukkan ke GitHub.

Firebase Web App config dan public VAPID key boleh berada di frontend. Service account private key hanya boleh berada di Vercel Environment Variables.

## 3. Isi `assets/js/firebase-config.js`

Ganti placeholder:

```js
self.NIAGABIO_FIREBASE_CONFIG = {
  apiKey: '...',
  authDomain: '...',
  projectId: '...',
  storageBucket: '...',
  messagingSenderId: '...',
  appId: '...',
  vapidKey: '...'
};
```

Commit file ini ke GitHub. Nilai ini adalah konfigurasi client Firebase, bukan service-account secret.

## 4. Tambahkan Vercel Environment Variables

Set pada Vercel Project → Settings → Environment Variables:

```text
SUPABASE_URL=https://mhybmqcfswljxvgtmuhf.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...

FCM_PROJECT_ID=...
FCM_CLIENT_EMAIL=...
FCM_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n
PUSH_WEBHOOK_SECRET=buat-rahasia-panjang-acak-sendiri
```

`SUPABASE_SERVICE_ROLE_KEY`, `FCM_CLIENT_EMAIL`, `FCM_PRIVATE_KEY`, dan `PUSH_WEBHOOK_SECRET` **tidak boleh** dimasukkan ke JavaScript frontend atau repository.

## 5. Deploy Vercel

Push ke GitHub → tunggu Vercel deploy. Endpoint yang digunakan:

```text
https://niaga-bio.vercel.app/api/send-push
```

## 6. Buat Supabase Database Webhook

Supabase Dashboard → Database → Webhooks → Create Webhook.

Gunakan:

```text
Name       : niagabio_push_notifications
Table      : public.notifications
Event      : INSERT
Method     : POST
URL        : https://niaga-bio.vercel.app/api/send-push
```

Tambahkan custom header:

```text
Name   : x-push-webhook-secret
Value  : sama persis dengan PUSH_WEBHOOK_SECRET di Vercel
```

Payload webhook biarkan default Supabase. Endpoint membaca `record` dari payload.

## 7. Aktifkan dari HP seller

1. Login sebagai seller.
2. Buka Dashboard.
3. Tekan `Aktifkan notifikasi`.
4. Izinkan notifikasi browser.
5. Tekan `Tes suara` untuk memastikan audio dapat diputar.
6. Biarkan dashboard terbuka lalu buat order dari perangkat lain.

Hasil yang diharapkan saat dashboard terbuka:

```text
Order masuk
→ notifications INSERT
→ Supabase Realtime
→ toast NiagaBio
→ suara NiaPulse
→ badge notifikasi diperbarui
```

Saat dashboard ditutup/background:

```text
Order masuk
→ notifications INSERT
→ Supabase Database Webhook
→ /api/send-push
→ FCM HTTP v1
→ push notification ke HP
```

## 8. Uji end-to-end

### Test A — Realtime

- Seller buka Dashboard.
- Buyer membuat order.
- Seller harus menerima toast dan suara NiaPulse.

### Test B — Push background

- Seller izinkan notifikasi.
- Tutup dashboard atau pindahkan ke background.
- Buyer membuat order.
- HP seller harus menerima push.

### Test C — Multi-device

- Login seller di HP dan laptop.
- Aktifkan notifikasi pada keduanya.
- Buat satu order.
- Keduanya harus menerima push aktif.

### Test D — Token invalid

Jika FCM mengembalikan error `UNREGISTERED`, backend akan menonaktifkan token perangkat tersebut di `push_subscriptions`.

## 9. Sound `NiaPulse`

Sound dibuat khusus untuk NiagaBio: chime tiga nada singkat, ringan, dan mudah dikenali tanpa meniru sound GoPay, Shopee, atau DANA.

File:

```text
assets/audio/niapulse-order.mp3
assets/audio/niapulse-order.wav
```

Gunakan MP3 di browser. WAV disediakan sebagai source lossless.

## 10. Catatan iPhone/iPad

Untuk iOS/iPadOS, pengujian Web Push perlu dilakukan dari Home Screen Web App dan izin notifikasi harus diberikan setelah interaksi pengguna. Jangan menjadikan fitur ini bergantung pada autoplay audio; suara sistem background tetap dikontrol oleh platform/browser.

## 11. Checklist keamanan

- [ ] Service account JSON tidak pernah di-commit.
- [ ] `SUPABASE_SERVICE_ROLE_KEY` hanya di Vercel env.
- [ ] `FCM_PRIVATE_KEY` hanya di Vercel env.
- [ ] Webhook memiliki `x-push-webhook-secret`.
- [ ] `push_subscriptions` tidak diberi direct SELECT/INSERT ke client.
- [ ] Registrasi token hanya melalui RPC authenticated.
- [ ] `notifications` aktif di Realtime.
- [ ] Push endpoint tidak menerima request tanpa webhook secret.
