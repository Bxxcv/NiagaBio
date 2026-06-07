# Setup Supabase NiagaBio dari Nol

## 1. Buat / pakai project Supabase
Buka Supabase Dashboard.

## 2. Auth Email setting
Masuk:

Authentication > Providers > Email

Set:

- Email provider: ON
- Confirm email: OFF untuk testing
- Secure email change: OFF untuk testing

Jangan matikan Email provider. Yang dimatikan hanya Confirm email.

## 3. Jalankan schema
Masuk:

SQL Editor > New query

Copy semua isi file:

supabase/01_schema_clean_run_this.sql

Lalu Run.

Kalau sukses, tabel yang dibuat:

- profiles
- products
- custom_links
- social_links
- gallery
- checkout_settings
- orders
- app_settings
- storage bucket niagabio

## 4. Ambil API config
Masuk:

Project Settings > API

Copy:

- Project URL
- anon public key

Buka file:

assets/js/config.js

Ganti:

SUPABASE_URL: "PASTE_SUPABASE_PROJECT_URL_HERE"
SUPABASE_ANON_KEY: "PASTE_SUPABASE_ANON_KEY_HERE"
DEMO_MODE: false

ADMIN_EMAIL default sudah:

unrageunrage@gmail.com

## 5. Buat admin pertama
Cara paling aman:

Authentication > Users > Add user > Create new user

Isi:

- Email: unrageunrage@gmail.com
- Password: password baru kamu
- Auto Confirm User: ON

## 6. Bootstrap admin
SQL Editor > New query

Copy semua isi file:

supabase/02_bootstrap_admin_after_signup.sql

Run.

Hasil bawah harus:

- role = admin
- plan = premium
- status = active

## 7. Upload ke GitHub dan deploy Vercel
Upload semua file.

Deploy ke Vercel.

Clear site data browser / buka incognito.

## 8. Tes wajib

1. Login admin: harus masuk `/admin`
2. Register user biasa: harus masuk `/dashboard`
3. User biasa buka `/admin`: harus ditolak
4. Free max 5 produk
5. Free max 3 social
6. Free tidak bisa gallery
7. Admin bisa upgrade user premium
8. Premium bisa gallery + QRIS/manual checkout
9. Order dari public page masuk pending
10. Admin/toko bisa menandai pesanan selesai atau batal

## Manual yang wajib diganti

File: assets/js/config.js

- SUPABASE_URL
- SUPABASE_ANON_KEY
- DEMO_MODE jadi false
- ADMIN_EMAIL kalau email admin diganti

File: supabase/02_bootstrap_admin_after_signup.sql

- Ganti unrageunrage@gmail.com kalau email admin berubah.

Admin panel:

- Ubah admin_whatsapp dari `/admin` setelah login admin.
- Ubah premium_price dari `/admin` setelah login admin.


## Patch v13 tambahan

Kalau database sudah pernah dibuat sebelum v13, jalankan juga file:

```txt
supabase/04_upgrade_requests_admin_tools.sql
```

Kalau kamu setup dari nol memakai `supabase/01_schema_clean_run_this.sql` versi v13, patch v13 sudah ikut di bagian akhir schema.


## Patch tambahan v21

Kalau memakai database yang sudah jalan, jalankan file ini sekali di SQL Editor supaya tombol Reset Rekap aktif:

```txt
supabase/05_reset_sales_recap.sql
```
