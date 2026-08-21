# PRD — NiagaBio

**Status:** Active / source of truth  
**Last updated:** 2026-08-20  
**Product:** NiagaBio  
**Production:** https://niaga-bio.vercel.app  
**Repository:** https://github.com/Bxxcv/NiagaBio

## 1. Produk

NiagaBio adalah platform **link-in-bio + toko/katalog produk + checkout manual + dashboard seller + admin tools** untuk UMKM, seller online, creator, dan pengguna HP-first.

### Nilai utama
> Satu link untuk tampil rapi, jualan lebih jelas, dan membuat pembeli lebih mudah order.

## 2. Tech stack dan batasan

- HTML statis
- CSS vanilla
- JavaScript vanilla
- Supabase Auth / Database / Storage / RPC / RLS
- Vercel untuk deployment dan route/serverless helper
- Bukan React, Next.js, Vue, atau framework SPA
- Jangan memindahkan framework tanpa alasan kuat dan persetujuan eksplisit

## 3. Modul utama

### Public
- `index.html` — landing
- `u.html` — toko/profile publik
- `checkout.html` — checkout
- `sitemap.xml`, `robots.txt`, legal pages

### Auth
- `login.html`
- `register.html`
- `reset-password.html`

### Seller dashboard
- `dashboard.html`
- `profile.html`
- `products.html`
- `orders.html`
- `links.html`
- `social.html`
- `gallery.html`
- `themes.html`
- `checkout-settings.html`
- `notifications.html`
- `upgrade.html`

### Admin
- `admin.html`
- `assets/js/admin.js`
- Supabase RPC/RLS/admin functions

### Backend/helper
- `api/send-push.js`
- `api/share.js`
- `supabase/*.sql`

## 4. Alur bisnis utama

### Seller
```text
Register/Login
  → Profile
  → Product / Link / Social / Gallery
  → Theme
  → Checkout settings
  → Public store
```

### Buyer
```text
Public store
  → Product
  → Checkout
  → Payment/manual proof
  → Seller reviews order
```

### Premium
```text
User request Premium
  → Admin reviews proof/request
  → Approve/Reject
  → plan + plan_end_date updated
  → Premium features unlocked
```

## 5. Aturan tema

Theme source of truth adalah `profiles.theme_name`.

Public resolver: `public.get_public_profile(username)`.
Public page: `assets/js/public-page.js`.
Theme selector: `assets/js/themes.js`.
Theme persistence RPC: `public.set_profile_theme(text)`.

Free theme:
- `service`
- `minimal`

Premium themes:
- `fashion`
- `gadget`
- `food`
- `beauty`
- `dark`
- `luxury`
- `neon`
- `portfolio`

### Known theme bug and root cause
Tema sempat tersimpan benar di Supabase dan RPC `set_profile_theme()` terbukti mengembalikan `theme_name = minimal`, tetapi tampilan toko tidak berubah. Akar masalah yang teridentifikasi adalah halaman `u.html` tidak memuat stylesheet utama yang mendefinisikan class tema. `u.html` harus memuat `assets/css/main.css` bersama stylesheet store.

**Status:** akar masalah teridentifikasi; perapihan visual antar tema sengaja ditunda ke task berikutnya.

## 6. Admin invariants

Admin harus memakai role/database/RLS, bukan sekadar menyembunyikan UI.

Temuan yang sudah diaudit:
- access denied memakai selector `.content-wrap` yang harus cocok dengan struktur HTML
- `safeAll()` tidak boleh mengubah error database menjadi data kosong tanpa indikator error
- revenue Premium harus memakai nominal approval historis (`approved_amount`), bukan harga Premium saat ini
- statistik expired harus memperhatikan status user
- aturan QRIS manual harus konsisten dengan validasi storage/database
- `approved_amount` tersedia melalui patch `supabase/13_admin_theme_consistency_fixes.sql`

## 7. Security invariants

- Jangan expose service-role key di frontend
- Jangan mematikan RLS untuk debugging production
- Public store memakai RPC terkontrol, bukan membuka tabel sensitif langsung
- Bukti pembayaran checkout/premium disimpan di bucket private sesuai policy aktif
- Admin action harus dibatasi role/RPC/RLS
- Patch SQL production harus dibaca dan diuji sebelum dijalankan

## 8. Source of truth untuk AI

Urutan baca wajib:

1. `PRD.md` — produk, flow, invariants, status terkini
2. `SkilAi.md` — aturan kerja AI, workflow, bug ledger
3. `README.md` — overview manusia/developer
4. `Folder-structure.md` — peta file dan ownership
5. Dokumen relevan di `docs/`
6. File source yang benar-benar terkait task
7. `supabase/*.sql` bila task menyentuh database/security

**Dokumen sejarah/patch note bukan source of truth.** Gunakan hanya untuk konteks perubahan lama.

## 9. Task berikutnya

Task aktif berikutnya setelah dokumentasi:

> **Rapikan UI/UX tema-tema toko.**

Fokus pada visual, konsistensi, hierarchy, spacing, typography, card/link/product treatment, responsive mobile-first, dan perbedaan karakter antar tema.

Jangan mengubah logic tema, RPC, auth, RLS, atau schema kecuali dibutuhkan dan dibuktikan perlu.
