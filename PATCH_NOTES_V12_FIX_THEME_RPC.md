# NiagaBio v12 - Fix Theme Premium Tidak Berubah

Perubahan aman:
- Tambah RPC Supabase `set_profile_theme(new_theme)`.
- Themes page tidak lagi mengubah theme lewat `upsert profiles`.
- Akun premium/admin bisa ganti theme langsung lewat RPC.
- Tambah migration: `supabase/03_fix_theme_setter.sql`.

Wajib dijalankan di Supabase kalau database sudah terlanjur setup dari versi lama:
1. Buka Supabase SQL Editor.
2. Jalankan `supabase/03_fix_theme_setter.sql`.
3. Deploy source v12.
4. Logout/login akun demo premium.
5. Coba pilih tema lagi.
