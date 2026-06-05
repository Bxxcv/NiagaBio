# Setup Manual NiagaBio

## 1. Jalankan di local / GitHub

Project ini static HTML/CSS/JS. Tidak perlu npm.

Buka langsung:

```txt
index.html
```

Atau upload ke GitHub lalu deploy ke Vercel.

## 2. Mode Demo

Default project berjalan di DEMO MODE dengan localStorage agar tidak error meskipun Supabase belum disetup.

Login demo:

```txt
demo@niagabio.local
password: demo123
```

Admin demo:

```txt
unrageunrage@gmail.com
password: admin123
```

## 3. Setup Supabase

1. Buat project Supabase.
2. Buka SQL Editor.
3. Jalankan file:

```txt
supabase/schema.sql
```

4. Buat Storage bucket public bernama:

```txt
niagabio
```

5. Buka `assets/js/config.js`.
6. Ganti:

```js
SUPABASE_URL: "YOUR_SUPABASE_URL",
SUPABASE_ANON_KEY: "YOUR_SUPABASE_ANON_KEY",
DEMO_MODE: true
```

Menjadi:

```js
SUPABASE_URL: "https://xxxx.supabase.co",
SUPABASE_ANON_KEY: "anon-key-kamu",
DEMO_MODE: false
```

Jangan pernah masukkan service role key ke frontend.

## 4. Deploy Vercel

1. Push semua file ke GitHub.
2. Import repository ke Vercel.
3. Framework preset: Other.
4. Build command: kosongkan.
5. Output directory: kosongkan / root.
6. Deploy.

## 5. Alur Fitur

- User daftar otomatis Free.
- Free dibatasi 2 tema, 5 produk, 5 link, 3 sosial media.
- Premium dibuka lewat admin panel.
- QRIS manual hanya untuk Premium.
- Pesanan QRIS masuk ke dashboard seller.
- Seller klik Paid agar omset bertambah.
