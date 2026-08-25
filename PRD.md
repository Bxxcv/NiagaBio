# PRD — NiagaBio

**Status:** Active / source of truth  
**Last updated:** 2026-08-25  
**Product:** NiagaBio  
**Production:** https://niaga-bio.vercel.app  
**Repository:** https://github.com/Bxxcv/NiagaBio

## 1. Produk

NiagaBio adalah platform **link-in-bio + toko/katalog produk + checkout + dashboard seller + Admin Master** untuk UMKM, seller online, creator, dan pengguna HP-first.

Nilai utama:
> Satu link untuk tampil rapi, jualan lebih jelas, checkout lebih mudah, dan pengelolaan pesanan lebih terstruktur.

## 2. Tech stack dan batasan

- HTML statis
- CSS vanilla
- JavaScript vanilla
- Supabase Auth / Database / Storage / RPC / RLS
- Vercel untuk deployment dan serverless/backend helper
- GitHub sebagai source repository
- SPCK Editor + Termux untuk workflow development dari HP
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

### Admin Master
- `admin.html`
- `assets/js/admin.js`
- Supabase admin RPC/RLS/settings/audit

### Backend/helper
- `api/send-push.js`
- `api/share.js`
- **payment gateway backend BuatQris: belum diimplementasikan**

## 4. Alur bisnis utama

### Seller
```text
Register/Login
  → Profile
  → Product / Link / Social / Gallery
  → Theme
  → Checkout settings
  → Public store
  → menerima order
  → melihat status/rekap/nota
```

### Buyer
```text
Public store
  → Product
  → Checkout
  → Payment QRIS dynamic (target)
  → Webhook payment
  → Order paid
```

Fallback/legacy sementara selama migrasi payment:
```text
QRIS manual
  → upload bukti
  → seller review
```

### Premium
```text
User request Premium
  → Admin reviews proof/request
  → Approve/Reject
  → approved_amount dicatat sebagai nominal historis
  → plan + plan_end_date updated
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

Public store sekarang sudah memiliki responsive treatment untuk 10 tema. Perubahan berikutnya jangan merusak karakter/layout tema yang sudah disetujui.

## 6. Admin Master financial model

Admin Master harus membedakan minimal dua jenis pendapatan platform:

1. **Pendapatan Premium** — berdasarkan `premium_requests.approved_amount` historis untuk request yang benar-benar disetujui.
2. **Pendapatan layanan transaksi seller** — `platform_fee` dari order yang berhasil dibayar.

Jangan mencampur:
- omset seller,
- pendapatan platform,
- gateway fee,
- reserve biaya withdrawal seller,
- dan saldo provider.

Admin Master target menampilkan:
```text
Saldo/pendapatan Premium
Pendapatan layanan transaksi seller
Total pendapatan platform
Order paid
Seller earnings / kewajiban ke seller
Gateway fees
Reserve withdrawal seller
```

**Catatan penting:** angka "saldo" platform tidak boleh dianggap sebagai saldo bank/provider tanpa bukti settlement. Gunakan istilah ledger/pendapatan/receivable secara tepat.

## 7. Payment gateway — keputusan produk

**Provider utama MVP:** BuatQris (`https://app.buatqris.site`).  
**Berlaku untuk:** seller Free dan Premium.  
GoPay Merchant bukan payment gateway utama NiagaBio untuk fase ini.

Secret credential wajib server-side:
- `BQ_ACCOUNT_ID`
- `BQ_SECRET_TOKEN`

Frontend tidak boleh menerima atau menyimpan secret tersebut.

### Model checkout target
Contoh produk Rp50.000:
```text
Harga produk                Rp50.000
Reserve withdrawal seller   Rp2.500
Platform fee NiagaBio       Rp1.000
------------------------------------
Total buyer target          Rp53.500
```

