# Patch: Cart + Order Tracking + Fix P0 Payment Forgery

Isi ZIP ini HANYA file yang berubah/baru — bukan seluruh project.
Detail lengkap ada di `docs/patch-notes/STAGE23_CART_ORDER_TRACKING.md`.

## Urutan apply

1. **SQL dulu**: buka Supabase SQL Editor, jalankan
   `supabase/36_cart_order_group_tracking_security_fix.sql` (aman dijalankan
   ulang / idempotent).
2. **Copy file ke repo** (timpa path yang sama, folder structure ZIP ini
   sudah sama persis dengan struktur repo):
   - `assets/js/supabase-client.js` (diubah)
   - `assets/js/public-page.js` (diubah)
   - `assets/js/orders.js` (diubah)
   - `assets/js/cart.js` (baru)
   - `assets/js/cart-checkout.js` (baru)
   - `assets/js/order-tracking.js` (baru)
   - `assets/css/v2/cart.css` (baru)
   - `assets/css/v2/tracking.css` (baru)
   - `cart-checkout.html` (baru)
   - `track.html` (baru)
   - `seller/u.html` (diubah — cuma nambah 2 baris link/script)
   - `seller/orders.html` (diubah — nambah 1 kolom header + style block kecil)
   - `docs/patch-notes/STAGE23_CART_ORDER_TRACKING.md` (baru)
3. Commit & push ke GitHub → Vercel auto-deploy.

## File yang TIDAK disentuh (sengaja)

`api/payment/create.js`, `api/payment/webhook.js`, `api/payment/status.js`,
`checkout.html`, `assets/js/checkout.js` — flow single-item "Beli" lama
tetap jalan apa adanya, cart adalah alur tambahan, bukan pengganti.

## Yang WAJIB kamu tes sebelum anggap selesai

Lihat bagian "Setup" di `docs/patch-notes/STAGE23_CART_ORDER_TRACKING.md`.
Saya belum bisa jalankan ini langsung ke Supabase/Vercel kamu (tidak ada
akses jaringan dari sesi ini) — jadi migration & smoke test WAJIB kamu
jalankan sendiri, saya cuma validasi syntax (node --check semua .js lolos,
paren/brace SQL & CSS seimbang, tag HTML seimbang).
