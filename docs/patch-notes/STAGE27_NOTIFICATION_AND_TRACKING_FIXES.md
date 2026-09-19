# Stage 27 — Fix Notifikasi Dini + Lacak Pesanan Konsisten + Auto-refresh Dashboard

Tanggal: 2026-09-19

## 1) FIXED: Notifikasi seller kepencet dini ("user belum selesai")

**Root cause** (ditemukan lewat audit menyeluruh SEMUA trigger di `orders`
- pelajaran dari Stage 26 kemarin): ada 2 trigger notifikasi yang sudah ada
sejak migration 22 (jauh sebelum cart feature):

- `notify_order_insert` — nembak notifikasi "Pesanan baru" ke seller
  **begitu row order dibuat**, termasuk order `qris_buatqris` yang masih
  `pending` (buyer baru mulai checkout, belum bayar).
- `notify_order_status_update` — punya syarat `auth.uid() is not null`.
  Webhook BuatQris jalan pakai `service_role` (`auth.uid()` = null untuk
  service_role), jadi kondisi ini **memblokir** notifikasi pembayaran
  sukses. Efeknya: seller kemungkinan besar **tidak pernah** dapat
  notifikasi "pembayaran diterima" untuk order gateway — cuma dapat
  notifikasi "pesanan baru" yang sebenarnya masih pending.

**Fix (migration 39)**:
- `notify_order_insert` sekarang skip untuk `qris_buatqris` (tunggu sampai
  benar-benar `paid`). Tetap jalan untuk `qris_manual`/`qris_whatsapp`
  (proof sudah wajib diupload di titik itu, jadi memang perlu direview).
- `notify_order_status_update` sekarang juga jalan untuk `auth.uid() is
  null` (webhook/service_role), jadi notifikasi "Pembayaran diterima"
  akhirnya benar-benar nyampe ke seller saat pembayaran gateway sukses.

## 2) FIXED: Lacak Pesanan tidak ada di checkout biasa (bukan cart)

Ditambahkan link "Lacak Pesanan Saya" di layar sukses `checkout.js`
(single-item, non-cart) — sama seperti yang sudah ada di `cart-checkout.js`.
Datanya sudah kompatibel dari awal (`order_group_id` di-generate otomatis
untuk semua order, cart maupun bukan), cuma linknya yang belum ditampilkan.

## 3) FIXED: Lacak Pesanan susah ditemukan tanpa link

Ditambahkan link "Lacak Pesanan" di **footer setiap halaman toko**
(u.html) — muncul di semua tema, tidak ganggu tombol lain. Buyer yang lupa
order-nya sekarang bisa: buka toko manapun → scroll ke footer → klik
"Lacak Pesanan" → masuk ke alur cari-by-nomor-WA (Stage 25) tanpa perlu
link/kode apapun.

## 4) FIXED: Dashboard seller (/seller/orders) tidak auto-update

Ditambahkan auto-refresh tiap 15 detik — sama seperti `/track.html`.
Di-skip otomatis kalau seller sedang pegang dropdown status/input lain
(supaya tidak ganggu interaksi yang berjalan).

## 5) Klarifikasi: auto-deteksi pembayaran (tidak perlu klik tombol apapun)

Ini **sudah bekerja begitu**, bukan bug — baik di `checkout.js` maupun
`cart-checkout.js`, begitu QRIS dibuat, halaman otomatis cek status tiap 7
detik ke `/api/payment/status` tanpa perlu tindakan apapun dari buyer.
Tombol **"Buka Halaman Pembayaran"** cuma opsional — itu cuma buka
tampilan BuatQris di tab baru sebagai alternatif, BUKAN syarat supaya
statusnya kecek. Begitu buyer transfer & QRIS settle, halaman akan pindah
ke layar sukses sendiri dalam beberapa detik, tanpa perlu klik apapun.

## File yang berubah

- `supabase/39_fix_notification_timing.sql` (baru)
- `assets/js/checkout.js` — tambah link Lacak Pesanan
- `assets/js/public-page.js` — tambah link Lacak Pesanan di footer
- `assets/js/orders.js` — auto-refresh 15 detik
- `assets/css/v2/cart.css` — style kecil link footer

## Setup

1. Jalankan migration 39.
2. Copy 4 file JS/CSS di atas.
3. Test: checkout single-item (bukan cart) → cek notifikasi TIDAK masuk
   sebelum bayar, TAPI masuk setelah QRIS sukses. Cek juga link Lacak
   Pesanan muncul di layar sukses.
4. Buka halaman toko manapun → scroll ke footer → klik "Lacak Pesanan".
5. Buka `/seller/orders`, biarkan terbuka >15 detik sambil ada order baru
   masuk dari device lain → cek apakah muncul otomatis.
