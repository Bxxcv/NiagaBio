# Update Guide — NiagaBio

Gunakan panduan ini untuk perubahan source tanpa merusak flow existing.

## Wajib sebelum edit

1. Baca `PRD.md` dan `SkilAi.md`.
2. Baca `Folder-structure.md`.
3. Tentukan file owner fitur.
4. Cek dependency HTML → JS → CSS → Supabase bila relevan.
5. Jangan ubah file lain yang tidak dibutuhkan.

## Urutan debugging

```text
Reproduce
→ HTML/DOM
→ CSS/JS asset loading
→ event/data flow
→ Network
→ Supabase/RLS
→ patch akar masalah
→ regression test
```

Untuk masalah visual, selalu cek asset CSS/JS yang benar-benar loaded sebelum menyimpulkan masalah database.

## Aturan Supabase

- Jangan run `01_schema_clean_run_this.sql` ulang di production.
- Jangan disable RLS.
- Jangan gunakan service-role key di frontend.
- Patch baru harus dibaca sebelum dijalankan.
- Audit read-only dapat dipakai untuk verifikasi.

## Setelah perubahan

### Frontend
- syntax JS valid
- tidak ada asset path yang rusak
- halaman target terbuka
- flow utama terkait tetap berjalan

### Seller
- login
- profile
- products
- links/social/gallery
- theme
- checkout settings
- orders

### Public
- public store tampil
- theme class diterapkan
- product/link tampil
- checkout dapat dibuka

### Admin
- access control
- premium review
- user management
- settings
- audit log

## Rollback

Jika bug fatal:

1. rollback deployment Vercel ke deployment sehat
2. jangan rollback SQL secara membabi buta
3. simpan error, screenshot, dan patch terakhir
4. analisis root cause sebelum patch berikutnya
