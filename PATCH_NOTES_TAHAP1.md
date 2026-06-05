# NiagaBio Patch Tahap 1+2 Aman

Patch ini fokus memperkuat fondasi agar logic lama tetap jalan, tapi lebih aman untuk produksi.

## Yang diperbaiki

- `supabase/schema.sql` diganti menjadi schema production foundation yang idempotent.
- `is_admin()` dibuat `SECURITY DEFINER` agar tidak recursion RLS.
- User biasa tidak bisa insert/update field system: `role`, `plan`, `status`, `plan_end_date`.
- Ditambahkan `app_settings` untuk maintenance, register, harga premium, dan WhatsApp admin.
- Admin panel diperkuat:
  - hanya role admin yang bisa buka `admin.html`
  - kelola user: set premium/free, blokir/unblokir
  - kelola order: paid/cancelled
  - setting platform: maintenance/register/harga/WhatsApp
- Order publik tidak bisa memalsukan produk, harga, status paid, atau paid_at.
- Limit Free/Premium dikunci juga di database:
  - Free max 5 produk
  - Premium max 500 produk
  - Free max 5 custom link
  - Free max 3 social link
  - Free tidak bisa gallery
  - Premium max 50 gallery
  - Free tidak bisa QRIS
- `public-page.js` sekarang menampilkan gallery untuk user Premium.
- `maintenance.html` diperbaiki dan memakai `app_settings`.
- Ditambahkan bucket/policy storage `niagabio` untuk gambar produk, gallery, QRIS, avatar, dan proofs.
- Admin link disembunyikan dari user biasa.
- `profile.js` dan `auth.js` tidak lagi mengandalkan role admin dari frontend saat Supabase mode.

## Cara pakai aman

1. Deploy source code ini ke GitHub/Vercel.
2. Jangan ubah `DEMO_MODE` dulu kalau schema Supabase belum dijalankan.
3. Buka Supabase SQL Editor.
4. Jalankan `supabase/schema.sql` sampai sukses.
5. Register/login akun admin memakai email `unrageunrage@gmail.com`.
6. Jalankan bootstrap admin ini di SQL Editor:

```sql
update public.profiles
set role = 'admin', plan = 'premium', status = 'active', plan_end_date = '2099-12-31T00:00:00Z'
where email = 'unrageunrage@gmail.com';
```

7. Bucket storage `niagabio` sudah dibuat oleh SQL jika Supabase Storage tersedia. Kalau gagal, buat manual bucket public bernama `niagabio`, lalu jalankan ulang bagian STORAGE di schema.
8. Setelah semua tes aman, baru ubah di `assets/js/config.js`:

```js
DEMO_MODE: false
```

## Checklist test

- Register user baru => otomatis Free/User/Active.
- User biasa tidak melihat menu Admin.
- User biasa tidak bisa buka `admin.html`.
- Admin bisa buka `admin.html`.
- Admin bisa set Premium/Free.
- Admin bisa blokir/unblokir user.
- User blocked tidak bisa update produk/link/gallery/checkout.
- Free mentok 5 produk, 3 sosial, tidak bisa gallery/QRIS.
- Premium bisa gallery dan QRIS.
- Public page tampil.
- Checkout QRIS membuat order pending.
- Seller/admin bisa set order paid.
- Maintenance ON mengarahkan user biasa ke `maintenance.html`, login admin tetap bisa dibuka.
