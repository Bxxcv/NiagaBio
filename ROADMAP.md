# ROADMAP.md — Roadmap Pengembangan NiagaBio

Dokumen ini jadi pegangan agar pengembangan NiagaBio tidak lompat-lompat dan tidak merusak logic yang sudah jalan.

## Prinsip utama

- Tetap HTML/CSS/Vanilla JS.
- Tetap Supabase + Vercel.
- Jangan pindah ke React.
- Jangan rombak struktur besar.
- Jangan ubah nama file utama tanpa alasan kuat.
- Setiap fitur baru harus dites dengan akun admin, user Free, dan user Premium.
- Security dan RLS lebih penting dari tampilan.
- Jangan menaruh secret key di frontend.

## Status saat ini

NiagaBio sudah masuk tahap **production candidate** untuk soft launch kecil.

Fitur yang sudah ada:

```txt
✅ Landing page
✅ Register/login Supabase
✅ Dashboard seller
✅ Admin Master owner
✅ User Free/Premium
✅ Upgrade request via QRIS manual
✅ Approve/reject Premium
✅ Produk
✅ Link custom
✅ Social link
✅ Gallery Premium
✅ Template toko
✅ Public page /u?username=...
✅ Checkout QRIS manual
✅ Upload bukti pembayaran
✅ Pesanan pending/selesai/batal
✅ Rekap penjualan
✅ Export CSV
✅ Notifikasi in-app
✅ Maintenance mode
✅ Clean URL
✅ Legal pages
✅ SEO dasar
✅ Security hardening v31
```

## Fase 1 — Fondasi production

Status: selesai.

Yang sudah dikerjakan:

- Schema Supabase.
- RLS tabel utama.
- Role admin dari database.
- Protect system fields.
- App settings.
- Storage bucket.
- Theme RPC.
- Upgrade request.
- Reset sales recap.
- Notifications.
- Security hardening.

File penting:

```txt
supabase/01_schema_clean_run_this.sql
supabase/02_bootstrap_admin_after_signup.sql
supabase/06_security_hardening.sql
supabase/08_security_reaudit_final.sql
```

## Fase 2 — UX seller

Status: selesai dasar, masih bisa dipoles.

Fitur:

- Dashboard onboarding.
- Langkah berikutnya.
- Empty state.
- Produk/link/social/gallery.
- Public link otomatis.
- Pesanan dan rekap.

Peningkatan nanti:

```txt
- Bulk edit produk.
- Duplicate produk.
- Kategori produk lebih rapi.
- Produk aktif/nonaktif.
- Stok produk.
- Import CSV produk.
```

## Fase 3 — Admin Master

Status: selesai dasar.

Fitur:

- Ringkasan platform.
- Kelola user.
- Request Premium.
- Setting platform.
- Laporan platform.
- Soft delete user.
- Export CSV.

Peningkatan nanti:

```txt
- Audit log admin.
- Filter tanggal lebih lengkap.
- Riwayat perubahan plan user.
- Reminder Premium hampir expired.
- Broadcast pengumuman ke semua user.
- Dashboard growth user per minggu/bulan.
```

## Fase 4 — Notifikasi

Status: in-app notification sudah ada.

Saat ini:

- Notifikasi order baru.
- Notifikasi request Premium.
- Notifikasi approve/reject Premium.
- Badge angka.
- Halaman notifikasi.
- Tandai dibaca.

Peningkatan nanti:

```txt
- Realtime Supabase subscription.
- Filter notifikasi.
- Hapus notifikasi lama.
- Push notification PWA.
```

Catatan: push notification seperti aplikasi HP butuh service worker, permission browser, web push, dan idealnya backend/Edge Function. Jangan dikerjakan sebelum in-app notification benar-benar stabil.

## Fase 5 — Payment

Status saat ini: QRIS manual.

Alur sekarang:

```txt
Pembeli scan QRIS seller
→ pembeli upload bukti
→ seller cek manual
→ seller tandai selesai
```

Ini aman untuk MVP.

Rencana payment bertahap:

### Tahap 5A — QRIS manual lebih rapi

```txt
- QRIS seller tampil jelas.
- Upload bukti aman.
- Reminder cek bukti.
- Status pesanan jelas.
```

### Tahap 5B — Saldo internal seller

```txt
- Order selesai menambah estimasi saldo.
- Seller bisa reset periode rekap.
- Riwayat reset/pencairan manual.
- Admin bisa melihat laporan platform.
```

### Tahap 5C — Payment gateway otomatis

Butuh:

```txt
- Payment gateway QRIS dynamic.
- Supabase Edge Function/backend.
- Webhook payment status.
- Tabel payment_transactions.
- Signature verification.
- Order auto paid.
```

Jangan menaruh secret payment gateway di frontend.

