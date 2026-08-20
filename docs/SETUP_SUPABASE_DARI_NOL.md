# Setup Supabase NiagaBio dari Nol

Dokumen ini hanya untuk **fresh Supabase project**. Untuk production yang sudah berisi data, jangan mulai dari schema awal.

## 1. Buat project

Buat project Supabase baru lalu buka SQL Editor.

## 2. Auth

Aktifkan Email provider sesuai kebutuhan testing/production.

## 3. Jalankan schema awal

```text
supabase/01_schema_clean_run_this.sql
```

Buat user admin pertama lewat Supabase Auth lalu gunakan:

```text
supabase/02_bootstrap_admin_after_signup.sql
```

## 4. Patch lanjutan

Jalankan hanya patch yang dibutuhkan, sesuai dependency dan header SQL. Repo saat ini memiliki:

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

Ada dua file bernomor `13` karena keduanya berasal dari feature/patch line berbeda. Jangan menganggap `13` satu file tunggal.

## 5. Storage

- `niagabio` — public assets
- `niagabio-private` — private proof/payment files

## 6. Frontend config

Edit `assets/js/config.js` menggunakan anon/publishable key.

**Jangan pernah memasukkan `service_role` key ke frontend.**

## 7. Deploy

Deploy project ke Vercel dengan `vercel.json` dari repo.

## 8. Smoke test

```text
Register → Login → Profile → Product → Theme → Public Store → Checkout → Order → Admin/Premium
```

Untuk regression security, gunakan:

```text
supabase/14_readonly_security_regression_audit.sql
```
