# NiagaBio

NiagaBio adalah web app **link-in-bio + toko/katalog + checkout manual + dashboard seller + admin tools** untuk UMKM, seller online, creator, dan pengguna HP-first.

## Stack
- HTML
- CSS vanilla
- JavaScript vanilla
- Supabase
- Vercel

Project ini **bukan** React/Next/Vue.

## Source of truth project

Untuk AI/developer baru, baca berurutan:

1. `PRD.md` — product requirements, flow, invariants, dan status terkini
2. `SkilAi.md` — aturan kerja AI + debugging protocol + bug ledger
3. `README.md` — overview singkat
4. `Folder-structure.md` — peta file dan ownership
5. `docs/` — panduan khusus
6. `supabase/` — database/RLS/security bila relevan

Patch notes di `docs/patch-notes/` adalah **riwayat**, bukan source of truth.

## Struktur utama

```text
NiagaBio/
├── PRD.md
├── SkilAi.md
├── README.md
├── Folder-structure.md
├── *.html
├── assets/
│   ├── css/
│   ├── js/
│   ├── img/
│   └── ...
├── api/
├── supabase/
└── docs/
```

## Production

- Vercel: `https://niaga-bio.vercel.app`
- GitHub: `https://github.com/Bxxcv/NiagaBio`

## Alur utama

```text
Seller:
Register/Login → Profile → Product/Link/Social/Gallery → Theme → Checkout → Public Store

Buyer:
Public Store → Product → Checkout → Payment/Proof → Seller review

Premium:
Request → Admin review → Approve/Reject → Plan/feature access
```

## Prinsip penting

- Mobile-first.
- Sederhana untuk seller awam.
- Jangan merusak logic existing.
- Cari akar masalah sebelum patch.
- Jangan menyentuh database untuk bug yang sebenarnya hanya HTML/CSS/JS.
- Jangan expose service-role key.
- Jangan disable RLS di production.

## Status saat ini

- Core seller/public/admin flow aktif.
- Theme persistence sudah diverifikasi melalui Supabase RPC.
- Akar masalah rendering tema yang pernah terjadi: `u.html` tidak memuat `assets/css/main.css`.
- **Task aktif berikutnya:** rapikan tampilan tema toko. Logic tema tidak diubah kecuali diperlukan.
