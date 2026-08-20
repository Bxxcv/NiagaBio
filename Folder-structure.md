# Folder Structure — NiagaBio

Dokumen ini adalah peta file **aktual** dan ownership-nya. Jangan membuat struktur/fungsi berdasarkan asumsi dari dokumentasi lama.

## Root

```text
PRD.md                 → product source of truth
SkilAi.md              → AI workflow + rules + bug ledger
README.md              → overview
Folder-structure.md    → file map / ownership
vercel.json            → deployment, routes, headers, cache
*.html                 → halaman aplikasi
```

## HTML utama

| File | Tanggung jawab |
|---|---|
| `index.html` | landing |
| `login.html` | login |
| `register.html` | register |
| `reset-password.html` | reset password |
| `dashboard.html` | dashboard seller |
| `profile.html` | profil seller |
| `products.html` | produk |
| `links.html` | link |
| `social.html` | social |
| `gallery.html` | gallery |
| `themes.html` | pemilihan tema |
| `checkout-settings.html` | konfigurasi checkout |
| `orders.html` | order seller |
| `notifications.html` | notifikasi |
| `upgrade.html` | Premium |
| `admin.html` | admin |
| `u.html` | public store/profile |
| `checkout.html` | public checkout |

## JavaScript ownership

| File | Area |
|---|---|
| `common.js` | helper umum |
| `supabase-client.js` | Supabase data/RPC wrapper |
| `auth.js` | auth flow |
| `dashboard.js` | dashboard |
| `profile.js` | profile |
| `products.js` | products |
| `links.js` | links |
| `social.js` | social |
| `gallery.js` | gallery |
| `themes.js` | theme selector/save |
| `public-page.js` | public store/runtime theme |
| `checkout.js` | checkout |
| `checkout-settings.js` | checkout settings |
| `orders.js` | seller orders |
| `admin.js` | admin |
| `upgrade.js` | Premium request |
| `notifications.js` | notification page |
| `notification-runtime.js` | notification runtime |
| `push-notifications.js` | push |
| `config.js` | public frontend config |
| `firebase-config.js` | Firebase push config |

## CSS ownership

| File | Area |
|---|---|
| `assets/css/main.css` | base/public theme styling penting |
| `assets/css/v2/store.css` | store-specific styling |
| `assets/css/v2/seller.css` | seller/dashboard styling |
| `assets/css/v2/admin.css` | admin styling |
| `assets/css/v2/auth.css` | auth |
| `assets/css/v2/checkout.css` | checkout |
| `assets/css/v2/foundation.css` | shared foundation |
| `assets/css/v2/legal.css` | legal |
| `assets/css/landing.css` | landing |

### Catatan kritis public store
`u.html` harus memuat stylesheet yang dibutuhkan oleh `public-page.js`. Class tema public bergantung pada aturan di `assets/css/main.css`.

## Backend / serverless

```text
api/send-push.js → helper push
api/share.js     → share/serverless helper
```

## Supabase

Folder `supabase/` berisi:

- schema awal
- patch feature
- RLS/security hardening
- storage policy
- audit

Jangan menjalankan schema awal di production yang sudah berisi data.

### File penting

- `01_schema_clean_run_this.sql` → fresh schema
- `02_bootstrap_admin_after_signup.sql` → bootstrap admin
- `03_fix_theme_setter.sql` → theme RPC
- `12_security_final_rls_storage_audit.sql` → security/public resolver baseline
- `13_admin_theme_consistency_fixes.sql` → admin/theme consistency + approved amount
- `14_readonly_security_regression_audit.sql` → audit read-only
- `19_production_readiness_audit.sql` → production audit
- `22_push_notifications_final.sql` → final push notification migration

Catatan: terdapat dua file bernomor `13`. Jangan menganggap nomor file sendirian menentukan dependency; baca header SQL dan `supabase/README.md`.

## Docs

### Source of truth
- `PRD.md`
- `SkilAi.md`
- `README.md`
- `Folder-structure.md`

### Panduan aktif
- `docs/DESAIN.md`
- `docs/ROADMAP.md`
- `docs/SETUP_SUPABASE_DARI_NOL.md`
- `docs/UPDATE_GUIDE.md`
- `docs/PUSH_NOTIFICATIONS_SETUP.md`
- `supabase/README.md`

### Riwayat
- `docs/patch-notes/*`

Patch notes tidak boleh dipakai untuk menggantikan status terkini.
