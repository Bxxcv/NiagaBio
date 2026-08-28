# NiagaBio

NiagaBio adalah web app **link-in-bio + toko/katalog + checkout + dashboard seller + Admin Master** untuk UMKM, seller online, creator, dan pengguna HP-first.

> Dokumen ini adalah **buku panduan utama** untuk developer/AI baru: struktur repo, cara jalanin lokal, konfigurasi environment, cara deploy, arsitektur, alur bisnis, dan catatan keamanan. Baca berurutan sesuai "Source of truth" di bawah.

---

## Source of truth (urutan baca untuk AI/developer baru)

1. `PRD.md` — produk, ruang lingkup, aturan bisnis.
2. `SkilAi.md` — aturan & konvensi untuk AI yang mengerjakan repo ini.
3. `README.md` (file ini) — orientasi teknis & operasional.
4. `Folder-structure.md` — daftar lengkap folder/file.
5. `docs/PAYMENT_GATEWAY_PLAN.md` — task payment.
6. dokumen `docs/` lain yang relevan (mis. `docs/PUSH_NOTIFICATIONS_SETUP.md`).
7. source code terkait.
8. `supabase/` bila menyentuh database/security.

Patch notes hanya riwayat — jangan jadikan sebagai spesifikasi.

---

## Stack

