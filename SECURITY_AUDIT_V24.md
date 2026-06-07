# NiagaBio v24 Security Hardening

## A. Ringkasan status keamanan

### Aman
- Admin role utama memakai `profiles.role` dari database, bukan `ADMIN_EMAIL` frontend.
- `is_admin()` memakai `SECURITY DEFINER` sehingga aman dari recursion RLS.
- User biasa dikunci dari field system: `role`, `plan`, `status`, `plan_end_date`.
- Order awal dipaksa `pending`; harga/nama produk dihitung dari database melalui trigger.
- Free/Premium gate dikunci database untuk produk, link, social, gallery, checkout QRIS/manual, dan tema premium.

### Perlu diperbaiki dan sudah dipatch di v24
- Storage policy lama terlalu longgar (`with check (bucket_id = 'niagabio')`).
- Upload file masih menerima GIF/SVG.
- User bisa menulis URL berbahaya kalau render memakai `href` langsung.
- Admin RPC belum menolak perubahan role/plan/status akun sendiri.
- Premium request perlu dikunci agar hanya Free aktif yang bisa membuat request.

### Butuh perhatian operasional
- `allow_register` di `app_settings` adalah gate frontend. Untuk hard lock register, matikan juga dari Supabase Auth Dashboard.
- Bukti order di folder `proofs` masih public-read karena bucket `niagabio` public. Jangan gunakan untuk data yang sangat sensitif.
- Hapus user tetap soft delete. Hapus permanen `auth.users` harus manual dari Supabase Dashboard atau backend server-side.

## B. Daftar temuan

### Critical
- Storage insert policy lama terlalu bebas. Sudah dipatch dengan folder scoped policy.
- Upload SVG/GIF bisa membuka risiko XSS/abuse file. Sudah ditolak di frontend dan storage policy.

### High
- URL user untuk `href`/`src` perlu sanitizer khusus. Sudah ditambah `safeHref()` dan `safeImageUrl()`.
- Admin RPC sekarang menolak update akun sendiri.
- Premium request sekarang hanya Free aktif, status awal pending, dan wajib bukti dari folder user.

### Medium
- CSP/security headers ditambah di `vercel.json`.
- Order insert frontend diperkecil agar tidak mengirim field computed seperti `product_name`, `total_price`, `paid_at`.

### Low
- Input file HTML dibatasi ke `image/jpeg,image/png,image/webp`.
- Inline script landing dipindah ke `assets/js/landing.js` agar CSP lebih aman.

## C. File yang diubah

- `assets/js/supabase-client.js`
- `assets/js/public-page.js`
- `assets/js/checkout.js`
- `assets/js/orders.js`
- `assets/js/products.js`
- `assets/js/gallery.js`
- `assets/js/links.js`
- `assets/js/social.js`
- `assets/js/profile.js`
- `assets/js/checkout-settings.js`
- `assets/js/upgrade.js`
- `assets/js/admin.js`
- `assets/js/themes.js`
- `assets/js/landing.js`
- `index.html`
- file HTML form upload
- `vercel.json`
- `supabase/01_schema_clean_run_this.sql`
- `supabase/06_security_hardening.sql`
- `SETUP_SUPABASE_DARI_NOL.md`
- `PRODUCTION_CHECKLIST.md`

## D. Patch final

- SQL patch final: `supabase/06_security_hardening.sql`
- SQL fresh install: `supabase/01_schema_clean_run_this.sql` sudah menyertakan hardening v24 di akhir.
- JS patch final: sanitizer URL/image dan upload file aman di `assets/js/supabase-client.js`.
- Header patch final: `vercel.json`.

## E. Cara menjalankan patch

Untuk database yang sudah berjalan:
1. Buka Supabase SQL Editor.
2. Jalankan `supabase/06_security_hardening.sql`.
3. Deploy source v24 ke Vercel.
4. Clear cache / tes incognito.

Untuk setup dari nol:
1. Jalankan `supabase/01_schema_clean_run_this.sql`.
2. Buat admin dari Supabase Auth.
3. Jalankan `supabase/02_bootstrap_admin_after_signup.sql`.
4. Deploy source v24.

## F. Checklist test manual

- Admin login `/admin`.
- Admin tidak bisa blokir/hapus/update role dirinya sendiri.
- User Free tidak bisa gallery, QRIS/manual checkout, atau tema premium.
- User Premium bisa gallery, QRIS/manual checkout, dan tema premium.
- Upload avatar/produk/gallery/qris/proof hanya JPG/PNG/WEBP max 3MB.
- Link custom `javascript:` harus ditolak/dinormalisasi.
- Order dari public page masuk `pending`.
- Direct API insert order dengan `paid` harus mental ke `pending`.
- Seller bisa tandai pesanan selesai/batal.
- Buyer/public tidak bisa update order.
- Premium request hanya user Free aktif.
- Maintenance mode dari browser non-admin.
- Public page `/u?username=...` tetap tampil.

## G. Catatan tanpa teori panjang

Patch ini fokus security final, bukan redesign. Jika ada error dari storage saat upload, cek dulu apakah `06_security_hardening.sql` sudah benar-benar sukses dijalankan.
