# NiagaBio Production Readiness

Dokumen ini fokus untuk menyiapkan NiagaBio agar lebih aman dipakai banyak seller tanpa mengubah framework dan tanpa merusak alur static HTML/CSS/JS + Supabase.

## Target Awal

- Paket saat ini: Supabase Free.
- Target realistis tahap awal: 1.000 seller.
- Risiko utama: bukan Vercel, tapi query tanpa limit, storage gambar, dan data order/notifikasi yang terus tumbuh.

## Status Fondasi

Yang sudah bagus:

- Landing dan halaman utama berupa static file, jadi ringan di Vercel.
- Order public sudah diarahkan lewat RPC `create_public_order`.
- Bukti pembayaran baru diarahkan ke bucket private `niagabio-private`.
- RLS dan function admin sudah dibuat.
- Ada audit log untuk perubahan sensitif.
- Ada CSP dan security header dasar di `vercel.json`.

Yang masih perlu diperkuat:

- Pagination untuk `orders`, `admin`, dan list data besar.
- Server-side filtering untuk admin search dan order filter.
- Cleanup data lama untuk notifications, audit logs, dan storage bukti bayar.
- Monitoring usage Supabase dan Vercel.
- Kompresi gambar sebelum upload.

## Cara Cek Patch Supabase

Jalankan file:

```text
supabase/19_production_readiness_audit.sql
```

Di Supabase SQL Editor. File itu read-only, jadi aman untuk dicek kapan saja.

Hasil yang harus diperhatikan:

- `12_summary.core_security_ready` harus `true`.
- `06_storage_buckets` harus menunjukkan `niagabio-private` dengan `is_public = false`.
- `05_orders_policy_check` semua kolom sebaiknya `true`.
- `11_red_flags` sebaiknya semua count kritikal `0`.
- `09_row_counts` dipakai untuk melihat tabel mana yang mulai besar.
- `10_storage_usage` dipakai untuk melihat folder storage mana yang makan ruang.

## Prioritas Teknis

### P0 - Wajib Sebelum Promosi Besar

1. Tambah pagination untuk order seller.
2. Ubah admin panel agar tidak mengambil semua `profiles`, `orders`, dan `products` sekaligus.
3. Tambah limit default di helper `NB.list()`.
4. Tambah cleanup notifikasi lama.
5. Pastikan SQL audit core security sudah hijau.

### P1 - Setelah P0 Aman

1. Optimasi public store agar produk tampil bertahap.
2. Tambah kompresi gambar sebelum upload.
3. Tambah usage warning di dashboard admin.
4. Tambah export data yang tidak memaksa browser render semua row.
5. Tambah indeks gabungan sesuai filter yang paling sering dipakai.

### P2 - Jangka Panjang

1. Arsip order lama ke tabel terpisah.
2. Retensi audit log 6-12 bulan.
3. Retensi bukti bayar sesuai kebutuhan operasional.
4. Upgrade Supabase Pro ketika data/user mulai mendekati batas Free.
5. Tambah observability sederhana: error log, slow page log, dan storage growth log.

## Rekomendasi Struktur Folder

Jangan langsung memindahkan file HTML utama karena route Vercel dan path relatif bisa pecah. Struktur rapi yang aman dilakukan bertahap:

```text
/
  index.html
  pages/
    login.html
    register.html
    dashboard.html
    products.html
    orders.html
    u.html
    checkout.html
  admin.html
  assets/
    css/
      landing.css
      main.css
      bot.css
    js/
      config.js
      supabase-client.js
      common.js
      landing.js
      dashboard.js
      products.js
      orders.js
      admin.js
    img/
      brand/
      products/
      preview/
      placeholders/
  api/
    share.js
  supabase/
    01_schema_clean_run_this.sql
    ...
    19_production_readiness_audit.sql
  docs/
    PRODUCTION_READINESS.md
    PROJECT_STRUCTURE.md
    UPDATE_GUIDE.md
```

Tahap struktur yang sudah aman dilakukan:

1. Gambar lokal dirapikan ke subfolder `assets/img/brand`, `assets/img/preview`, dan `assets/img/placeholders`.
2. HTML aplikasi dipindah ke `pages/`, dengan route bersih dijaga lewat `vercel.json`.
3. `index.html` tetap di root supaya homepage tetap mudah dibuka di SPCK/Acode.

Tahap berikutnya yang aman:

1. Pisahkan JS besar `supabase-client.js` menjadi modul kecil hanya kalau build system tidak dibutuhkan.
2. Tambahkan pagination untuk halaman data besar sebelum refactor UI lebih jauh.

## Catatan Untuk 1.000 Seller

Dengan aturan Free dan Premium yang sudah ada, 1.000 seller masih masuk akal secara arsitektur jika:

- setiap list besar dipaginasi,
- gambar dikompres,
- bukti bayar tidak disimpan selamanya tanpa retensi,
- admin panel tidak load semua data,
- penggunaan Supabase dipantau.

Supabase Free cocok untuk validasi awal. Untuk produksi serius dengan seller aktif dan upload bukti bayar rutin, siapkan rencana upgrade saat storage/database mulai mendekati batas.