- **Frontend:** HTML + CSS vanilla + JavaScript vanilla (tanpa bundler/framework).
- **Backend:** Vercel Serverless Functions (`/api`, Node.js, tanpa build step).
- **Database & Auth:** Supabase (PostgreSQL + Auth + Storage + Realtime + pg_net).
- **Payment:** [BuatQris](https://api.buatqris.site) (QRIS) via serverless functions.
- **Push:** Firebase Cloud Messaging (FCM HTTP v1) via `api/send-push.js`.
- **Hosting:** Vercel (static + functions).
- **Dev dari HP:** SPCK Editor + Termux.

Project ini **bukan** React/Next/Vue. Tidak ada `package.json`; dependency hanya modul bawaan Node (`crypto`, `fetch` global di Node 18+) dan SDK Supabase yang di-load via CDN di browser.

---

## Struktur repo (ringkas)

```
NiagaBio/
├── index.html, u.html, checkout.html, login.html,
│   dashboard.html, admin.html, settings.html,
│   tos.html, privacy.html, refund.html, landing.html   # halaman statis
├── head.html, foot.html            # partial HTML (di-include oleh halaman)
├── sw.js                           # service worker (PWA/offline)
├── manifest.webmanifest, favicon   # PWA
├── robots.txt, sitemap.xml
│
├── assets/
│   ├── css/                        # style per-fitur (dashboard.css, checkout.css, ...)
│   ├── js/                         # JS klien per-fitur (auth.js, checkout.js, admin.js, ...)
│   ├── img/                        # gambar statis
│   └── data/                       # JSON statis (faq, knowledge, prompt, links)
│
├── lib/                            # modul Node bersama untuk /api
│   ├── supabase.js                 # klien Supabase server (service role)
│   ├── auth.js                     # verifyAuth() + helper auth
│   ├── ratelimit.js               # rate limit sederhana
│   ├── escapeText.js              # escapeHtml/escapeAttr/escapeJsString/escapeUrl (anti-XSS)
│   ├── makeLinks.js               # linkify aman
│   ├── storage.js                 # signed URL storage
│   ├── buatqris.js                # wrapper BuatQris API + HMAC sign
│   ├── email.js, whatsapp.js, validation.js, response.js, fcm.js, cashfree.js
│
├── api/                            # Vercel Serverless Functions (Node)
│   ├── share.js                    # /api/share  -> halaman publik seller (SSR HTML)
│   ├── send-push.js                # /api/send-push -> kirim FCM (dipanggil pg_net)
│   ├── chat.js                     # AI chat (OpenRouter)
│   ├── payment/
│   │   ├── create.js               # buat QRIS order
│   │   ├── status.js               # cek status order
│   │   ├── webhook.js              # callback BuatQris (verifikasi HMAC)
│   │   └── _supabase.js
│   ├── withdraw/
│   │   ├── request.js              # ajukan penarikan
│   │   ├── history.js              # riwayat penarikan
│   │   ├── list.js                 # list penarikan (admin)
│   │   ├── process.js              # proses penarikan (admin)
│   │   └── _auth.js
│   └── (fungsi pembantu lain di root /api)
│
├── supabase/
│   ├── README.md                   # panduan migrasi SQL
│   ├── 01_*.sql ... 27_*.sql       # migrasi DB berurutan
│   └── RLS/                        # kebijakan Row Level Security
│
├── docs/                           # dokumentasi fitur (payment plan, push setup, patch-notes)
├── .github/                        # GitHub Actions (CI: lint/validate)
├── vercel.json                     # rewrites + security headers + CSP
├── PRD.md, SkilAi.md, Folder-structure.md, README.md
```

> Untuk daftar lengkap & penjelasan tiap file, lihat `Folder-structure.md`.

---

## Cara menjalankan lokal

### Opsi 1 — Pratinjau statis (frontend saja, tanpa functions/rewrites)
Cukup serve folder sebagai static file. Tidak perlu `npm install` (tidak ada `package.json`).

```bash
# dari root repo
python3 -m http.server 3000
# atau
npx serve .
```

Buka `http://localhost:3000/`. Catatan:
- Rewrite `/s/:username`, `/u/:username`, `/checkout/:username/:product` **tidak** aktif di server statis biasa. Buka langsung dengan query string, mis. `u.html?username=xxx` atau `checkout.html?username=xxx&product=yyy`.
- Fitur yang butuh `/api/*` (checkout QRIS, webhook, send-push, share SSR) tidak jalan di mode ini.

### Opsi 2 — Dev lokal mirip produksi (functions + rewrites + env)
Gunakan Vercel CLI agar `/api`, rewrite, dan env terbaca:

```bash
npm i -g vercel
vercel link            # hubungkan ke project Vercel
vercel env pull .env.local   # tarik env dari dashboard ke .env.local (gitignored)
vercel dev             # jalanin di http://localhost:3000
```

- Functions membaca env dari `.env.local` / dashboard Vercel.
- Rewrite & security headers dari `vercel.json` berlaku.
- Pastikan env `SUPABASE_*` dan `BQ_*` sudah terisi (lihat tabel di bawah).

### Database / Supabase
Tidak ada Supabase lokal; app menargetkan project Supabase hosted. Untuk mengubah skema/RLS, apply file `supabase/*.sql` **berurutan** ke project Supabase (via SQL Editor atau `supabase db push` / `supabase migration up`). Jangan skip nomor antar-migrasi yang saling bergantung.

---

## Konfigurasi Environment (Vercel Environment Variables)

Semua secret **hanya** di server (`/api`). Jangan pernah kirim ke browser. Klien hanya boleh pakai **anon key** (sudah di-bake ke `head.html` via `window.SUPABASE_CONFIG` — aman karena RLS yang membatasi akses).

| Variable | Wajib? | Dipakai oleh | Keterangan |
|---|---|---|---|
| `SUPABASE_URL` | Ya | `lib/supabase.js`, `api/send-push.js`, `api/withdraw/_auth.js`, `api/payment/_supabase.js` | URL project Supabase (`https://xxxx.supabase.co`). |
| `SUPABASE_SERVICE_ROLE_KEY` | Ya | sama dengan di atas | **Rahasia.** Akses penuh DB. Hanya server. |
| `SUPABASE_ANON_KEY` (fallback: `NIAGABIO_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`) | Ya (server-side `api/share.js`) | `api/share.js` | Anon key untuk render halaman publik di server. |
| `BQ_ACCOUNT_ID` | Ya (payment) | `lib/buatqris.js` | ID akun BuatQris. |
| `BQ_SECRET_TOKEN` | Ya (payment) | `lib/buatqris.js` | Token rahasia BuatQris. **Jangan ke browser.** |
| `BQ_API_URL` | Tidak | `lib/buatqris.js` | Default `https://api.buatqris.site`. |
| `BQ_QRIS_METHOD` | Tidak | `lib/buatqris.js` | Default `qris_two`. |
| `BQ_CALLBACK_URL` | Ya (payment) | `api/payment/create.js` | URL publik callback provider, mis. `https://<domain>/api/payment/webhook`. |
| `BQ_SIGNING_SECRET` | Ya (webhook) | `api/payment/webhook.js` | Secret verifikasi HMAC webhook. **Rahasia.** |
| `OPENROUTER_API_KEY` | Tidak | `api/chat.js` | Fitur AI chat. |
| `FCM_PROJECT_ID` | Tidak | `api/send-push.js` | Push notification. |
| `FCM_CLIENT_EMAIL` | Tidak | `api/send-push.js` | Service account FCM. |
| `FCM_PRIVATE_KEY` | Tidak | `api/send-push.js` | Private key FCM (harus di-escape `\n`). **Rahasia.** |

> Browser **tidak** boleh memanggil provider payment dengan secret. Semua pembuatan/pengecekan QRIS & verifikasi webhook lewat `/api`.

---

## Cara deploy (Vercel)

1. **Push ke GitHub** (repo ini).
2. Di Vercel: **Add New → Project → Import Git Repository** (pilih repo ini).
3. **Root Directory:** repo root. **Framework Preset:** *Other* (tanpa build). Tidak ada build command/output.
4. **Environment Variables:** isi semua variabel wajib di tabel di atas (Production, Preview, & Development sesuai kebutuhan).
5. **Deploy.** Vercel otomatis mendeteksi `/api` sebagai serverless functions dan menerapkan `vercel.json` (rewrites + security headers).
6. **Post-deploy:**
   - Pastikan `BQ_CALLBACK_URL` menunjuk ke domain Vercel yang sudah deploy.
   - Jika pakai push notification, cek migration `supabase/22_push_notifications_final.sql` — di dalamnya ada URL **hardcode** `https://niaga-bio.vercel.app/api/send-push`. Ganti ke domain produksi kamu bila berbeda (lihat Catatan Penting #1).
   - Apply migrasi Supabase berurutan ke project Supabase yang dipakai.

> Tidak ada pipeline build; perubahan cukup di-commit & push, Vercel otomatis rebuild. CI `.github/` (bila ada) menjalankan validasi syntax/format.

---

## Arsitektur

```text
Browser (static, vanilla JS)
   │  anon key + JWT (Supabase Auth)
   ▼
Supabase ──► Postgres + Auth + Storage + Realtime
   ▲            │ RLS mengamankan tiap baris
   │            │ trigger DB (ledger, protect_orders_fields,
   │            │   notify → pg_net)
   │            ▼
   │      Vercel /api/send-push  (FCM push)
   │
Serverless Functions (/api, Node, service role)
   ├─ /api/share            → render halaman publik seller (HTML)
   ├─ /api/payment/create   → buat QRIS (BuatQris)
   ├─ /api/payment/webhook  → terima callback BuatQris (verify HMAC)
   ├─ /api/withdraw/*       → penarikan seller (admin proses)
   ├─ /api/chat             → AI (OpenRouter)
   └─ /api/send-push        → kirim FCM
            │
            ▼
      BuatQris (QRIS) ◄── webhook callback
```

Inti keamanan: **klien cuma pegang anon key**, akses riil dibatasi **RLS**. Operasi istimewa (baca semua order, update status, kirim push, panggil provider) dilakukan **functions pakai service-role**, yang tidak ter-expose ke browser.

---

## Alur utama

**Seller**
```
Register/Login → Profile → Product/Link/Social/Gallery
→ Theme → Public Store (/u/:username atau /s/:username)
→ Orders (dashboard)
```

**Buyer (checkout otomatis QRIS)**
```
Public Store → Product → Checkout
→ POST /api/payment/create (buat QRIS)
→ tampilkan QR → bayar → BuatQris webhook
→ /api/payment/webhook (verify HMAC) → trigger DB
→ status order = paid + ledger + (push notif ke seller)
```

**Premium**
```
Request → Admin review → approved_amount → status Premium
```

**Keuangan platform**
```
Premium revenue + seller transaction platform_fee
→ Admin Master ledger/report
```

**Penarikan (withdraw)**
```
Seller ajukan → /api/withdraw/request (server hitung saldo via ledger)
→ Admin proses → /api/withdraw/process (BuatQris payout)
→ status withdrawal = completed/pending/failed
```

---

## Keamanan (ringkas, penting)

- **RLS wajib** di semua tabel (`supabase/RLS/`). Jangan cabut RLS untuk kemudahan dev.
- **`protect_orders_fields`** (trigger DB): blokir perubahan alamat pembeli pada order yang sudah dibayar.
- **Anti-XSS:** semua konten user yang di-inject ke DOM/HTML/attribute/JS harus lewat `lib/escapeText.js` (`escapeHtml`, `escapeAttr`, `escapeJsString`, `escapeUrl`) & `lib/makeLinks.js`. Jangan pakai `innerHTML` dengan data mentah.
- **`verifyAuth`** (`lib/auth.js`): validasi JWT Supabase secara independen dari RLS (defense in depth) untuk endpoint functions.
- **Webhook:** diverifikasi dengan **HMAC SHA256** (`signHmac`/`safeTimingEqual`) pakai `BQ_SIGNING_SECRET`. Jangan percaya body mentah.
- **Rate limit:** `lib/ratelimit.js` pada endpoint sensitif.
- **Storage:** bucket **private**; akses publik via **signed URL** ber-TTL pendek (`lib/storage.js`), bukan URL objek mentah.
- **Secret:** `SUPABASE_SERVICE_ROLE_KEY`, `BQ_SECRET_TOKEN`, `BQ_SIGNING_SECRET`, `OPENROUTER_API_KEY`, `FCM_PRIVATE_KEY` **hanya di server/env**. Tidak ada di klien.
- **CSP:** diatur di `vercel.json` (default-src 'self', izinkan CDN jsDelivr & gstatic, blokir frame/object). Jangan tambah origin sembarangan.
- **Tidak ada CSRF middleware eksplisit.** Perlindungan mengandalkan validasi JWT (`verifyAuth`) + RLS + CSP same-origin. Bila menambah endpoint admin berbasis cookie, tambahkan proteksi CSRF.

---

## Catatan penting / Gotcha

1. **URL push di-hardcode di migrasi.** `supabase/22_push_notifications_final.sql` memanggil `https://niaga-bio.vercel.app/api/send-push` via `pg_net`. Bila deploy ke domain lain, edit URL tersebut sebelum apply, atau push notification gagal (400/404).
2. **Urutan migrasi SQL.** Patch keamanan payment (24 → 25 → 26 → 27) saling bergantung. Apply berurutan; jangan loncat.
3. **Webhook adalah sumber kebenaran status payment.** Jangan andalkan polling klien sebagai satu-satunya konfirmasi; status final ditentukan trigger DB dari webhook.
4. **Browser tidak panggil BuatQris langsung.** Semua secret di server. Kalau ada kode klien yang mencoba, itu bug/kebocoran.
5. **Tidak ada automated test.** Validasi = `node --check` per file + cek flow manual + cek regression. CI (`.github/`) hanya lint/format bila diaktifkan.
6. **Anon key di `head.html`** di-bake statis (aman karena RLS), tapi pastikan bukan service-role key. Server functions baca service-role dari env.
7. **DB changes butuh apply manual** ke Supabase hosted (tidak ada Supabase local/dev container di repo ini).

---

## Prinsip penting (jangan dilanggar)

- Mobile-first, tapi desktop harus tetap rapi di viewport.
- Cari akar masalah sebelum patch; jangan nebak data/error.
- Jangan ubah logic/Supabase hanya untuk bug CSS/HTML/JS yang tak butuh DB.
- **Security/RLS lebih penting dari tampilan.**
- Jangan expose service-role key atau provider secret.
- Setiap perubahan divalidasi: syntax + flow + regression.

---

## Payment decision

**BuatQris** adalah provider payment gateway utama untuk seller Free & Premium pada fase MVP payment otomatis.

- Secret di Vercel Environment Variables.
- Browser tidak boleh memanggil provider dengan secret.
- Provider fee tidak di-hardcode; platform fee & withdrawal reserve diatur Admin Master dan di-snapshot ke order.

### Patch & Perbaikan Audit (26 Agustus 2025)

| Patch | File | Tujuan | Risiko |
|---|---|---|---|
| `26_fix_audit_findings.sql` | `supabase/26_fix_audit_findings.sql` | Fix BUG-01 (blokir `qris_buatqris`) & BUG-02 (akunting) | Low (RLS dipertahankan) |
| `assets/js/checkout.js` | `assets/js/checkout.js` | Fix BUG-05 (UX: persistence order saat refresh) | None |
| `api/payment/create.js` | `api/payment/create.js` | Log audit request/response provider | None |

- **BUG-01:** trigger lama memblokir `qris_buatqris` & memaksa `proof_image_url` wajib. Patch: whitelist `qris_buatqris`, izinkan `proof_image_url` kosong, hitung `platform_earning = platform_fee + withdrawal_reserve`.
- **BUG-02:** `apply_buatqris_payment_event` tak memasukkan `withdrawal_reserve` ke `platform_earning` & mengurangi `seller_earning` dengan `gateway_fee` tak adil. Patch: perbaiki kalkulasi.
- **BUG-05:** refresh checkout hilangkan state & QRIS tak muncul. Patch: simpan state di `sessionStorage`, restore saat load.

Terapkan setelah `25_payment_security_hardening.sql`:
```bash
supabase db reset --db-url "$SUPABASE_DB_URL"
# atau
supabase db patch 26
```
Pastikan env `OPENROUTER_API_KEY` & `BQ_CALLBACK_URL` terkonfigurasi.

---

## Payment / Withdrawal status

- **2026-08-25:** P0/P1 foundation di `supabase/23_payment_ledger_foundation.sql`. Payment API/backend & checkout automation awalnya pending.
- **P3 backend (BuatQris):** di `/api/payment/*` + migrasi `24_buatqris_payment_gateway.sql`. Wajib sandbox-first testing sebelum produksi.
- **P25 security hardening:** jalankan `supabase/25_payment_security_hardening.sql` setelah migrasi 24 sebelum tes sandbox pertama.
- **2026-08-26:** P27 seller wallet + withdrawal foundation. Saldo seller = paid earnings − pending/completed withdrawals. Withdrawal seller-initiated, diproses server-side via BuatQris. Admin Master visual redesign = task terpisah.
