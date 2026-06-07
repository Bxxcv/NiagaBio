# NiagaBio v14 - Admin Split + Public Theme Upgrade

Perubahan utama:
- Admin Master dipisah per menu/tab: Ringkasan, User, Order, Request, Setting.
- Admin tidak lagi menampilkan semua section sekaligus.
- Sidebar admin dan tab atas sekarang mengontrol view aktif tanpa scroll panjang.
- Public shop template dibuat lebih berbeda: layout, font, bentuk kartu, dan style produk ikut berubah.
- Public shop footer ditambah copyright toko dan Powered by NiagaBio.
- Halaman theme punya preview template yang lebih representatif.

File yang diubah:
- admin.html
- u.html
- assets/js/admin.js
- assets/js/public-page.js
- assets/js/themes.js
- assets/js/supabase-client.js
- assets/css/main.css

Tidak mengubah:
- config Supabase
- SQL/RLS
- fitur upgrade request v13
- fitur theme RPC v12
