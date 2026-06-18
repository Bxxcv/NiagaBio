# Setup Supabase NiagaBio dari Nol

Panduan ini untuk membuat database NiagaBio baru. Untuk database production yang sudah berisi data, jangan jalankan ulang schema utama dari awal.

## 1. Buat project Supabase

Buka Supabase Dashboard, buat project baru, lalu masuk ke SQL Editor.

## 2. Auth Email setting

Masuk ke:

```txt
Authentication > Providers > Email
```

Untuk testing awal:

```txt
Email provider: ON
Confirm email: OFF
Secure email change: OFF
```

Untuk production, pengaturan email bisa diperketat lagi setelah flow testing selesai.

## 3. Jalankan SQL

Baca `supabase/README.md` untuk urutan terbaru.

Ringkasnya untuk database baru:

1. Jalankan `supabase/01_schema_clean_run_this.sql`.
2. Buat user admin pertama di Auth.
3. Jalankan `supabase/02_bootstrap_admin_after_signup.sql` setelah menyesuaikan email admin jika diperlukan.
4. Jalankan patch lanjutan secara urut sampai patch terbaru.

Patch lanjutan yang penting:

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

`14_readonly_security_regression_audit.sql` hanya untuk audit/read-only.

## 4. Storage bucket

NiagaBio memakai dua bucket:

| Bucket | Status | Fungsi |
| --- | --- | --- |
| `niagabio` | Public | Avatar, produk, gallery, QRIS, asset publik |
| `niagabio-private` | Private | Bukti pembayaran checkout dan bukti upgrade premium |

SQL 16 membuat bucket private dan policy-nya.

## 5. Edit config frontend

Buka:

```txt
assets/js/config.js
```

Isi `SUPABASE_URL` dan `SUPABASE_ANON_KEY` dari Supabase project.

```js
window.NIAGABIO_CONFIG = {
  SUPABASE_URL: "https://project-kamu.supabase.co",
  SUPABASE_ANON_KEY: "anon_or_publishable_key_kamu",
  ADMIN_EMAIL: "",
  BRAND_NAME: "NiagaBio",
  PREMIUM_PRICE: 80000,
  DEMO_MODE: false
};
```

Jangan isi `service_role` key di frontend.

## 6. Deploy ke Vercel

Upload project ke GitHub, lalu import ke Vercel. Pastikan `vercel.json` ikut terdeploy supaya clean URL, security headers, cache headers, dan route `/s/...` berjalan.

## 7. Test wajib

- Register user baru.
- Login seller.
- Isi profil toko.
- Tambah produk.
- Upload gambar produk.
- Atur QRIS.
- Buka toko publik.
- Checkout dan upload bukti bayar.
- Pastikan order masuk dashboard seller.
- Login admin dan approve/reject premium.
- Cek audit log.
