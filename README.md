# NiagaBio

NiagaBio adalah website **link bio + mini katalog + checkout QRIS manual** untuk seller kecil, UMKM, jasa, produk digital, dan toko online yang ingin punya satu halaman toko rapi tanpa ribet.

Project ini dibuat dengan stack ringan supaya mudah diedit dari HP dan mudah dideploy ke Vercel.

## Demo dan route utama

- Landing page: `/`
- Login: `/login`
- Register: `/register`
- Dashboard seller: `/dashboard`
- Admin Master owner: `/admin`
- Halaman toko publik: `/u?username=demo-account`
- Checkout publik: `/checkout?username=demo-account&product=...`
- Rekap pesanan seller: `/orders`
- Notifikasi: `/notifications`

## Fitur utama

### Untuk seller/user

- Link bio toko.
- Profil toko dengan logo, bio, WhatsApp, dan username public.
- Katalog produk.
- Link custom untuk WhatsApp, Instagram, Shopee, Tokopedia, TikTok, dan link lain.
- Social link.
- Gallery untuk Premium.
- Template toko Free dan Premium.
- Checkout QRIS manual.
- Upload bukti pembayaran.
- Rekap pesanan dan omset.
- Export CSV rekap.
- Notifikasi di dalam website.

### Untuk owner/admin master

- Dashboard Admin Master.
- Kelola user Free/Premium/Blocked/Deleted.
- Approve/reject request Premium.
- Setting harga Premium.
- Setting QRIS Premium.
- Maintenance mode.
- Register lock.
- Laporan platform.
- Export CSV user/request.
- Soft delete user.

### Keamanan

- Supabase RLS.
- Admin role dari database, bukan dari frontend.
- User biasa tidak boleh ubah `role`, `plan`, `status`, dan `plan_end_date`.
- Upload file dibatasi JPG, JPEG, PNG, WEBP maksimal 3 MB.
- Path storage user-scoped.
- Sanitizer URL dan image URL di frontend.
- Proteksi dasar XSS.
- Security headers Vercel.
- SQL hardening bertahap sampai `08_security_reaudit_final.sql`.

## Stack

- HTML
- CSS
- Vanilla JavaScript
- Bootstrap 5
- Bootstrap Icons
- Supabase Auth
- Supabase Database/Postgres
- Supabase Storage
- Vercel static hosting

Tidak memakai React, Next.js, build tool berat, atau backend custom.

## Struktur folder

```txt
NiagaBio-main/
├── index.html                     # Landing page
├── login.html                     # Login
├── register.html                  # Register
├── dashboard.html                 # Dashboard seller
├── admin.html                     # Admin Master owner
├── u.html                         # Public toko
├── checkout.html                  # Checkout pembeli
├── orders.html                    # Pesanan dan rekap seller
├── notifications.html             # Notifikasi in-app
├── privacy.html                   # Privacy policy
├── terms.html                     # Terms
├── refund.html                    # Kebijakan pembayaran/refund
├── assets/
│   ├── css/
│   │   ├── main.css               # Style dashboard/admin/public
│   │   └── landing.css            # Style landing page
│   ├── js/
│   │   ├── config.js              # Config Supabase
│   │   ├── supabase-client.js     # Wrapper Supabase + helper security
│   │   ├── common.js              # Guard umum/sidebar/notifikasi
│   │   ├── admin.js               # Admin Master
│   │   ├── dashboard.js           # Dashboard seller
│   │   ├── public-page.js         # Render toko publik
│   │   ├── checkout.js            # Checkout pembeli
│   │   ├── orders.js              # Pesanan/rekap seller
│   │   └── ...
│   └── img/
├── supabase/
│   ├── 01_schema_clean_run_this.sql
│   ├── 02_bootstrap_admin_after_signup.sql
│   ├── 03_fix_theme_setter.sql
│   ├── 04_upgrade_requests_admin_tools.sql
│   ├── 05_reset_sales_recap.sql
│   ├── 06_security_hardening.sql
│   ├── 07_in_app_notifications.sql
│   └── 08_security_reaudit_final.sql
├── robots.txt
├── sitemap.xml
├── site.webmanifest
├── vercel.json
├── DESAIN.md
├── ROADMAP.md
├── SETUP_SUPABASE_DARI_NOL.md
├── PRODUCTION_CHECKLIST.md
└── SECURITY_REAUDIT_V31.md
```

## Setup cepat dari nol

### 1. Buat project Supabase

