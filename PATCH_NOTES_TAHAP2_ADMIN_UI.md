# Patch Tahap 2 - Admin UI Separation

Perubahan:
- Admin link di sidebar user disembunyikan dari awal dengan `d-none` + guard CSS.
- Login admin otomatis diarahkan ke `admin.html`, user biasa tetap ke `dashboard.html`.
- `admin.html` dibuat lebih berbeda dari dashboard user: sidebar owner, hero admin, metric cards, tabel yang lebih rapi, setting box.
- Badge kanan atas untuk admin tampil `Admin`, bukan `Free/Premium`.

File diubah:
- admin.html
- assets/js/auth.js
- assets/js/common.js
- assets/css/main.css
- semua HTML dashboard app yang punya link admin: link admin diberi `d-none` agar tidak flicker ke user biasa.

Catatan:
- Tidak mengubah struktur besar.
- Tidak mengubah nama file utama.
- Tidak mengubah schema Supabase.
