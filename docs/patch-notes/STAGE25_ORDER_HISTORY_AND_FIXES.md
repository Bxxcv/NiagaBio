# Stage 25 — Riwayat Pesanan + Fix Bug "Lacak Order Lain"

Tanggal: 2026-09-18

## 1) FIXED: "Lacak Order Lain" tidak menampilkan apa-apa

**Root cause ketemu, bukan tebakan**: fitur auto-submit yang saya tambahkan
di Stage 24 (supaya buyer tidak perlu ketik ulang no. WA) dieksekusi setiap
`renderForm()` dipanggil — termasuk saat tombol "Lacak Order Lain"/"Kembali"
diklik. Karena nomor WA yang sama sudah tersimpan, form langsung
auto-submit ULANG ke hasil yang sama persis, sepersekian detik setelah
form sempat tampil. Dari sisi buyer, kelihatan seperti tombolnya tidak
melakukan apa-apa.

**Fix**: auto-submit sekarang cuma boleh jalan SEKALI, di initial page load
(flag `isInitialLoad`). Navigasi "kembali" apapun setelah itu tidak akan
memicu auto-submit lagi.

## 2) BARU: Riwayat pesanan ala Shopee ("Pesanan Saya")

Alur `track.html` sekarang:

1. Buyer masuk (tanpa `?order=` di URL) → diminta nomor WA saja.
2. Submit → tampil **daftar semua pesanan** (lintas toko) untuk nomor itu:
   nama toko, ringkasan produk, tanggal, total, badge status berwarna.
3. Klik satu kartu → masuk ke halaman detail (yang sudah ada dari Stage
   23/24: stepper status per item, auto-refresh, dst).

Link langsung dari konfirmasi checkout (`?order=<group_id>`) TETAP jalur
cepat — begitu nomor WA cocok, langsung ke detail order itu tanpa perlu
lewat daftar riwayat.

RPC baru: `get_orders_by_phone(buyer_phone)` — group by `order_group_id`,
kembalikan ringkasan (bukan detail finansial seller).

### ⚠️ Trade-off keamanan yang perlu kamu sadari

Lookup riwayat ini **cuma pakai nomor WhatsApp**, tidak ada lagi
`order_group_id` rahasia di langkah ini. Artinya **siapapun yang tahu nomor
WA seseorang bisa lihat ringkasan riwayat order nomor itu** (nama toko,
tanggal, produk, total — TIDAK termasuk seller_earning/platform_earning).
Ini konsekuensi langsung dari keputusan awal "buyer tanpa akun" — tidak ada
cara buyer akses riwayatnya sendiri tanpa suatu identifier yang bisa
diingat, dan nomor WA memang sudah jadi identifier utama sejak checkout.
Kalau kamu mau proteksi lebih (misal OTP WA sebelum buka riwayat), itu
enhancement terpisah, belum di-scope di sini — kabari kalau mau saya
kerjakan.

## 3) Nominal QR salah (dari 2 screenshot terakhir) — STATUS: BELUM FIXED, BUTUH DATA

Saya re-investigasi `api/payment/create.js` baris per baris. Kodenya
mengirim `amount = order.buyer_total` (Rp207.998 di kasus 2 produk terbaru
kamu), tapi yang BENAR-BENAR diminta ke BuatQris (dari "Nominal" di layar
BuatQris) ternyata Rp103.999 — **kira-kira separuh**. Ini artinya
`order.buyer_total` pada row yang dipakai untuk create QR SUDAH salah
SEBELUM sampai ke BuatQris — bukan BuatQris yang memotong. Guard yang saya
tambahkan di Stage 24 tidak menangkap ini karena guard itu membandingkan
`amount` vs respons BuatQris, dan keduanya (103.999 vs 104.078) memang
konsisten satu sama lain — masalahnya `amount` itu sendiri sudah salah dari
awal.

Saya sudah cek ulang logic `create_public_order_batch` (Pass 1 hitung total
semua item, Pass 2 kasih fee cuma ke item pertama) dan tidak ketemu bug di
situ secara statis. Karena ini urusan uang, saya tidak mau tebak-tebak dan
kirim "fix" tanpa yakin akar masalahnya — **tolong jalankan query ini di
Supabase SQL Editor** setelah checkout cart baru (jangan checkout dulu,
biar barisnya masih ada), lalu kirim hasilnya ke saya:

```sql
select id, order_group_id, product_name, quantity, total_price,
       platform_fee, withdrawal_reserve, buyer_total, payment_method,
       payment_status, created_at
from orders
order by created_at desc
limit 6;
```

Dengan data itu saya bisa lihat persis nilai `buyer_total` di tiap row dan
pastikan apakah bug-nya di SQL (`create_public_order_batch`) atau di
frontend (`findPrimary()` di `cart-checkout.js` salah pilih row). Setelah
itu saya kirim fix yang presisi, bukan tambal sulam.

## File yang berubah

- `supabase/37_orders_history_by_phone.sql` (baru)
- `assets/js/order-tracking.js` (ditulis ulang — alur riwayat + fix auto-submit)
- `assets/js/supabase-client.js` (tambah `NB.getOrdersByPhone`)
- `assets/css/v2/tracking.css` (style kartu riwayat)

## Setup

1. Jalankan `supabase/37_orders_history_by_phone.sql` di SQL Editor.
2. Copy 3 file JS/CSS di atas.
3. Deploy, test buka `/track.html` langsung (tanpa `?order=`) → harus
   muncul form nomor WA → submit → daftar riwayat.
4. **Jangan lupa jalankan query diagnostik poin 3 dan kirim hasilnya.**
