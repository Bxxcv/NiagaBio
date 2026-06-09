# NiagaBio v26 - In-App Notification

Fitur ini menambahkan notifikasi di dalam website, bukan push notification HP.

## Yang aktif
- Seller mendapat notifikasi saat ada order baru.
- Admin Master mendapat notifikasi saat ada request Premium baru.
- User mendapat notifikasi saat upgrade Premium disetujui/ditolak.
- Badge angka muncul di sidebar.
- Halaman `/notifications` menampilkan semua notifikasi.

## Wajib run SQL
Jalankan sekali di Supabase SQL Editor:

```sql
supabase/07_in_app_notifications.sql
```

Tidak perlu APK, PWA, atau install aplikasi. Notifikasi muncul saat user/admin membuka website.
