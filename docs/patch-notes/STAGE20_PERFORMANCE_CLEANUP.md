# Stage 20 - Performance Cleanup + Struktur Project

Fokus tahap ini adalah merapikan project tanpa mengubah alur inti yang sudah aman.

## Perubahan

- Dokumentasi root dirapikan ke folder `docs/`.
- Ditambahkan `docs/PROJECT_STRUCTURE.md` agar file mudah dicari.
- Ditambahkan `docs/UPDATE_GUIDE.md` agar proses replace/deploy lebih aman.
- Ditambahkan `supabase/README.md` sebagai panduan urutan SQL.
- `README.md` diperbarui sesuai status terbaru: private proof storage, production guard, audit log, dan share endpoint.
- `vercel.json` ditambah cache header aman-update untuk assets, favicon, manifest, robots, dan sitemap. Assets tidak dibuat immutable karena file belum memakai nama hash.
- `robots.txt` diperketat agar dashboard/auth/checkout tidak diindex.
- Demo seed lokal dibersihkan: contoh order tidak lagi memakai `payment_method: whatsapp` tanpa bukti.
- `.gitignore` diperluas untuk `.vercel`, `.env.*`, log, dan file OS.

## Tidak diubah

- Tidak mengubah Supabase URL/anon key.
- Tidak mengubah RLS production.
- Tidak mengubah alur checkout yang sudah wajib RPC dan bukti bayar.
- Tidak mengubah desain landing/dashboard secara besar.
- Tidak memindahkan file runtime HTML/CSS/JS utama.

## Test yang dilakukan

- Semua JS dicek dengan `node --check`.
- Semua referensi asset lokal dari HTML dicek ada.
- Struktur folder dicek ulang.
- ZIP full project dan patch dibuat terpisah.
