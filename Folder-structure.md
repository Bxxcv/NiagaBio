# Folder Structure — NiagaBio

Dokumen ini menjelaskan struktur folder/file project NiagaBio supaya AI dan developer tidak salah edit, salah asumsi, atau merusak flow aplikasi.

## Gambaran singkat
NiagaBio adalah web app link-in-bio + katalog produk + checkout manual + dashboard seller + admin tools, dibangun dengan:
- HTML
- CSS vanilla
- JavaScript vanilla
- Supabase
- Deploy utama di Vercel

Project ini **bukan** React/Next/Vue app. Semua file inti bersifat statis HTML/CSS/JS, dengan integrasi API lewat Supabase dan Vercel routes tertentu.

---

## Struktur root project

```text
NiagaBio/
├── 404.html
├── README.md
├── admin.html
├── checkout-settings.html
├── checkout.html
├── dashboard.html
├── gallery.html
├── index.html
├── links.html
├── login.html
├── maintenance.html
├── notifications.html
├── orders.html
├── privacy.html
├── products.html
├── profile.html
├── refund.html
├── register.html
├── reset-password.html
├── robots.txt
├── site.webmanifest
├── sitemap.xml
├── social.html
├── terms.html
├── themes.html
├── u.html
├── upgrade.html
├── vercel.json
├── api/
├── assets/
├── docs/
└── supabase/
```

---

## Arti tiap folder

### 1) `assets/`
Semua aset frontend ada di sini.

#### `assets/css/`
File style utama:
- `landing.css` → styling landing page
- `main.css` → styling halaman inti/user page

#### `assets/js/`
File logic utama:
- `config.js` → konfigurasi aplikasi
- `supabase-client.js` → inisialisasi Supabase client
- `common.js` → helper umum
- `auth.js` → login/register/reset auth
- `landing.js` → interaksi landing page
- `public-page.js` → render halaman publik user
- `dashboard.js` → logic dashboard seller
- `profile.js` → edit profil toko
- `products.js` → CRUD produk
- `gallery.js` → galeri
- `links.js` → social/custom links
- `orders.js` → order management
- `checkout.js` → alur checkout
- `checkout-settings.js` → pengaturan checkout
- `social.js` → pengaturan sosial
- `themes.js` → tema tampilan
- `upgrade.js` → halaman upgrade plan
- `notifications.js` → notifikasi in-app
- `maintenance.js` → mode maintenance
- `admin.js` → admin tools

#### `assets/img/`
Semua gambar:
- `logo.jpg` → logo utama
- `og-niagabio.jpg` → preview sosial media
- `favicon-*` / `icon-*` → favicon dan PWA icons
- `placeholder-product.svg` → placeholder gambar produk
- `preview/` → screenshot preview UI

---

### 2) `api/`
Endpoint serverless yang dipakai project.

Saat ini:
- `api/share.js` → endpoint share / route helper / serverless handler

Catatan:
- Kalau deploy di Vercel, folder `api/` aktif.
- Kalau deploy di hosting statis biasa, fitur ini bisa tidak jalan.
- Jangan pindahkan logic `api/` ke frontend tanpa sadar karena bisa merusak flow share/link.

---

### 3) `docs/`
Dokumentasi internal project.

Isi penting:
- `DESAIN.md` → arahan visual/design system
- `PROJECT_STRUCTURE.md` → struktur project versi dokumentasi internal
- `README.md` → catatan docs internal
- `ROADMAP.md` → roadmap fitur
- `SETUP_SUPABASE_DARI_NOL.md` → setup Supabase dari awal
- `UPDATE_GUIDE.md` → panduan update proyek
- `patch-notes/` → catatan patch dan audit

#### `docs/patch-notes/`
Berisi catatan patch spesifik, misalnya:
- route fix
- security hardening
- rate limit
- production guard
- anti-spam order proof
- cleanup performance

Kalau AI ingin memahami sejarah keputusan teknis, baca folder ini.

---

### 4) `supabase/`
Semua SQL dan security policy ada di sini.

Isi penting:
- `01_schema_clean_run_this.sql` → schema awal
- `02_bootstrap_admin_after_signup.sql` → bootstrap admin
- `03_fix_theme_setter.sql`
- `04_upgrade_requests_admin_tools.sql`
- `05_reset_sales_recap.sql`
- `06_security_hardening.sql`
- `07_in_app_notifications.sql`
- `08_security_reaudit_final.sql`
- `11_password_reset_requests.sql`
- `12_security_final_rls_storage_audit.sql`
- `13_checkout_order_flow_fix.sql`
- `14_readonly_security_regression_audit.sql`
- `15_order_proof_antispam_hardening.sql`
- `16_private_proof_storage.sql`
- `18_rate_limit_audit_log_hardening.sql`
- `19_production_readiness_audit.sql`
- `README.md`

Catatan:
- SQL ini **berurutan dan saling terkait**.
- Jangan asal jalankan file tanpa paham dependency.
- Kalau ada RLS error, biasanya penyebabnya ada di folder ini, bukan di frontend.

---

## File HTML inti dan fungsinya

