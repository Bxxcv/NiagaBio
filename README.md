# NiagaBio

NiagaBio adalah website **link bio + katalog produk + checkout QRIS manual + dashboard pesanan** untuk seller kecil/UMKM yang ingin punya halaman toko rapi tanpa bikin website rumit.

Project ini tetap ringan: **HTML, CSS, Vanilla JavaScript, Supabase, dan Vercel**. Tidak memakai React, Tailwind build, npm, atau server yang harus dijalankan manual.

## Route utama

| Route | Fungsi |
| --- | --- |
| `/` | Landing page |
| `/login` | Login seller/admin |
| `/register` | Daftar seller |
| `/dashboard` | Dashboard seller |
| `/admin` | Admin Master |
| `/u?username=demo-account` | Toko publik |
| `/s/demo-account` | Share preview toko untuk WhatsApp/Open Graph |
| `/s/demo-account/product-id` | Share preview produk |
| `/checkout?username=demo-account&product=...` | Checkout publik |
| `/orders` | Pesanan dan rekap seller |
| `/upgrade` | Upgrade Premium |
| `/notifications` | Notifikasi in-app |

## Fitur utama

### Seller

- Profil toko dan username publik.
- Link bio dan social link.
- Katalog produk dengan kategori.
- Gallery untuk Premium.
- Template toko Free/Premium.
- Checkout QRIS manual.
- Upload bukti pembayaran.
- Dashboard pesanan, rekap omset, dan export CSV.
- Share toko dan share produk dengan preview WhatsApp.

### Admin Master

- Kelola user Free/Premium/Blocked/Deleted.
- Approve/reject request Premium.
- Setting harga Premium dan QRIS Premium.
- Maintenance mode dan register lock.
- Laporan platform dan export CSV.
- Audit log untuk aksi penting.

## Security status production candidate

Bagian penting yang sudah dikeraskan:

- Supabase RLS aktif.
- Admin role dari database/RLS, bukan dari frontend.
- Field sensitif `role`, `plan`, `status`, dan `plan_end_date` dikunci trigger database.
- Public checkout wajib lewat RPC `create_public_order`.
- Order QRIS wajib bukti pembayaran.
- Harga order dihitung di database, bukan dari frontend.
- Bukti bayar baru masuk bucket private `niagabio-private`.
- Seller/admin membuka bukti bayar lewat signed URL sementara.
- Fallback localStorage/demo dimatikan di production.
- Upload user hanya JPG, PNG, WEBP maksimal 3 MB.
- Basic rate limit untuk `/api/share`.
- Security headers Vercel.

Catatan: Supabase anon key memang public untuk aplikasi frontend. Jangan pernah memasukkan `service_role`, secret SMTP, token admin, atau private API key ke frontend.

## Struktur folder

```txt
NiagaBio-main/
├── *.html                  # Halaman static utama
├── api/                    # Vercel serverless function
│   └── share.js            # Preview share toko/produk untuk WhatsApp/Open Graph
├── assets/
│   ├── css/                # CSS landing, dashboard, chatbot
│   ├── img/                # Logo, favicon, OG image, placeholder
│   └── js/                 # Logic frontend per halaman
├── docs/                   # Dokumentasi project dan patch notes
│   ├── patch-notes/        # Catatan patch per tahap
│   ├── DESAIN.md
│   ├── PROJECT_STRUCTURE.md
│   ├── ROADMAP.md
│   ├── SETUP_SUPABASE_DARI_NOL.md
│   └── UPDATE_GUIDE.md
├── supabase/               # SQL schema, patch, audit, dan hardening
├── robots.txt
├── sitemap.xml
├── site.webmanifest
└── vercel.json
```

Detail struktur ada di `docs/PROJECT_STRUCTURE.md`.

## Setup cepat

1. Buat project Supabase.
2. Buka SQL Editor.
3. Untuk database baru, jalankan SQL sesuai urutan di `supabase/README.md`.
4. Buat akun admin pertama.
5. Jalankan `supabase/02_bootstrap_admin_after_signup.sql` setelah akun admin ada.
6. Edit `assets/js/config.js`.
7. Deploy ke Vercel.

Config frontend:

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

`ADMIN_EMAIL` sengaja kosong. Admin harus berasal dari database/RLS, bukan dari frontend.

## Cara update aman

Baca `docs/UPDATE_GUIDE.md` sebelum mengganti file. Ringkasnya:

1. Backup ZIP lama.
2. Replace file patch sesuai daftar.
3. Jalankan SQL patch baru jika ada.
4. Deploy ulang Vercel.
5. Test login, dashboard, public page, checkout, upload bukti, orders, admin, dan share produk.

Jangan run ulang `supabase/01_schema_clean_run_this.sql` di database production yang sudah berisi data, kecuali kamu memang setup database baru dari nol.

## Checklist test production

- Landing page tidak horizontal scroll.
- Login/register berjalan.
- Seller bisa tambah produk.
- Public page `/u?username=...` tampil.
- Share `/s/username/product-id` muncul preview di WhatsApp.
- Checkout wajib upload bukti bayar.
- Order masuk dashboard seller.
- Bukti bayar baru bisa dibuka seller/admin.
- Admin bisa approve/reject premium.
- Audit log terisi untuk aksi penting.
- Tidak ada error console fatal.

## Dokumentasi penting

- `docs/UPDATE_GUIDE.md` — cara replace file dan deploy aman.
- `docs/PROJECT_STRUCTURE.md` — peta file/folder.
- `supabase/README.md` — urutan SQL dan catatan database.
- `docs/patch-notes/` — catatan patch per tahap.
