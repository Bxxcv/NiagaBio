# Patch STAGE25 — Riwayat Pesanan + Fix "Lacak Order Lain"

Detail lengkap + query diagnostik untuk bug nominal QR:
`docs/patch-notes/STAGE25_ORDER_HISTORY_AND_FIXES.md` — **baca poin 3,
saya butuh hasil 1 query dari kamu sebelum bisa fix bug nominal dengan
benar (bukan tebak-tebakan).**

## Copy & timpa

- `assets/js/order-tracking.js`
- `assets/js/supabase-client.js`
- `assets/css/v2/tracking.css`

## Jalankan SQL baru

- `supabase/37_orders_history_by_phone.sql`

Deploy, lalu test `/track.html` (tanpa `?order=`) → harus muncul form
nomor WA duluan, bukan langsung minta order ID.
