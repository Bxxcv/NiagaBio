# NiagaBio

NiagaBio adalah web app **link-in-bio + katalog produk + checkout manual + dashboard seller** untuk UMKM, seller online, dan creator yang ingin punya satu link rapi untuk jualan.

## Ringkasan
NiagaBio membantu user untuk:
- membuat halaman profil/toko publik
- menampilkan produk dan katalog
- mengarahkan pembeli ke checkout / pembayaran manual
- mengelola data toko dari dashboard
- mengatur tampilan agar sesuai branding

Project ini dirancang agar:
- ringan
- mobile-first
- mudah dipakai dari HP
- tidak terasa seperti website template generik

## Tech stack
- HTML
- CSS vanilla
- JavaScript vanilla
- Supabase
- Vercel

## Deploy
- Production: `https://niaga-bio.vercel.app`
- Repository: `https://github.com/Bxxcv/NiagaBio`

## Catatan penting
- Project ini **bukan** React / Next.js / Vue app.
- Project ini **bukan** backend monolith custom.
- Logika data utama ada di Supabase.
- Routing publik dan serverless helper mengikuti konfigurasi Vercel.

## Struktur umum
- `index.html` → landing page
- `login.html`, `register.html`, `reset-password.html` → auth
- `dashboard.html`, `profile.html`, `products.html`, `orders.html`, `themes.html`, dll → dashboard seller
- `u.html` → halaman publik toko/user
- `checkout.html` → checkout publik
- `https://chat-bot-niaga-bio-six.vercel.app` → bantuan/chat
- `assets/` → CSS, JS, image, icon
- `supabase/` → SQL schema, RLS, security, audit, patch
- `docs/` → dokumentasi internal
- `api/` → serverless function untuk fitur tertentu

## Alur user
### User baru
1. buka landing page
2. daftar akun
3. isi profil toko
4. tambah produk
5. atur link / tema / checkout
6. bagikan link publik toko

### Pembeli
1. buka link toko publik
2. lihat profil dan produk
3. pilih produk
4. lanjut checkout
5. ikuti instruksi pembayaran

### Seller
1. login
2. buka dashboard
3. update profil
4. kelola produk
5. cek order
6. ubah tema dan halaman publik

## Konsep produk
Nilai utama NiagaBio adalah:
> “Satu link untuk tampil rapi, jualan lebih jelas, dan bikin pembeli lebih mudah order.”

## Prinsip desain
- jelas dalam 5 detik
- tidak membingungkan user awam
- tampilan profesional
- tidak terlalu ramai
- tidak terlalu kaku
- tetap nyaman di HP

## File penting untuk developer/AI
Kalau mau memahami project dengan cepat, baca:
- `READMEFORAI.md`
- `docs/PROJECT_STRUCTURE.md`
- `docs/DESAIN.md`
- `supabase/README.md`

## Pengembangan lokal
Project ini bisa dikerjakan dari:
- Acode
- SPCK Editor
- Termux

Hal yang paling sering diedit:
- HTML halaman
- CSS landing / main
- JS interaksi
- SQL Supabase

## Aturan aman saat update
- jangan ubah routing tanpa cek semua link
- jangan ubah Supabase schema tanpa cek RLS
- jangan hapus file lama yang masih dipakai halaman lain
- jangan mengubah nama file page tanpa update referensi di JS / rewrite

## Troubleshooting singkat
### Halaman 404
Biasanya karena:
- file HTML belum ada
- rewrite belum benar
- path salah
- file berada di folder yang salah

### Halaman publik blank
Biasanya karena:
- data user di Supabase belum ada
- RLS terlalu ketat
- username tidak cocok
- JS gagal mengambil data profil

### Login/register gagal
Biasanya karena:
- config Supabase salah
- auth redirect belum diset
- key/env belum cocok dengan production

### Tampilan tidak update
Biasanya karena:
- cache browser
- build/deploy belum refresh
- file yang diedit bukan file yang dipakai halaman

## Tujuan jangka panjang
NiagaBio diarahkan menjadi:
- landing yang jelas
- halaman publik toko yang enak dilihat
- dashboard seller yang simple
- solusi jualan yang gampang dipakai seller awam

## Lisensi / penggunaan internal
Dokumen ini adalah panduan internal project. Sesuaikan dengan kebutuhan repo dan deployment yang sedang aktif.
