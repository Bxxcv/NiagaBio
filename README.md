# NiagaBio

NiagaBio adalah link bio + katalog produk untuk seller/UMKM.

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
- admin.html: Admin Master khusus owner
- dashboard.html: dashboard seller/user
- u.html: public page toko

## Setup cepat

Baca:

SETUP_SUPABASE_DARI_NOL.md

## Manual wajib

Edit assets/js/config.js:

- SUPABASE_URL
- SUPABASE_ANON_KEY
- DEMO_MODE: false setelah schema sukses

Jangan pernah taruh service_role key di frontend.
