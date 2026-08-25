# Folder Structure — NiagaBio

Dokumen ini adalah peta file aktual + ownership. Jangan membuat struktur/fungsi berdasarkan asumsi dokumentasi lama.

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
| `dashboard.html` | dashboard seller |
| `profile.html` | profil seller |
| `products.html` | produk |
| `orders.html` | order seller + rekap + nota |
| `checkout-settings.html` | konfigurasi checkout seller |
| `checkout.html` | public checkout |
| `admin.html` | Admin Master |
| `u.html` | public store |
| `upgrade.html` | Premium |
| `themes.html` | pemilihan tema |
| `notifications.html` | notifikasi |
| lainnya | lihat source langsung sebelum edit |

## JavaScript ownership

| File | Area |
|---|---|
| `common.js` | helper umum, toast, utility |
| `supabase-client.js` | Supabase data/RPC wrapper frontend |
| `checkout.js` | checkout |
| `checkout-settings.js` | checkout settings |
| `orders.js` | seller orders/rekap/nota |
| `admin.js` | Admin Master |
| `upgrade.js` | Premium request |
| `products.js` | products |
| `public-page.js` | public store/runtime theme |
| lainnya | sesuai nama file/page |

## CSS ownership

| File | Area |
|---|---|
| `assets/css/main.css` | base/public theme styling penting |
| `assets/css/v2/store.css` | public store-specific styling |
| `assets/css/v2/seller.css` | seller/dashboard |
| `assets/css/v2/admin.css` | Admin Master |
| `assets/css/v2/checkout.css` | checkout |
| `assets/css/v2/foundation.css` | shared design tokens |
| `assets/css/v2/auth.css` | auth |
| `assets/css/v2/legal.css` | legal |
| `assets/css/landing.css` | landing |

## Backend/serverless

Current:
```text
api/send-push.js
api/share.js
```

Planned payment backend (belum dibuat):
```text
api/payment/create.js
api/payment/webhook.js
api/payment/status.js
```

Jangan membuat endpoint payment palsu/stub jika contract provider belum diverifikasi.

## Supabase

`supabase/` berisi schema, feature patch, RLS/security, storage, audit.

Penting:
- `01_schema_clean_run_this.sql` → fresh schema only
- `13_admin_theme_consistency_fixes.sql` → approved amount/theme/admin consistency
- `14_readonly_security_regression_audit.sql` → read-only audit
- `19_production_readiness_audit.sql` → production audit
- `22_push_notifications_final.sql` → final push notification migration

Ada dua file bernomor `13`; baca header/dependency, jangan menebak urutannya dari nama.

Payment migration baru harus diberi nomor yang konsisten dengan urutan aktual dan dijelaskan di `supabase/README.md`.

## Docs

Source of truth:
- `PRD.md`
- `SkilAi.md`
- `README.md`
- `Folder-structure.md`

Active guides:
- `docs/PAYMENT_GATEWAY_PLAN.md`
- `docs/DESAIN.md`
- `docs/ROADMAP.md`
- `docs/SETUP_SUPABASE_DARI_NOL.md`
- `docs/UPDATE_GUIDE.md`
- `docs/PUSH_NOTIFICATIONS_SETUP.md`
- `supabase/README.md`

History:
- `docs/patch-notes/*`

Patch notes tidak menggantikan source of truth.
