# NiagaBio Public Theme v10

Fokus patch:
- Public page `/u` dibuat ulang supaya tampilan toko lebih profesional.
- Theme sekarang benar-benar beda secara visual, bukan cuma berubah warna kecil.
- Jika membuka `/u` saat sedang login, halaman menampilkan toko akun yang sedang login.
- Untuk public visitor tetap gunakan `/u?username=USERNAME`.
- Halaman theme diberi tombol preview agar tidak keliru membuka `/u` kosong.
- Link preview demo di sidebar otomatis diganti ke username akun login jika profile tersedia.

File yang berubah:
- `u.html`
- `assets/js/public-page.js`
- `assets/js/themes.js`
- `assets/js/common.js`
- `assets/css/main.css`

Tidak diubah:
- SQL Supabase
- config Supabase
- Admin Master logic
- Dashboard user logic utama
