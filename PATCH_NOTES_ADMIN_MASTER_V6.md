# NiagaBio Admin Master UI v6

Patch ini fokus ke Admin Master saja. SQL, config Supabase, dan logic utama tidak diubah.

## File utama yang diubah

- `admin.html`
- `assets/js/admin.js`
- `assets/css/main.css`

## Perubahan

- Admin Master dibuat lebih beda dari dashboard user.
- Tambah refresh button.
- Tambah statistik: total user, premium, free, blocked, total order, omset paid.
- Tambah status sistem: maintenance, register, harga premium.
- Tambah filter user: search, plan, status.
- Tambah filter order: search dan status.
- Tambah modal detail user.
- Tombol upgrade premium bisa pilih durasi hari.
- Admin master tidak bisa memblokir/mengubah plan dirinya sendiri dari panel.
- JS admin tidak lagi mengandalkan global id HTML, lebih aman dari bug browser.
- Tampilan mobile admin dibuat lebih rapi.

## Cek yang sudah dilakukan

- Semua file JS di `assets/js` lolos `node --check`.
- Zip berhasil dibuat ulang.

## Cara pakai

1. Upload/push semua file ke GitHub.
2. Deploy ulang Vercel.
3. Buka website pakai incognito atau clear site data.
4. Login admin.
5. Buka `admin.html`.
