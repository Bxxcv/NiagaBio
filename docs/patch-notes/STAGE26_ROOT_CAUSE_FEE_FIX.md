# Stage 26 — Root Cause Pasti: Fee Dobel di Cart

Tanggal: 2026-09-18

## Root cause (dari data live yang Rid kirim)

Tabel hasil query menunjukkan **kedua row dalam 1 cart sama-sama dapat
platform_fee=1500 & withdrawal_reserve=2500 penuh** — bukan cuma item
pertama. Ini bukan bug di `create_public_order_batch` (migration 36) yang
saya tulis — logic "fee cuma di item pertama" di situ **percuma**, karena
ada trigger `BEFORE INSERT` bernama `protect_orders_fields()` yang **sudah
ada sejak migration 25/28 (jauh sebelum cart feature)** dan menimpa ulang
`platform_fee`/`withdrawal_reserve`/`buyer_total` di SETIAP baris orders
berdasarkan `product_price × quantity` + fee penuh — tanpa tahu konsep
cart/order_group_id sama sekali.

**Saya akui: ini seharusnya ketemu di audit awal.** Saya audit trigger
`validate_order_public_fields` (yang relevan untuk bug forgery payment)
tapi tidak melakukan audit menyeluruh SEMUA trigger di tabel `orders`
sebelum menulis migration 36 — jadi ada trigger kedua (`protect_orders_
fields`) yang lolos. Pelajaran untuk ke depan: audit trigger di tabel
finansial harus daftar SEMUA trigger dulu, bukan cuma yang sudah dicurigai.

## Fix (migration 38)

1. `protect_orders_fields()` — sebelum kasih fee penuh, cek dulu apakah
   `order_group_id` baris ini SUDAH ada baris lain. Kalau sudah (item
   ke-2/3/dst dari 1 cart) → fee = 0. Kalau belum (item pertama, ATAU order
   lama single-item yang order_group_id-nya selalu fresh random) → fee
   penuh seperti sebelumnya. **Flow single-item lama TIDAK berubah sama
   sekali.**
2. Trigger yang sama juga ditambah "trusted flag" (transaction-local,
   cuma bisa dinyalakan dari dalam `create_public_order_batch` sendiri —
   tidak bisa dipicu client manapun) supaya fungsi itu bisa membetulkan
   `buyer_total` row pertama jadi TOTAL SELURUH keranjang setelah semua
   item selesai di-insert (saat insert item pertama, total item ke-2/3
   belum diketahui).
3. `create_public_order_batch()` disederhanakan besar — perhitungan
   produk/fee/total sekarang 100% tanggung jawab trigger (satu sumber
   kebenaran, tidak dihitung dobel di 2 tempat seperti sebelumnya).

Tidak ada perubahan di frontend (`cart-checkout.js`, `order-tracking.js`)
— logic `findPrimary()` (cari row dengan `platform_fee > 0`) tetap benar
karena sekarang memang cuma 1 row per grup yang punya fee > 0.

## ⚠️ Temuan terpisah, BELUM di-fix (butuh keputusanmu)

Trigger yang sama, di cabang UPDATE, mengunci `payment_status` (dan semua
field finansial) untuk caller yang **bukan admin/service_role** — ini
SUDAH ada sejak migration 25/28, jauh sebelum saya masuk. Efeknya: tombol
**"Tandai Dibayar"/"Batal" untuk order manual (qris_manual/qris_whatsapp)
kemungkinan besar SUDAH TIDAK BERFUNGSI untuk seller biasa** — update-nya
"berhasil" tanpa error, tapi nilainya diam-diam dikembalikan trigger ke
nilai lama. Saya BELUM fix ini karena di luar scope bug nominal yang kamu
laporkan, dan butuh keputusan: apakah manual mark-paid ini memang maunya
admin-only (sesuai desain migration 28), atau perlu diaktifkan lagi untuk
seller biasa lewat RPC baru yang eksplisit (lebih aman daripada buka akses
UPDATE langsung)? Tolong coba tes tombol "Tandai Dibayar" di 1 order
manual, kabari hasilnya.

## File yang berubah

- `supabase/38_fix_cart_fee_double_charge.sql` (baru) — satu-satunya file
  di patch ini, tidak ada perubahan JS/CSS.

## Setup

1. Jalankan migration 38 di SQL Editor.
2. Test checkout cart 2+ produk lagi → cek "Total pembayaran" sekarang
   sama dengan subtotal produk + 1x fee (bukan dobel).
3. Tes tombol "Tandai Dibayar" di order manual, kabari apakah jalan atau
   tidak (lihat catatan di atas).