Buat project baru di Supabase, lalu masuk ke SQL Editor.

### 2. Jalankan schema utama

Jalankan semua isi file:

```txt
supabase/01_schema_clean_run_this.sql
```

File ini sudah menyertakan schema utama dan patch security final.

### 3. Setting Auth Supabase

Untuk testing awal:

```txt
Authentication > Providers > Email
- Email provider: ON
- Confirm email: OFF
```

Jangan matikan Email provider.

### 4. Buat akun admin pertama

Di Supabase:

```txt
Authentication > Users > Add user
```

Buat user dengan email owner. Setelah itu jalankan:

```txt
supabase/02_bootstrap_admin_after_signup.sql
```

Pastikan hasilnya:

```txt
role = admin
plan = premium
status = active
```

### 5. Edit config

Buka:

```txt
assets/js/config.js
```

Isi:

```js
window.NIAGABIO_CONFIG = {
  SUPABASE_URL: "https://project-kamu.supabase.co",
  SUPABASE_ANON_KEY: "anon_public_key_kamu",
  ADMIN_EMAIL: "email-admin-kamu@example.com",
  BRAND_NAME: "NiagaBio",
  PREMIUM_PRICE: 80000,
  DEMO_MODE: false
};
```

Penting:

```txt
Jangan pernah memasukkan service_role key ke frontend.
```

### 6. Deploy ke Vercel

Upload repo ke GitHub, lalu deploy ke Vercel. Pastikan `vercel.json` tetap ada agar clean URL seperti `/admin`, `/login`, dan `/dashboard` berjalan.

## SQL patch tambahan

Untuk database lama, patch bisa dijalankan bertahap jika belum pernah dijalankan:

```txt
03_fix_theme_setter.sql
04_upgrade_requests_admin_tools.sql
05_reset_sales_recap.sql
06_security_hardening.sql
07_in_app_notifications.sql
08_security_reaudit_final.sql
```

Untuk fresh install, cukup jalankan `01_schema_clean_run_this.sql` dan `02_bootstrap_admin_after_signup.sql`.

## SEO dan Google indexing

File SEO yang sudah tersedia:

- `robots.txt`
- `sitemap.xml`
- favicon
- Open Graph image
- meta description landing
- canonical URL

Agar website muncul di Google untuk keyword seperti **NiagaBio**, **niaga bio**, **link bio**, dan **katalog produk**, lakukan ini:

1. Daftarkan website ke Google Search Console.
2. Verifikasi ownership domain/URL prefix.
3. Submit `https://niaga-bio.vercel.app/sitemap.xml`.
4. Pakai URL Inspection untuk request indexing homepage.
5. Cek indexing dengan query `site:niaga-bio.vercel.app`.
6. Bangun sinyal brand dengan share link ke sosial media, profil Instagram/TikTok, GitHub README, dan beberapa backlink natural.

Catatan: muncul di Google bisa butuh waktu. Indexing bisa dipercepat dengan Search Console, tapi ranking keyword tetap butuh konten, sinyal brand, dan waktu.

## Checklist test sebelum promosi

Pakai minimal 3 akun:

- Akun admin master.
- Akun user Free.
- Akun user Premium.

Test wajib:

```txt
1. Register/login normal.
2. Admin hanya bisa dibuka role admin.
3. User biasa tidak bisa buka /admin.
4. User Free tidak bisa bypass fitur Premium.
5. User Premium bisa ganti template Premium.
6. Upload JPG/PNG/WEBP sukses.
7. Upload SVG/GIF ditolak.
8. Produk tampil di public page.
9. Checkout membuat order pending.
10. Seller bisa tandai order selesai/batal.
11. Request Premium masuk ke Admin Master.
12. Admin approve Premium.
13. Notifikasi muncul di website.
14. Maintenance mode berjalan.
15. Link toko bisa dibuka dari HP dan desktop.
```

## Panduan desain dan roadmap

- Baca `DESAIN.md` untuk aturan UI, warna, komponen, layout, responsive, dan copywriting.
- Baca `ROADMAP.md` untuk urutan pengembangan manual agar tidak bingung.

## Catatan production

NiagaBio saat ini memakai QRIS manual. Jika ingin pembayaran otomatis seperti marketplace, perlu payment gateway dengan QRIS dynamic, webhook, dan backend/Edge Function. Jangan taruh secret payment gateway di frontend.

## Lisensi

Project pribadi NiagaBio. Gunakan dan modifikasi sesuai kebutuhan owner project.
