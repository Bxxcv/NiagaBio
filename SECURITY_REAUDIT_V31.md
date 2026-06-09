# NiagaBio v31 - Security Re-Audit Final

Patch ini fokus keamanan, bukan redesign.

## Status singkat

- Critical: ditemukan potensi SQL syntax error di policy storage delete v24 (`06_security_hardening.sql`) karena baris `premium-qris` terduplikasi. Sudah diperbaiki.
- High: direct API masih bisa menyimpan sebagian URL/gambar yang tidak ideal walaupun frontend sudah aman. Ditambah trigger validasi v31 di database.
- Medium: local demo seed masih menulis akun demo ke localStorage meski Supabase aktif. Sekarang demo seed hanya jalan saat Supabase tidak aktif.
- Low: validasi panjang teks user dibuat lebih ketat agar UI tidak rusak akibat input terlalu panjang.

## File penting yang berubah

- `assets/js/supabase-client.js`
- `supabase/01_schema_clean_run_this.sql`
- `supabase/06_security_hardening.sql`
- `supabase/08_security_reaudit_final.sql`
- `SECURITY_REAUDIT_V31.md`

## Yang diperkuat

1. Storage policy bucket `niagabio` dibuat ulang dengan scope folder:
   - `avatars/{uid}`
   - `products/{uid}`
   - `gallery/{uid}`
   - `qris/{uid}`
   - `premium-proofs/{uid}`
   - `premium-qris/{admin_uid}`
   - `proofs/random-file`

2. Database validasi direct API:
   - URL custom link/social harus aman.
   - Image URL produk/gallery/avatar/QRIS/bukti bayar harus aman.
   - Text user dibatasi panjangnya.
   - Harga produk dibatasi agar tidak ekstrem.
   - Nomor HP/WA dinormalisasi.
   - Link notifikasi dibatasi ke route internal aman.

3. Frontend hardening:
   - Central payload sanitizer ditambahkan di `NB.save()`.
   - Demo seed tidak jalan saat Supabase production aktif.
   - Upload tetap JPG/PNG/WEBP, max 3MB, path random, `upsert:false`.

## Cara menjalankan patch

Jika database sudah jalan dari versi sebelumnya, jalankan:

```txt
supabase/08_security_reaudit_final.sql
```

Jika setup database dari nol, cukup jalankan:

```txt
supabase/01_schema_clean_run_this.sql
```

Karena patch v31 sudah ditempel di akhir schema utama.

## Checklist test manual

1. Login admin `/admin`.
2. Login user Free, tambah link valid `https://example.com`.
3. Coba input link `javascript:alert(1)` → harus ditolak.
4. Upload produk JPG/PNG/WEBP → sukses.
5. Upload GIF/SVG → ditolak.
6. Upload QRIS Premium dari admin → sukses.
7. User Free kirim request Premium + bukti transfer → sukses.
8. Admin approve request → user jadi Premium.
9. User Premium upload gallery/QRIS → sukses.
10. Checkout dari incognito → order masuk pending.
11. Seller tandai selesai/batal → sukses.
12. Buka public page `/u?username=...` → tetap normal.

## Catatan batas keamanan

Patch ini memperkuat sisi frontend + Supabase RLS/trigger/storage. Tidak ada sistem web yang bisa dijamin 100% tidak bisa dibobol. Untuk produksi serius, tetap aktifkan:

- password kuat untuk akun admin,
- 2FA akun Supabase/GitHub/Vercel,
- backup database rutin,
- custom SMTP,
- monitoring log Supabase,
- jangan pernah taruh `service_role` key di frontend.
