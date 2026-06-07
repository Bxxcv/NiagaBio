# NiagaBio Production Checklist

Gunakan checklist ini sebelum promosi ke user baru.

## Supabase
- [ ] Email provider ON.
- [ ] Confirm email OFF untuk testing, ON lagi jika SMTP sudah siap.
- [ ] `supabase/01_schema_clean_run_this.sql` sudah sukses.
- [ ] `supabase/02_bootstrap_admin_after_signup.sql` sudah sukses untuk akun owner.
- [ ] Patch `03_fix_theme_setter.sql` dan `04_upgrade_requests_admin_tools.sql` sudah sukses.
- [ ] Tidak ada service role key di frontend.

## Config
- [ ] `assets/js/config.js` sudah berisi SUPABASE_URL project aktif.
- [ ] `SUPABASE_ANON_KEY` memakai anon/publishable key, bukan service role.
- [ ] `DEMO_MODE: false`.
- [ ] `ADMIN_EMAIL` sesuai email owner.

## Testing Flow
- [ ] Admin bisa login ke `/admin`.
- [ ] User Free tidak bisa buka admin.
- [ ] User Free bisa kirim request Premium.
- [ ] Admin bisa approve/reject request Premium.
- [ ] User Premium bisa ganti tema.
- [ ] Produk tampil di public page.
- [ ] Checkout membuat order pending.
- [ ] Seller bisa confirm selesai/batal.
- [ ] Rekap penjualan dan export CSV jalan.
- [ ] Maintenance mode dites dari incognito/non-admin.

## Konten
- [ ] QRIS Premium admin sudah diisi.
- [ ] Harga premium benar.
- [ ] WhatsApp admin benar.
- [ ] Halaman privacy, terms, dan refund sudah dibaca ulang.

## Final Hardening
- [ ] Deploy terakhir sudah memakai zip/source terbaru.
- [ ] `vercel.json` sudah ikut ter-upload.
- [ ] `/privacy`, `/terms`, `/refund`, `/robots.txt`, `/sitemap.xml`, dan `/site.webmanifest` bisa dibuka.
- [ ] Legal page tidak menampilkan error console walau tidak memuat Supabase client.
- [ ] Test dari incognito setelah clear cache.


## Security Hardening v24

Setelah schema utama berjalan, jalankan juga `supabase/06_security_hardening.sql` di Supabase SQL Editor untuk memperketat storage policy, upload file, premium request, dan admin self-protection. Untuk fresh install, hardening ini sudah disertakan di akhir `supabase/01_schema_clean_run_this.sql`, tetapi file 06 tetap aman dijalankan ulang.
