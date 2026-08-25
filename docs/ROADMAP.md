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

Status saat ini: **planning payment gateway otomatis; implementasi belum dimulai**.

Keputusan provider:
```txt
BuatQris = payment gateway utama untuk seller Free + Premium
```

Model fee Admin Master:
```txt
platform_fee       = default Rp1.000 / transaksi
withdrawal_reserve = default Rp2.500 / transaksi
```

Catatan: reserve Rp2.500 adalah bagian dari model bisnis/ledger NiagaBio untuk membantu menutup biaya withdrawal seller; jangan mengklaim itu sebagai fee transaksi provider. `gateway_fee` harus mengikuti response/settlement BuatQris.

### Tahap 5A — Audit fondasi
```txt
- Audit schema orders saat ini.
- Audit app_settings.
- Audit RLS/functions create_public_order.
- Tentukan snapshot ledger fields.
```

### Tahap 5B — Ledger + Admin Master Finance
```txt
- platform_fee setting.
- withdrawal_reserve setting.
- premium revenue historis via approved_amount.
- seller transaction revenue via paid platform_fee.
- gateway fee terpisah.
- seller earning terpisah.
```

### Tahap 5C — BuatQris Backend
```txt
- serverless create payment.
- webhook.
- status fallback.
- idempotency.
- signature verification.
- secret hanya di Vercel ENV.
```

### Tahap 5D — Checkout otomatis
```txt
Checkout → Create payment → QR/payment URL → Buyer bayar → Webhook → Order paid
```

### Tahap 5E — Rekonsiliasi
```txt
- Orders.
- Rekap/omset.
- Nota.
- Admin Master financial dashboard.
- Seller earning ledger.
```

### Tahap 5F — Sandbox + rollout
```txt
- success.
- expired.
- failed.
- duplicate webhook.
- invalid signature.
- amount mismatch.
- refresh/retry.
- mobile/desktop.
```

Detail ada di `docs/PAYMENT_GATEWAY_PLAN.md`.

Payout/disbursement otomatis, KYC, multi-provider, dan GoPay Merchant bukan scope MVP payment saat ini.

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

Urutan saat ini:

```txt
1. Audit schema/RLS/current checkout untuk payment.
2. Ledger + Admin Master platform fee / withdrawal reserve.
3. Backend BuatQris create/webhook/status.
4. Checkout payment otomatis.
5. Reconciliation: order, rekap, nota, seller earning.
6. Admin Master financial dashboard.
7. Sandbox + security/regression audit.
8. Soft launch 5–10 seller.
9. Google Search Console + domain custom + SEO lanjutan.
10. Feedback nyata dan iterasi.
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
❌ Jangan langsung payout/disbursement otomatis.
❌ Jangan langsung multi-provider payment.
❌ Jangan jadikan GoPay Merchant sebagai gateway marketplace utama.
❌ Jangan pindah framework.
❌ Jangan tambah library berat.
❌ Jangan hapus SQL patch lama tanpa paham efeknya.
❌ Jangan promosi besar sebelum soft launch.
❌ Jangan mengandalkan frontend untuk security.
```
