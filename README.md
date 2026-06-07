# NiagaBio

NiagaBio adalah link bio + katalog produk untuk UMKM/pelaku usaha.

Stack:

- HTML
- CSS
- Vanilla JavaScript
- Bootstrap + Bootstrap Icons
- Supabase Auth, Database, Storage

## File penting

- assets/js/config.js: config Supabase
- supabase/01_schema_clean_run_this.sql: schema utama dari nol
- supabase/02_bootstrap_admin_after_signup.sql: jadikan email owner sebagai admin
- `/admin`: Admin Master khusus owner
- `/dashboard`: dashboard seller/user
- `/u?username=...`: public page toko

## Setup cepat

Baca:

SETUP_SUPABASE_DARI_NOL.md

## Manual wajib

Edit assets/js/config.js:

- SUPABASE_URL
- SUPABASE_ANON_KEY
- DEMO_MODE: false setelah schema sukses

Jangan pernah taruh service_role key di frontend.

## Status release

Versi ini adalah production candidate. Jalankan checklist di `PRODUCTION_CHECKLIST.md` sebelum promosi ke user baru.


## Launch assets

Untuk mulai promosi kecil-kecilan, baca:

- `LAUNCH_PACK.md`
- `PROMOSI_WHATSAPP_INSTAGRAM.md`
- `SOFT_LAUNCH_CHECKLIST.md`

Gunakan v23 ini untuk soft launch ke 5–10 seller terlebih dahulu sebelum promosi besar.
