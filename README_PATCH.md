# Patch STAGE24 — Revisi Feedback Cart (di atas Stage 23 yang sudah live)

Cuma 6 file yang berubah, semua di ronde ini (Stage 23 tidak ikut lagi).
Detail lengkap: `docs/patch-notes/STAGE24_CART_FEEDBACK_FIXES.md`.

## Copy & timpa

- `api/payment/create.js`
- `assets/js/cart.js`
- `assets/js/public-page.js`
- `assets/js/order-tracking.js`
- `assets/css/v2/cart.css`
- `assets/css/v2/tracking.css`

Tidak ada SQL baru. Deploy, lalu test ulang: cart 2+ produk → checkout →
kalau muncul error nominal dari BuatQris, itu tanda perlu cek limit sandbox
di dashboard BuatQris (lihat poin 1 di STAGE24 doc).
