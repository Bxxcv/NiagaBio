# Supabase SQL Guide — NiagaBio

Folder ini berisi schema, migration/patch, security hardening, storage policy, dan audit database NiagaBio.

## Source of truth

Status produk dan aturan AI: `../PRD.md` + `../SkilAi.md`.

Dokumen ini hanya mengatur **cara memahami dan menjalankan SQL**.

## Aturan wajib

- Jangan jalankan `01_schema_clean_run_this.sql` ulang pada production database yang sudah berisi data.
- Backup database sebelum patch besar.
- Baca SQL sebelum menjalankan.
- Jangan disable RLS untuk debugging.
- Jangan menaruh service-role key di frontend.
- `14_readonly_security_regression_audit.sql` adalah audit/read-only.
- Jangan menganggap nomor file otomatis menunjukkan dependency karena repo memiliki dua file bernomor `13`.

## Fresh install

Untuk database baru:

1. `01_schema_clean_run_this.sql`
2. buat user admin pertama lewat Supabase Auth
3. `02_bootstrap_admin_after_signup.sql`
4. jalankan patch feature/security yang diperlukan secara urut sesuai header SQL
5. jalankan `14_readonly_security_regression_audit.sql` untuk audit

## Production database yang sudah berjalan

Jangan mulai dari `01` lagi. Jalankan hanya patch yang memang belum pernah diterapkan dan sesuai dependency.

Patch yang tersedia saat ini:

```text
03_fix_theme_setter.sql
04_upgrade_requests_admin_tools.sql
05_reset_sales_recap.sql
06_security_hardening.sql
07_in_app_notifications.sql
08_security_reaudit_final.sql
11_password_reset_requests.sql
12_security_final_rls_storage_audit.sql
13_admin_theme_consistency_fixes.sql
13_checkout_order_flow_fix.sql
14_readonly_security_regression_audit.sql
15_order_proof_antispam_hardening.sql
16_private_proof_storage.sql
18_rate_limit_audit_log_hardening.sql
19_production_readiness_audit.sql
20_push_notifications.sql
22_push_notifications_final.sql
```

`17` dan `21` tidak ada di repo saat ini. Jangan membuat asumsi bahwa file yang hilang perlu dibuat.

## File penting

### Theme
- `03_fix_theme_setter.sql` — RPC `set_profile_theme()`
- `12_security_final_rls_storage_audit.sql` — public resolver/security baseline
- `13_admin_theme_consistency_fixes.sql` — approved amount + admin/public theme consistency

### Admin / Premium
- `04_upgrade_requests_admin_tools.sql`
- `07_in_app_notifications.sql`
- `13_admin_theme_consistency_fixes.sql`

### Checkout / proof
- `13_checkout_order_flow_fix.sql`
- `15_order_proof_antispam_hardening.sql`
- `16_private_proof_storage.sql`

### Security / audit
- `06_security_hardening.sql`
- `08_security_reaudit_final.sql`
- `14_readonly_security_regression_audit.sql`
- `18_rate_limit_audit_log_hardening.sql`
- `19_production_readiness_audit.sql`

### Push
- `20_push_notifications.sql`
- `22_push_notifications_final.sql`

## Storage

- `niagabio` — public asset seperti avatar/product/gallery/QRIS
- `niagabio-private` — bukti pembayaran dan data yang memang harus private

## Verifikasi setelah SQL

Untuk perubahan function/RLS/security, cek function definition/policy/grant aktual di database production. Jangan hanya mengandalkan isi file SQL.