**Catatan:**
- Rp2.500 adalah reserve/beban model bisnis untuk biaya withdrawal seller, bukan otomatis biaya transaksi BuatQris.
- Fee transaksi gateway aktual harus berasal dari respons/provider, tidak boleh ditebak atau di-hardcode.
- `platform_fee` adalah pendapatan NiagaBio.
- `seller_earning` adalah hak seller dan harus dicatat terpisah.
- `gateway_fee` harus dicatat terpisah.
- Perubahan fee di Admin Master tidak boleh mengubah order lama; order harus menyimpan snapshot fee saat transaksi dibuat.

### Ledger minimal yang direncanakan
```text
subtotal
platform_fee
withdrawal_reserve
gateway_fee
buyer_total
seller_earning
platform_earning
payment_provider
provider_transaction_id
payment_status
paid_at
```

## 8. Security invariants

- Jangan expose service-role key di frontend.
- Jangan expose `BQ_SECRET_TOKEN` di frontend, GitHub, atau Supabase table publik.
- Payment gateway dipanggil melalui backend/serverless.
- Webhook provider harus diverifikasi sesuai mekanisme signature/secret yang tersedia.
- Jangan mematikan RLS untuk debugging production.
- Public store memakai RPC/endpoint terkontrol, bukan membuka tabel sensitif langsung.
- Bukti pembayaran lama/private tetap mematuhi bucket policy aktif.
- Admin action harus dibatasi role/RPC/RLS.
- Patch SQL production harus dibaca dan diuji sebelum dijalankan.

## 9. Source of truth untuk AI

Urutan baca wajib:
1. `PRD.md`
2. `SkilAi.md`
3. `README.md`
4. `Folder-structure.md`
5. `docs/PAYMENT_GATEWAY_PLAN.md` bila task payment
6. dokumen relevan lain di `docs/`
7. file source terkait
8. `supabase/*.sql` bila task menyentuh database/security

Dokumen sejarah/patch note bukan source of truth.

## 10. Task aktif sekarang

### TASK P0 — Payment Gateway BuatQris + Ledger + Admin Master Finance

Urutan implementasi:
```text
1. Finalisasi model ledger & fee
2. Migration database payment/ledger
3. Admin Master settings platform_fee + withdrawal_reserve
4. Backend serverless BuatQris
5. Create payment + return QR/payment_url
6. Webhook + signature verification
7. Mapping status payment → orders
8. Checkout UI
9. Seller Orders/Rekap/Nota
10. Admin Master financial dashboard
11. Sandbox end-to-end test
12. Regression/security audit
```

### Non-scope sementara
- payout/disbursement otomatis ke rekening seller
- KYC otomatis
- multi-provider payment
- GoPay Merchant sebagai gateway utama
- perubahan framework

## 11. Admin invariants yang sudah diketahui

- `approved_amount` dipakai sebagai nominal historis approval Premium.
- Expiring stats harus memperhatikan status user.
- Error query tidak boleh diam-diam berubah menjadi data kosong.
- Access denied/admin UI harus konsisten dengan DOM aktual.

## 12. UI/UX invariants terbaru

- Toast aplikasi: kanan atas, radius ringan.
- Product editor: satu modal untuk tambah/edit, mobile scroll aman.
- Harga input: format visual Rupiah, parse menjadi integer sebelum save.
- File picker seller/admin: tampilan custom/polished, tetap memakai native file input dan handler existing.
- Public store: 10 tema responsive dan karakter layout dipertahankan.
- Order KPI mobile: nilai Rupiah harus tidak overlap/wrapping.


## Payment foundation update — 2026-08-25
P0/P1 foundation is now implemented in `supabase/23_payment_ledger_foundation.sql`. Payment API/backend and checkout automation remain pending.

## Payment Gateway Milestone — P3
BuatQris is the primary payment gateway for Free and Premium sellers. Checkout creates a gateway-backed order, shows the provider QR/payment URL, and receives payment state through webhook. The Admin Master owns platform fee and withdrawal reserve configuration. Provider fees are recorded separately from platform income.
