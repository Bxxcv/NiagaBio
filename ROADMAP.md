# Roadmap NiagaBio

Roadmap ini dibuat agar proses build tidak berantakan dan minim error.

## Phase 0 — Fondasi Brand & Struktur

Target:

- Menentukan nama brand
- Menentukan warna utama
- Menentukan style logo
- Menentukan struktur folder
- Menentukan database schema
- Menentukan fitur Free dan Premium

Output:

- README.md
- Struktur folder
- Design direction
- Database draft

Status: Belum mulai

## Phase 1 — Landing Page

Target:

- Membuat halaman landing page yang terlihat human-made
- Menjelaskan value produk
- Menampilkan Free vs Premium
- Menampilkan CTA daftar
- Mobile-first

File:

- index.html
- assets/css/landing.css

Status: Belum mulai

## Phase 2 — Auth

Target:

- Register user
- Login user
- Logout user
- Session check
- Redirect jika belum login
- Setelah daftar, user otomatis Free

File:

- login.html
- register.html
- assets/js/supabase-client.js
- assets/js/auth.js

Status: Belum mulai

## Phase 3 — Dashboard User Basic

Target:

- Dashboard ringkasan
- Edit profil
- Upload avatar
- Edit WhatsApp number
- Pilih username
- Validasi username unik

File:

- dashboard.html
- profile.html
- assets/js/dashboard.js

Status: Belum mulai

## Phase 4 — Produk & Link

Target:

- Tambah/edit/hapus produk
- Limit Free maksimal 5 produk
- Premium sampai 500 produk
- Tambah/edit/hapus custom links
- Limit Free maksimal 5 links
- Social media Free maksimal 3

File:

- products.html
- links.html
- social.html
- assets/js/products.js

Status: Belum mulai

## Phase 5 — Public Page

Target:

- Membuat halaman publik user
- Load data berdasarkan username
- Tampilkan profil
- Tampilkan produk
- Tampilkan links
- Tampilkan social media
- Tampilkan tema aktif
- Tombol beli via WhatsApp

File:

- u.html
- assets/js/public-page.js
- assets/css/themes.css

Status: Belum mulai

## Phase 6 — Premium Gate

Target:

- Membatasi fitur Free
- Membuka fitur Premium
- Membuat halaman upgrade
- Admin bisa aktifkan premium user

File:

- upgrade.html
- admin.html
- assets/js/admin.js

Status: Belum mulai

## Phase 7 — Gallery & Tema Premium

Target:

- Gallery hanya premium
- Tema premium 10+
- Custom warna
- Custom background
- Hilangkan branding untuk premium

File:

- gallery.html
- themes.html
- assets/js/gallery.js
- assets/js/themes.js

Status: Belum mulai

## Phase 8 — QRIS Manual Checkout

Target:

- Seller upload QRIS
- Seller pilih mode checkout
- Jika QRIS ON, pembeli masuk halaman checkout
- Pembeli upload bukti bayar
- Order masuk dashboard seller
- Seller konfirmasi Paid
- Omset bertambah setelah Paid

File:

- checkout-settings.html
- orders.html
- checkout.html
- assets/js/checkout.js
- assets/js/orders.js

Status: Belum mulai

## Phase 9 — Admin Master

Target:

- Admin melihat semua user
- Admin melihat semua toko
- Admin melihat semua order
- Admin melihat omset tercatat
- Admin bisa aktif/nonaktifkan premium
- Admin bisa blokir user

File:

- admin.html
- assets/js/admin.js

Status: Belum mulai

## Phase 10 — Testing & Deploy

Target:

- Test register/login
- Test limit Free
- Test fitur Premium
- Test upload gambar
- Test public page
- Test checkout WhatsApp
- Test QRIS manual
- Test admin panel
- Deploy ke Vercel

Status: Belum mulai
