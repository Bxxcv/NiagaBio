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


## Push notification final

Untuk instalasi push notification production versi final, jalankan hanya:

```txt
22_push_notifications_final.sql
```

Patch final ini menggantikan bridge lama SQL 21 dan tidak memakai `PUSH_WEBHOOK_SECRET` atau Supabase Vault. Jika SQL 20/21 pernah dijalankan sebelumnya, SQL 22 akan memperbaiki trigger lama secara idempotent.

## Payment gateway — upcoming

Payment gateway otomatis **belum diimplementasikan** pada source ini.

Keputusan produk:
- provider: BuatQris
- seller: Free + Premium
- secret: Vercel Environment Variables
- webhook: sumber utama status payment
- ledger: seller earning / platform earning / gateway fee / withdrawal reserve dipisahkan

Sebelum membuat migration baru:
1. audit `orders`, `app_settings`, RPC `create_public_order`, dan RLS aktual;
2. pastikan migration additive/idempotent bila memungkinkan;
3. jangan memutus order manual lama;
4. tambahkan read-only audit query untuk payment tables/functions/policies;
5. dokumentasikan migration baru di sini setelah benar-benar dibuat.

Detail model ada di `docs/PAYMENT_GATEWAY_PLAN.md`.
