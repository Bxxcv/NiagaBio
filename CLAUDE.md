# CLAUDE.md — NiagaBio

Panduan ringkas untuk AI yang bekerja di repo ini. Baca `SkilAi.md` untuk aturan kerja lengkap.

## Stack

- **Frontend:** HTML + CSS + JS vanilla, tanpa framework/bundler
- **Backend:** Vercel Serverless Functions (`/api`, Node.js 18+)
- **DB/Auth:** Supabase (PostgreSQL + Auth + Storage + Realtime + pg_net)
- **Payment:** BuatQris (QRIS) via serverless functions
- **Push:** Firebase Cloud Messaging via `api/send-push.js`
- **Hosting:** Vercel
- **Dev environment:** SPCK Editor + Termux (mobile-first workflow)

Tidak ada `package.json`. Dependency Node hanya modul bawaan (`crypto`, `fetch`). Supabase SDK di-load via CDN di browser.

## Commands

### Jalankan lokal (frontend saja)
```bash
python3 -m http.server 3000
# atau
npx serve .
```
`/api/*` dan rewrites tidak aktif di mode ini.

### Jalankan lokal mirip produksi (functions + rewrites)
```bash
npm i -g vercel
vercel link
vercel env pull .env.local
vercel dev
```

### Validasi syntax (tidak ada test runner)
```bash
node --check api/<file>.js
node --check lib/<file>.js
```
Tidak ada automated test. Validasi = syntax check + flow manual + regression check.

### Deploy
Push ke GitHub → Vercel auto-deploy. Tidak ada build command.

## Arsitektur

```
Browser (vanilla JS, anon key)
  │
  ▼
Supabase — Postgres + Auth + RLS + Realtime + pg_net
  │
  └─► Vercel /api (Node, service-role key)
        ├── /api/share          → SSR halaman publik seller
        ├── /api/payment/*      → BuatQris QRIS create/status/webhook
        ├── /api/withdraw/*     → withdrawal seller
        ├── /api/send-push      → FCM push (dipanggil pg_net trigger)
        └── /api/chat           → AI chat (OpenRouter)
```

Klien hanya pegang **anon key**. Semua operasi istimewa lewat `/api` dengan service-role key dari Vercel ENV.

## Struktur File Penting

| Path | Tanggung jawab |
|---|---|
| `vercel.json` | routing rewrites, security headers, CSP |
| `lib/supabase.js` | Supabase client server (service role) |
| `lib/auth.js` | `verifyAuth()` — validasi JWT di setiap endpoint |
| `lib/escapeText.js` | anti-XSS: `escapeHtml`, `escapeAttr`, `escapeJsString`, `escapeUrl` |
| `lib/buatqris.js` | wrapper BuatQris API + HMAC sign — **jangan import di frontend** |
| `assets/js/supabase-client.js` | data/RPC wrapper frontend |
| `supabase/*.sql` | migrasi DB — apply berurutan sesuai nomor |

## Aturan Kritis

**Security:**
- Jangan expose `SUPABASE_SERVICE_ROLE_KEY`, `BQ_SECRET_TOKEN`, `BQ_SIGNING_SECRET`, `FCM_PRIVATE_KEY` ke browser.
- Semua konten user di DOM harus lewat `lib/escapeText.js` — tidak boleh `innerHTML` dengan data mentah.
- Jangan matikan RLS untuk debugging.
- Webhook BuatQris harus diverifikasi HMAC sebelum dipercaya.

**Database:**
- Jangan jalankan `01_schema_clean_run_this.sql` ulang di production.
- Apply migrasi SQL berurutan — ada dependency antar nomor.
- `14_readonly_security_regression_audit.sql` bersifat read-only/audit saja.
- Jangan ubah DB/RLS untuk masalah yang sebenarnya hanya UI/CSS.

**Payment:**
- Webhook = sumber kebenaran status payment; status endpoint = fallback.
- Jangan hardcode gateway fee — ambil dari response provider (`admin_fee`/`total_amount`).
- Sebelum production, wajib test via BuatQris Sandbox (`test=1`).
- `withdrawal_reserve` ≠ `platform_earning` — jangan dicampur.

## Source of Truth (urutan baca)

1. `PRD.md` — produk & aturan bisnis
2. `SkilAi.md` — aturan & konvensi AI + bug ledger
3. `README.md` — orientasi teknis
4. `Folder-structure.md` — peta file lengkap
5. `docs/PAYMENT_GATEWAY_PLAN.md` — task payment aktif
6. Source file terkait → SQL terkait (jika task menyentuh DB)

Patch notes di `docs/patch-notes/` hanya riwayat — bukan spesifikasi aktual.
