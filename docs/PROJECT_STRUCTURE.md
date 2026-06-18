# Project Structure NiagaBio

Dokumen ini dibuat agar project mudah diedit dari HP, SPCK Editor, Acode, GitHub, atau Vercel tanpa bingung file mana yang harus diganti.

## Root

| File/folder | Fungsi | Aman diedit? |
| --- | --- | --- |
| `index.html` | Landing page | Ya, untuk landing saja |
| `login.html`, `register.html`, `reset-password.html` | Auth page | Hati-hati, terkait login |
| `dashboard.html` | Dashboard seller | Hati-hati |
| `admin.html` | Admin Master | Hati-hati, security-sensitive |
| `u.html` | Toko publik | Hati-hati, public render |
| `checkout.html` | Checkout pembeli | Sangat hati-hati |
| `orders.html` | Pesanan seller | Hati-hati |
| `vercel.json` | Route, headers, cache | Hati-hati |
| `robots.txt`, `sitemap.xml`, `site.webmanifest` | SEO/PWA dasar | Ya |

## `assets/css/`

| File | Fungsi |
| --- | --- |
| `landing.css` | Style landing page |
| `main.css` | Style dashboard, admin, public page, checkout |
| `bot.css` | Style chatbot |

Aturan: jangan campur style landing ke `main.css` kalau tidak perlu. Landing fokus di `landing.css`.

## `assets/js/`

| File | Fungsi |
| --- | --- |
| `config.js` | Supabase URL/key public dan mode aplikasi |
| `supabase-client.js` | Wrapper Supabase, sanitizer, upload, auth helper, fallback lokal |
| `common.js` | Guard umum, sidebar, util dashboard |
| `landing.js` | Interaksi landing page |
| `auth.js` | Login/register/reset password |
| `public-page.js` | Render toko publik dan share produk |
| `checkout.js` | Alur checkout pembeli |
| `orders.js` | Pesanan, status, rekap, export CSV |
| `admin.js` | Admin Master dan approval |
| `products.js` | CRUD produk seller |
| `profile.js` | Profil toko |
| `links.js`, `social.js`, `gallery.js`, `themes.js` | Fitur seller pendukung |
| `checkout-settings.js` | QRIS dan mode checkout seller |
| `upgrade.js` | Request Premium |
| `notifications.js` | Notifikasi in-app |
| `maintenance.js` | Maintenance page |
| `chatbot.js` | Chatbot/FAQ helper |

File paling sensitif: `supabase-client.js`, `checkout.js`, `orders.js`, `admin.js`, `public-page.js`.

## `api/`

| File | Fungsi |
| --- | --- |
| `share.js` | Endpoint `/s/:username` dan `/s/:username/:product` untuk meta WhatsApp/Open Graph |

Catatan: WhatsApp tidak menjalankan JavaScript browser, jadi preview WA harus dari `api/share.js`, bukan meta yang diubah setelah page load.

## `supabase/`

Berisi SQL schema, patch, audit, dan hardening. Baca `supabase/README.md` sebelum menjalankan SQL.

## `docs/`

Berisi dokumentasi non-runtime. Mengubah file di folder ini tidak mempengaruhi website production.

## Prinsip update aman

- Landing: ubah `index.html`, `assets/css/landing.css`, `assets/js/landing.js` saja.
- Checkout/order: cek JS + SQL bersamaan.
- Security/RLS: jangan percaya frontend; validasi harus di database.
- Upload/storage: frontend hanya lapisan pertama, policy storage tetap wajib.
- Admin: keputusan akhir harus dari `is_admin()` database/RLS.
