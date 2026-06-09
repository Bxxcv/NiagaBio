# NiagaBio v35 - Floating Help Menu Responsive Fix

Perbaikan dari v34 berdasarkan screenshot mobile:

- Floating menu kanan bawah dibuat compact, tidak full-width di HP kecil.
- Panel menu sekarang muncul tepat di atas tombol hamburger/X, bukan terlalu tinggi sampai menutup header.
- Ukuran icon, teks, padding, gap, dan border-radius diperkecil supaya enak di semua device.
- Chat bot panel dibatasi tinggi dengan `100dvh` supaya tidak keluar layar.
- Tambah outside click close.
- Tambah guard anti horizontal overflow: `html/body max-width:100%`, `overflow-x:hidden`, dan box-sizing global di landing body.
- Tidak ubah Supabase, database, admin, checkout, orders, atau security.

File diubah:

- `assets/css/landing.css`
- `assets/js/landing.js`

Tidak perlu run SQL.
