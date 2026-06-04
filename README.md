# NiagaBio

**NiagaBio** adalah platform link bio + katalog produk ringan untuk kreator, seller, freelancer, dan UMKM.  
Dibuat dengan HTML, CSS, JavaScript vanilla, Bootstrap, dan Supabase agar mudah dikembangkan bahkan dari HP.

## Konsep Produk

NiagaBio bukan cuma halaman link bio biasa.  
Target utamanya adalah membantu seller kecil punya halaman profil jualan yang rapi, berisi:

- Link bio publik
- Profil toko / personal brand
- Katalog produk
- Tombol order WhatsApp
- Tema tampilan
- Social media links
- Gallery untuk premium
- QRIS manual checkout untuk premium
- Dashboard omset sederhana
- Admin panel untuk monitoring user

## Target User

- UMKM kecil
- Online seller
- Kreator konten
- Freelancer
- Jasa rumahan
- Reseller / dropshipper
- Portfolio personal

## Tech Stack

Frontend:

- HTML
- CSS
- JavaScript vanilla
- Bootstrap 5
- Bootstrap Icons

Backend:

- Supabase Auth
- Supabase Database
- Supabase Storage
- Supabase Row Level Security

Deploy:

- Vercel
- GitHub

## Plan & Fitur

### Free Plan

- Akun otomatis gratis setelah daftar
- 2 tema gratis
- Maksimal 5 produk
- Maksimal 5 custom links
- Maksimal 3 social media icons
- Checkout via WhatsApp
- Branding NiagaBio aktif
- Tidak ada gallery
- Tidak ada search produk
- Tidak ada QRIS manual checkout
- Tidak ada dashboard omset lengkap

### Premium Plan

Harga awal: **Rp80.000**

Fitur premium:

- Semua fitur Free
- 10+ tema niche
- Tema Fashion
- Tema Gadget
- Tema Food
- Tema Beauty
- Tema Jasa
- Tema Portfolio
- Tema Minimal
- Tema Dark
- Tema Luxury
- Tema Neon
- Katalog sampai 500 produk
- Search produk
- Kategori produk
- Gallery
- Social media icons lebih banyak
- QR Code halaman
- Statistik klik sederhana
- Custom warna dan branding
- Banner promo
- Produk unggulan
- Testimoni
- Hilangkan branding NiagaBio
- Checkout QRIS manual
- Upload bukti pembayaran
- Dashboard omset sederhana
- Riwayat order

## Mode Checkout

NiagaBio memiliki dua mode checkout:

### 1. WhatsApp Checkout

Pembeli klik tombol beli, lalu diarahkan ke WhatsApp seller dengan format pesan otomatis.

Contoh:

```txt
Halo kak, saya mau pesan:
Produk: Hoodie Black
Harga: Rp120.000
Jumlah: 1
```

### 2. QRIS Manual Checkout

Seller premium upload QRIS sendiri di dashboard.

Alur:

```txt
Pembeli klik beli
→ halaman checkout tampil
→ pembeli scan QRIS seller
→ pembeli upload bukti bayar
→ order masuk dashboard seller
→ seller klik Konfirmasi Paid
→ omset dashboard bertambah
```

## Struktur Halaman

```txt
/
landing page

login.html
halaman login user

register.html
halaman daftar user

dashboard.html
ringkasan dashboard user

profile.html
edit profil toko/user

products.html
kelola produk

links.html
kelola link custom

social.html
kelola social media

gallery.html
kelola gallery premium

themes.html
pilih tema

checkout-settings.html
atur WhatsApp / QRIS manual

orders.html
lihat pesanan masuk

upgrade.html
halaman upgrade premium

admin.html
admin panel utama pemilik platform

u.html?username=namauser
halaman publik user
```

## Struktur Folder

```txt
/
├── index.html
├── login.html
├── register.html
├── dashboard.html
├── profile.html
├── products.html
├── links.html
├── social.html
├── gallery.html
├── themes.html
├── checkout-settings.html
├── orders.html
├── upgrade.html
├── admin.html
├── u.html
├── assets/
│   ├── css/
│   │   ├── main.css
│   │   ├── landing.css
│   │   ├── dashboard.css
│   │   └── themes.css
│   ├── js/
│   │   ├── config.js
│   │   ├── supabase-client.js
│   │   ├── auth.js
│   │   ├── dashboard.js
│   │   ├── products.js
│   │   ├── public-page.js
│   │   ├── checkout.js
│   │   ├── orders.js
│   │   └── admin.js
│   └── img/
│       ├── logo.svg
│       └── placeholder-product.png
└── README.md
```

## Database Tables

### profiles

```txt
id
user_id
username
display_name
bio
avatar_url
whatsapp_number
plan
role
status
plan_end_date
created_at
```

### products

```txt
id
user_id
name
price
description
image_url
category
is_active
is_featured
sort_order
created_at
```

### custom_links

```txt
id
user_id
title
url
icon
is_active
sort_order
click_count
created_at
```

### social_links

```txt
id
user_id
platform
url
sort_order
created_at
```

### gallery

```txt
id
user_id
image_url
caption
sort_order
created_at
```

### checkout_settings

```txt
id
user_id
checkout_mode
whatsapp_number
qris_enabled
qris_image_url
qris_name
payment_note
created_at
```

### orders

```txt
id
seller_id
buyer_name
buyer_phone
product_id
product_name
quantity
total_price
payment_method
payment_status
proof_image_url
created_at
paid_at
```

### themes

```txt
id
user_id
theme_name
accent_color
background_style
button_style
font_style
created_at
```

## Role

```txt
user
admin
```

Admin utama bisa:

- Melihat semua user
- Melihat semua toko
- Melihat semua order
- Mengaktifkan premium
- Menonaktifkan user
- Monitoring omset tercatat
- Melihat toko yang mengaktifkan QRIS manual

## Catatan Keamanan

- Jangan pernah taruh Supabase service role key di frontend.
- Frontend hanya boleh pakai Supabase URL dan anon key.
- Gunakan Row Level Security.
- User hanya boleh membaca/mengubah data miliknya sendiri.
- Admin hanya boleh diakses oleh role admin.
- Validasi limit Free dan Premium di frontend dan database policy.

## Status Project

Tahap awal:

- Finalisasi nama brand
- Finalisasi struktur folder
- Buat landing page
- Buat Supabase project
- Setup auth
- Setup database
- Build dashboard user
- Build public page
- Build premium gate
- Build QRIS manual checkout
- Build admin panel
