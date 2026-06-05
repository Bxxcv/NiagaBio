# NiagaBio Final

NiagaBio adalah platform link bio + katalog produk untuk seller, kreator, freelancer, dan UMKM.

Stack:

- HTML
- CSS
- JavaScript vanilla
- Bootstrap 5
- Bootstrap Icons
- Supabase Auth
- Supabase Database
- Supabase Storage
- Vercel

## Paket

### Free

- 2 tema gratis
- Maksimal 5 produk
- Maksimal 5 custom links
- Maksimal 3 social media icons
- Checkout WhatsApp
- Branding NiagaBio aktif

### Premium Rp80.000 / 30 hari

- 10+ tema niche
- Katalog sampai 500 produk
- Search produk
- Kategori produk
- Gallery
- Social media lebih lengkap
- QRIS manual checkout seller
- Dashboard omset
- Riwayat order
- Hilangkan branding

## Admin Master

Halaman admin:

```txt
/admin
```

Fitur admin:

- Kontrol user
- Upgrade Premium
- Blokir user
- Soft delete user
- Kirim reset password
- Request upgrade premium via QRIS admin
- Maintenance mode
- Monitoring order dan omset

## Setup

Baca file:

```txt
SETUP.md
```

## Demo Mode

Jika `DEMO_MODE: true`, project berjalan memakai localStorage agar bisa dites tanpa Supabase.

Untuk live production, ubah di `assets/js/config.js`:

```js
DEMO_MODE: false
```
