# NiagaBio v13 - Upgrade Request, Recap, Admin Delete, Checkout Back

## Wajib untuk database yang sudah pernah setup
Jalankan SQL baru:

`supabase/04_upgrade_requests_admin_tools.sql`

Patch ini menambah:
- `app_settings.premium_qris_url`
- `app_settings.premium_note`
- tabel `premium_requests`
- status profile baru `deleted` untuk soft delete user
- RPC `admin_review_premium_request()`
- RPC `admin_soft_delete_user()`

## Fitur baru
- Checkout punya tombol kembali ke toko.
- Public gallery dibuat compact/horizontal agar tidak terlalu memenuhi halaman.
- User Premium tidak lagi melihat menu Upgrade/Beli Premium.
- User Free bisa mengajukan upgrade Premium dengan QRIS, nama toko, nama pemilik, bukti transfer, dan catatan.
- Admin Master bisa upload/set QRIS Premium.
- Admin Master bisa approve/reject request Premium.
- Admin Master bisa hapus user secara soft delete.
- Admin Master bisa hapus produk user dari modal detail user.
- Halaman Pesanan user punya rekap omzet, order, nominal pending, rata-rata order, produk terlaris, dan rekap produk terjual.

## Catatan hapus user
Frontend tidak memakai service_role key, jadi tidak menghapus akun `auth.users` secara permanen. Tombol Hapus User memakai soft delete:
- profile status = `deleted`
- plan = `free`
- toko disembunyikan dari public
- data produk/link/social/gallery/checkout user dibersihkan
- akun Auth di Supabase tetap ada dan bisa dihapus manual dari Supabase Dashboard jika perlu.