### Public-facing
- `index.html` → landing page utama
- `u.html` → halaman publik toko/user profile
- `checkout.html` → halaman checkout publik
- `maintenance.html` → mode maintenance
- `404.html` → fallback error page
- `privacy.html`, `terms.html`, `refund.html` → halaman legal

### Auth
- `login.html`
- `register.html`
- `reset-password.html`

### Dashboard / seller tools
- `dashboard.html`
- `profile.html`
- `products.html`
- `gallery.html`
- `links.html`
- `social.html`
- `checkout-settings.html`
- `themes.html`
- `orders.html`
- `notifications.html`
- `upgrade.html`

### Admin
- `admin.html`

### Support
- `https://chat-bot-niaga-bio-six.vercel.app`

---

## Alur kerja file per fitur

### 1) Landing page
Flow:
- `index.html`
- `assets/css/landing.css`
- `assets/js/landing.js`

Tugas:
- menjelaskan produk
- memancing user daftar
- menunjukkan demo/benefit

### 2) Auth
Flow:
- `login.html`
- `register.html`
- `reset-password.html`
- `assets/js/auth.js`
- `assets/js/supabase-client.js`
- `assets/js/config.js`

Tugas:
- autentikasi user
- koneksi ke Supabase Auth

### 3) Dashboard seller
Flow:
- `dashboard.html`
- `profile.html`
- `products.html`
- `gallery.html`
- `links.html`
- `social.html`
- `checkout-settings.html`
- `themes.html`
- `orders.html`
- `notifications.html`

Tugas:
- edit profil toko
- tambah produk
- atur link sosial
- lihat order
- atur tampilan

### 4) Public store page
Flow:
- `u.html`
- `assets/js/public-page.js`
- Supabase data user/profil/produk

Tugas:
- render toko publik
- tampilkan profil, produk, links, gallery, CTA

### 5) Checkout
Flow:
- `checkout.html`
- `assets/js/checkout.js`
- `checkout-settings.html`

Tugas:
- proses order
- tampilkan instruksi pembayaran
- simpan status order

### 6) Chatbot
Flow:
- `https://chat-bot-niaga-bio-six.vercel.app`

Tugas:
- bantu user awam
- jawab pertanyaan umum
- arahkan ke fitur yang benar

---

## File yang paling sering diedit

### UI/UX
- `index.html`
- `assets/css/landing.css`
- `assets/js/landing.js`

### Produk
- `dashboard.html`
- `products.html`
- `u.html`
- `assets/js/products.js`
- `assets/js/public-page.js`

### Auth & account
- `login.html`
- `register.html`
- `reset-password.html`
- `assets/js/auth.js`

### Supabase connection
- `assets/js/config.js`
- `assets/js/supabase-client.js`

---

## File yang jangan diedit sembarangan

- `vercel.json`
- `api/share.js`
- SQL di folder `supabase/`
- `assets/js/supabase-client.js`
- `assets/js/config.js`
- `assets/js/public-page.js`

Kenapa:
- file ini sensitif
- sering terkait routing, auth, data publik, dan security
- satu perubahan kecil bisa bikin login atau halaman toko blank

---

## Routing penting

NiagaBio menggunakan route berbasis file HTML dan rewrite.

Contoh route:
- `/login` → `login.html`
- `/register` → `register.html`
- `/dashboard` → `dashboard.html`
- `/admin` → `admin.html`
- `/u?username=xxx` → halaman publik toko
- `/checkout?username=xxx&product=yyy` → checkout publik

Kalau deploy di hosting selain Vercel, rewrite harus disiapkan manual.

---

## Prinsip naming

### HTML page
Pakai nama file yang langsung jelas:
- `login.html`
- `dashboard.html`
- `checkout-settings.html`

### JS
Nama file harus sesuai area tanggung jawab:
- `auth.js` untuk auth
- `products.js` untuk produk
- `orders.js` untuk order

### CSS
Pisahkan style berdasarkan area:
- landing
- main app
- chatbot

Jangan gabung semua style jadi satu file besar kecuali terpaksa.

---

## Aturan aman untuk AI

### Wajib
- baca struktur dulu sebelum edit
- cek dependency antar file
- jaga route lama tetap jalan
- jaga UX mobile-first
- jaga Supabase schema dan RLS tetap konsisten

### Jangan
- ganti framework
- pindah routing tanpa alasan
- hapus file SQL lama yang masih dipakai
- ubah nama file penting tanpa update semua referensi
- menganggap halaman publik bisa jalan tanpa data Supabase

---

## Checklist saat AI mau edit
Sebelum ubah file, AI harus menjawab:
1. file ini dipakai halaman apa?
2. ada file lain yang tergantung?
3. ini hanya UI atau juga logic?
4. apakah ini mempengaruhi Supabase/RLS?
5. apakah route lama tetap aman?

Kalau jawaban belum jelas, jangan edit asal.

---

## Ringkasan cepat
Kalau bingung, urutan baca paling aman:
1. `README.md`
2. `docs/PROJECT_STRUCTURE.md`
3. `docs/DESAIN.md`
4. `assets/js/config.js`
5. `assets/js/supabase-client.js`
6. `assets/js/public-page.js`
7. folder `supabase/`

Itu sudah cukup untuk memahami NiagaBio tanpa mengacaukan sistem.
