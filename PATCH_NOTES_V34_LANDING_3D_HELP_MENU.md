# NiagaBio v34 - Landing 3D + Intro Troli + Floating Help Menu

## Fokus
Upgrade hanya landing page agar lebih punya karakter tanpa mengubah sistem utama.

## File yang diubah
- `index.html`
- `assets/css/landing.css`
- `assets/js/landing.js`

## Perubahan
- Tambah intro animasi troli menabrak lembut nama NiagaBio.
- Intro hanya muncul sekali per sesi browser memakai `sessionStorage`.
- Tambah hero 3D ringan berbasis CSS, bukan Three.js.
- Tambah floating menu kanan bawah: garis 3 berubah jadi X saat dibuka.
- Isi floating menu: Chat Bot FAQ, Chat Admin WhatsApp, Daftar Gratis.
- Chat Bot masih FAQ statis agar ringan dan aman.
- Support `prefers-reduced-motion` untuk user yang tidak ingin animasi.

## Yang tidak disentuh
- Supabase schema/RLS
- Admin master
- Dashboard seller
- Checkout/order
- Auth/login/register
- Config Supabase

## SQL
Tidak ada SQL baru.
