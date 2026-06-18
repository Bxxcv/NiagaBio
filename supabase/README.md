# Supabase SQL Guide NiagaBio

Folder ini berisi schema, patch, audit, dan hardening database NiagaBio.

## Aturan penting

- Jangan run ulang `01_schema_clean_run_this.sql` di database production yang sudah ada data.
- Jalankan patch baru secara berurutan.
- File `14_readonly_security_regression_audit.sql` hanya audit/read-only.
- Backup database sebelum menjalankan patch besar.

## Fresh install dari nol

Untuk project Supabase baru:

1. Jalankan `01_schema_clean_run_this.sql`.
2. Buat user admin pertama lewat Supabase Auth.
3. Jalankan `02_bootstrap_admin_after_signup.sql` dan sesuaikan email admin di dalam SQL jika diperlukan.
4. Jalankan patch lanjutan yang belum tergabung ke schema utama, secara urut:

```txt
03_fix_theme_setter.sql
04_upgrade_requests_admin_tools.sql
05_reset_sales_recap.sql
06_security_hardening.sql
07_in_app_notifications.sql
08_security_reaudit_final.sql
11_password_reset_requests.sql
12_security_final_rls_storage_audit.sql
13_checkout_order_flow_fix.sql
15_order_proof_antispam_hardening.sql
16_private_proof_storage.sql
18_rate_limit_audit_log_hardening.sql
```

`14_readonly_security_regression_audit.sql` boleh dijalankan kapan saja untuk audit, karena read-only.

## Existing production database

Untuk database yang sudah jalan, cukup jalankan patch terbaru yang belum pernah dijalankan. Jangan mulai dari `01` lagi.

Urutan patch penting setelah tahap security:

```txt
13_checkout_order_flow_fix.sql
15_order_proof_antispam_hardening.sql
16_private_proof_storage.sql
18_rate_limit_audit_log_hardening.sql
```

## Quick audit

Jalankan:

```txt
14_readonly_security_regression_audit.sql
```

Pastikan tidak ada red flag besar seperti:

- RLS disabled di tabel penting.
- Order QRIS tanpa bukti bayar.
- File storage upload user dengan extension aneh.
- Public update/delete policy yang tidak dibatasi admin/owner.

## Bucket storage

- `niagabio`: public bucket untuk avatar, produk, gallery, QRIS, dan asset publik.
- `niagabio-private`: private bucket untuk bukti pembayaran checkout dan bukti upgrade premium.

Bukti bayar baru harus masuk `niagabio-private` dan dibuka lewat signed URL.