### Tahap 5D — Payout/disbursement

Butuh:

```txt
- Data rekening seller.
- Verifikasi rekening/KYC.
- Disbursement API.
- Riwayat pencairan.
- Fee platform.
```

Ini level marketplace. Jangan dikerjakan sebelum model bisnis dan legalnya jelas.

## Fase 6 — SEO dan Google

Status: SEO dasar sudah ada.

Yang sudah ada:

- Title landing.
- Meta description.
- OG image.
- Favicon.
- `robots.txt`.
- `sitemap.xml`.
- Canonical URL.

Agar muncul di Google:

```txt
1. Daftar Google Search Console.
2. Verifikasi website.
3. Submit sitemap.xml.
4. Request indexing homepage.
5. Cek query site:niaga-bio.vercel.app.
6. Share link ke sosial media dan profil brand.
7. Buat konten tambahan jika ingin rank keyword umum seperti link bio.
```

Keyword target awal:

```txt
- NiagaBio
- niaga bio
- link bio toko
- link bio jualan
- katalog produk online
- katalog UMKM
- checkout QRIS manual
- link bio UMKM
```

Catatan: keyword brand seperti “NiagaBio” lebih mudah. Keyword umum seperti “link bio” jauh lebih berat karena saingan banyak.

Peningkatan SEO nanti:

```txt
- Domain custom.
- Halaman /link-bio untuk keyword link bio.
- Halaman /katalog-produk untuk keyword katalog produk.
- Halaman /qris-manual untuk keyword QRIS manual.
- Structured data Organization.
- Structured data SoftwareApplication.
- Artikel tutorial ringan.
```

## Fase 7 — Landing conversion

Status: sudah cukup untuk soft launch.

Peningkatan nanti:

```txt
- Tambah screenshot real dashboard.
- Tambah contoh toko dari user asli.
- Tambah testimoni.
- Tambah video pendek cara pakai.
- Tambah perbandingan Free vs Premium lebih jelas.
- Tambah CTA WhatsApp ke owner.
```

## Fase 8 — Keamanan lanjutan

Status: hardening dasar sudah ada.

Peningkatan nanti:

```txt
- Audit RLS berkala.
- Log aktivitas admin.
- Rate limit via Supabase/Edge Function jika butuh.
- Custom SMTP untuk Auth.
- Backup database rutin.
- Monitoring error frontend.
- Review dependency CDN.
- Penetration test manual direct API.
```

## Fase 9 — Domain dan branding

Prioritas tinggi sebelum promosi besar.

Rekomendasi:

```txt
- Beli domain custom: niagabio.id / niagabio.com / niagabio.my.id.
- Setup domain ke Vercel.
- Update canonical, sitemap, robots, OG URL.
- Daftarkan ulang domain di Google Search Console.
- Pakai email brand kalau memungkinkan.
```

Domain custom bikin brand lebih mudah dipercaya dan lebih enak dicari di Google.

## Fase 10 — Soft launch

Target:

```txt
5–10 seller kecil.
```

Jenis seller:

```txt
- Makanan rumahan.
- Thrift/fashion.
- Produk digital.
- Jasa desain.
- Seller marketplace.
- Affiliate.
```

Feedback yang dicari:

```txt
- Mereka bingung di halaman mana?
- Tombol mana yang kurang jelas?
- Apakah mau upgrade Premium?
- Apakah checkout manual cukup mudah?
- Apakah template toko cukup menarik?
- Apakah rekap pesanan berguna?
```

Jangan promosi besar sebelum soft launch selesai.

## Prioritas pengerjaan berikutnya

Urutan paling aman:

```txt
1. Google Search Console + sitemap.
2. Domain custom.
3. Custom SMTP Supabase.
4. Soft launch 5–10 seller.
5. Fix bug dari feedback nyata.
6. Perbaiki landing berdasarkan feedback.
7. Tambah konten SEO tambahan.
8. Baru pikirkan payment gateway otomatis.
```

## Checklist sebelum setiap deploy

```txt
1. Semua JS syntax valid.
2. Tidak ada service_role key.
3. DEMO_MODE false.
4. Admin masih bisa login.
5. User biasa tidak bisa /admin.
6. Public toko tampil.
7. Checkout jalan.
8. Request Premium jalan.
9. Upload file aman.
10. Mobile tidak overflow putih kanan.
```

## Hal yang jangan dilakukan dulu

```txt
❌ Jangan langsung payment gateway otomatis.
❌ Jangan langsung payout otomatis.
❌ Jangan pindah framework.
❌ Jangan tambah library berat.
❌ Jangan hapus SQL patch lama tanpa paham efeknya.
❌ Jangan promosi besar sebelum soft launch.
❌ Jangan mengandalkan frontend untuk security.
```
