# Update Guide NiagaBio

Panduan ini dipakai setiap kali mengganti file supaya update tidak merusak login, checkout, RLS, atau dashboard.

## Urutan update aman

1. Download/backup ZIP project yang sedang jalan.
2. Baca daftar file berubah dari patch.
3. Replace file sesuai path yang sama.
4. Kalau patch membawa file SQL baru, jalankan SQL itu di Supabase SQL Editor.
5. Deploy ulang ke Vercel.
6. Test flow utama.

## Jangan dilakukan

- Jangan run ulang `supabase/01_schema_clean_run_this.sql` di database production yang sudah berisi data.
- Jangan masukkan `service_role` key ke `assets/js/config.js`.
- Jangan ubah `role`, `plan`, `status`, `plan_end_date` dari frontend.
- Jangan mematikan RLS untuk debugging production.
- Jangan mengaktifkan `DEMO_MODE` di domain production.

## Checklist setelah deploy

### Seller

- Login berhasil.
- Dashboard terbuka.
- Profil toko bisa disimpan.
- Produk bisa ditambah/edit/hapus.
- Upload gambar produk berhasil.
- Link/social/gallery tetap tampil.
- QRIS setting bisa disimpan.

### Pembeli

- Toko publik `/u?username=...` tampil.
- Share toko/produk `/s/...` tampil dan redirect benar.
- Checkout wajib upload bukti bayar.
- Order masuk dashboard seller.

### Admin

- Admin page terbuka hanya untuk admin.
- Approve/reject premium berjalan.
- Bukti premium private bisa dibuka.
- Block/unblock user berjalan.
- Maintenance/register setting berjalan.
- Audit log tercatat.

### Security quick check

Jalankan query audit read-only jika ragu:

```txt
supabase/14_readonly_security_regression_audit.sql
```

Red flag yang wajib dicek:

- `RLS_DISABLED`
- `ORDER_DATA_RISK`
- policy update/delete public tanpa `is_admin()` atau owner check
- storage proof public untuk upload baru

## Cara rollback

Kalau setelah deploy ada bug fatal:

1. Revert deployment di Vercel ke versi sebelumnya.
2. Jangan langsung rollback SQL kecuali tahu dampaknya.
3. Kirim error console, screenshot, dan file patch terakhir untuk dianalisis.
