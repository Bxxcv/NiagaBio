# Stage 17 - Production Guard + Demo/localStorage Lockdown

Patch ini dibuat untuk menutup temuan audit Qwen terkait fallback localStorage/demo yang berpotensi aktif di production.

## Perubahan utama

- DEMO_MODE hanya boleh aktif di environment lokal (`file:`, `localhost`, `127.0.0.1`, `*.localhost`).
- DEMO_MODE otomatis diabaikan di domain production/Vercel.
- Jika Supabase gagal siap di production, aplikasi tidak lagi diam-diam masuk mode localStorage/demo.
- Fallback localStorage hanya berjalan jika `DEMO_MODE: true` dan halaman dibuka dari environment lokal.
- Data URL image hanya diterima untuk local demo, bukan production.
- Admin email tidak lagi dipakai untuk otorisasi production. Admin tetap harus berasal dari database/RLS.
- Jika database belum siap, user melihat warning jelas, bukan data demo palsu.

## File berubah

- `assets/js/config.js`
- `assets/js/supabase-client.js`

## Tidak ada SQL baru

Patch ini tidak mengubah database. Tidak perlu menjalankan SQL di Supabase.

## Checklist test

1. Deploy ke Vercel.
2. Login seller normal.
3. Buka dashboard.
4. Buka toko publik `/u?username=demo-account`.
5. Test checkout produk.
6. Test upload bukti bayar.
7. Test dashboard orders.
8. Pastikan tidak ada data demo/localStorage yang muncul di production.
9. Matikan CDN/Supabase hanya untuk simulasi lokal jika perlu; production harus menampilkan warning database, bukan mode demo.
