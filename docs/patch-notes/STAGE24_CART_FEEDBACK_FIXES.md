# Stage 24 — Cart Feedback Fixes (post live-test)

Tanggal: 2026-09-18

Revisi dari hasil test langsung Rid di niaga-bio.vercel.app (Stage 23 sudah
live). 4 temuan, 4 fix. File di patch ini HANYA yang berubah di ronde ini —
Stage 23 (migration 36, orders.js, u.html, dll) TIDAK berubah lagi.

## 1) Nominal QRIS beda dari yang seharusnya (root cause + guard)

**Root cause**: `api/payment/create.js` mengirim `amount = order.buyer_total`
ke BuatQris (benar, sudah begitu dari awal, TIDAK diubah oleh cart feature).
Tapi respons `provider.total_amount` dari BuatQris balik dengan nominal yang
JAUH lebih kecil dari yang diminta (test Rid: diminta Rp2.707.973, provider
balas Rp1.304.001). Ini kemungkinan besar batas nominal transaksi di
akun/sandbox BuatQris — **saya tidak bisa memastikan ini dari sisi kode**,
karena butuh cek dashboard/dokumentasi BuatQris kamu langsung.

**Kenapa ini penting**: kalau dibiarkan, QR akan dibuat untuk nominal yang
TIDAK SAMA dengan `order.buyer_total` yang tercatat, tapi sistem tetap akan
mencatat `seller_earning`/`platform_earning` berdasarkan nominal order asli
(lebih besar) begitu webhook sukses. Itu bug akuntansi, bukan cuma bug
tampilan — data yang di-*credit* ke seller bisa lebih besar dari yang
benar-benar settle dari gateway.

**Fix**: `api/payment/create.js` sekarang membandingkan `provider.total_amount`
dengan `amount` yang diminta. Kalau selisihnya lebih dari toleransi kecil
(Rp1.000 atau 2%, mana yang lebih besar), request DIHENTIKAN dengan error —
QRIS TIDAK dibuat, order tetap `pending`, tidak ada payment_transactions
yang tercatat. Lebih baik gagal jelas daripada buyer bayar nominal yang
tidak sesuai catatan.

**Yang perlu Rid cek sendiri**: buka dashboard/dokumentasi BuatQris, cari
batas nominal transaksi sandbox (mungkin ada tier/limit per transaksi).
Kalau memang ada limit, testing cart besar (>batas itu) akan mulai gagal
dengan pesan error yang jelas (bukan diam-diam salah nominal seperti
sebelumnya) — itu perilaku yang benar sampai limit-nya dinaikkan/dikonfirmasi
provider.

**Soal keamanan secara umum** (dari pertanyaan Rid): webhook BuatQris tetap
diverifikasi HMAC signature (tidak diubah, dari kode lama), forgery
payment_status untuk order gateway sudah ditutup di Stage 23, dan sekarang
nominal QR juga divalidasi sebelum dipakai. Yang saya BELUM bisa pastikan:
apakah BuatQris sandbox punya perilaku lain yang cuma kelihatan saat volume
transaksi tinggi — itu di luar kendali kode NiagaBio.

## 2) Lacak pesanan: auto-refresh + tidak perlu isi WA berulang + warna status

- `track.html` sekarang polling ulang tiap 8 detik selama halaman terbuka —
  status berubah otomatis tanpa reload manual. Cuma re-render kalau status
  BERUBAH (supaya tidak flicker/reset scroll tiap 8 detik).
- Nomor WhatsApp yang berhasil dipakai disimpan di localStorage device itu
  (per order_group_id). Buka link tracking lagi atau reload halaman → nomor
  WA otomatis terisi dan langsung submit sendiri.
- Status sekarang ada badge warna jelas: kuning (menunggu/diproses), biru
  (siap kirim/ambil), hijau (selesai), merah (dibatalkan) — bukan cuma dot
  abu-abu di stepper.
- **Sengaja TIDAK pakai Supabase Realtime** (bukan keterbatasan, keputusan
  sadar): RLS `orders` memang sengaja tidak membuka akses `SELECT` ke
  `anon` (supaya data finansial seller tidak bocor ke publik). Realtime
  native untuk `anon` juga tetap kena RLS yang sama, jadi tidak akan
  berguna kecuali RLS dilonggarkan — yang justru membuka risiko baru.
  Polling ke RPC yang sudah aman jauh lebih simpel dan tidak menambah
  permukaan akses.

## 3) Tombol cart mengganggu baris link/sosial seller

Tombol cart di header (sebelah tombol share, satu baris dengan ikon
sosial/link custom seller) **dipindah jadi floating button** (pojok
kanan-bawah layar, mengambang di atas konten, tidak ikut struktur header
tema). Tidak sentuh markup `.public-social` sama sekali lagi — jadi tidak
akan pernah bentrok dengan link seller di tema manapun.

## 4) Bug scroll saat buka cart di HP (drawer tidak full height)

**Root cause**: cuma pakai `overflow:hidden` di `<body>` untuk kunci scroll
saat drawer terbuka — ini dikenal TIDAK cukup di Safari/Chrome mobile (iOS
khususnya), body tetap bisa ke-scroll di belakang overlay walau
`overflow:hidden` aktif.

**Fix**: saat drawer dibuka, `<body>` di-set `position:fixed` dengan
`top` negatif sebesar posisi scroll saat itu (mengunci posisi beneran, bukan
cuma overflow), lalu saat drawer ditutup posisi scroll dikembalikan persis
seperti semula. Ini pola standar untuk scroll-lock yang benar-benar aman di
mobile Safari.

## File yang berubah (Stage 23 TIDAK ikut berubah lagi)

- `api/payment/create.js` — guard nominal provider vs amount diminta
- `assets/js/cart.js` — floating button + scroll-lock fix
- `assets/js/public-page.js` — revert tombol header, pakai `NBCart.mountFab`
- `assets/js/order-tracking.js` — polling, remember WA, badge warna
- `assets/css/v2/cart.css` — style floating button (ganti dari header badge)
- `assets/css/v2/tracking.css` — style badge warna status

## Setup

1. Copy 6 file di atas, timpa path yang sama di repo (Stage 23 harus sudah
   live duluan — patch ini di atasnya, bukan pengganti).
2. Tidak ada SQL baru untuk stage ini.
3. Deploy, lalu test ulang skenario yang sama (cart 2 produk → checkout).

## Belum teruji

- Saya tidak bisa memverifikasi langsung apakah guard nominal di poin 1
  akan trigger terus di akun BuatQris kamu — tergantung limit sandbox yang
  cuma bisa dicek dari dashboard/CS BuatQris.
- Floating button belum dicek visual di 10 tema (kemungkinan besar aman
  karena posisinya fixed & lepas dari markup tema, tapi tolong cek sekilas).
