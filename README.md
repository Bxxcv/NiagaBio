# NiagaBio

NiagaBio adalah web app **link-in-bio + toko/katalog + checkout + dashboard seller + Admin Master** untuk UMKM, seller online, creator, dan pengguna HP-first.

## Stack
- HTML
- CSS vanilla
- JavaScript vanilla
- Supabase
- Vercel
- GitHub
- Development dari HP: SPCK Editor + Termux

Project ini **bukan** React/Next/Vue.

## Source of truth
Untuk AI/developer baru, baca berurutan:

1. `PRD.md`
2. `SkilAi.md`
3. `README.md`
4. `Folder-structure.md`
5. `docs/PAYMENT_GATEWAY_PLAN.md` untuk task payment
6. dokumen `docs/` relevan
7. source code terkait
8. `supabase/` bila menyentuh database/security

Patch notes hanya riwayat.

## Alur aktif

```text
Seller:
Register/Login → Profile → Product/Link/Social/Gallery → Theme → Public Store → Orders

Buyer:
Public Store → Product → Checkout → Payment → Webhook → Paid Order

Premium:
Request → Admin review → approved_amount → Premium

Platform finance:
Premium revenue + seller transaction platform_fee → Admin Master ledger/report
```

## Payment decision
**BuatQris** adalah provider payment gateway utama untuk seller Free dan Premium pada fase MVP payment otomatis.

- Secret: Vercel Environment Variables.
- Browser tidak boleh memanggil provider dengan secret.

---

### Patch & Perbaikan Audit (26 Agustus 2025)

| Patch | File | Tujuan | Risiko |
|-------|------|--------|--------|
| `26_fix_audit_findings.sql` | `supabase/26_fix_audit_findings.sql` | Fix BUG-01 (blokir `qris_buatqris`) dan BUG-02 (akunting) | Low (RLS dipertahankan) |
| `assets/js/checkout.js` | `assets/js/checkout.js` | Fix BUG-05 (UX: persistence order saat refresh) | None |
| `api/payment/create.js` | `api/payment/create.js` | Tambahkan log audit request/response provider | None |

- **BUG-01**: Trigger lama memblokir `qris_buatqris` dan memaksa `proof_image_url` wajib, padahal tidak untuk `qris_buatqris`. Patch: whitelist `qris_buatqris`, allow empty `proof_image_url` untuk metode ini, dan hitung `platform_earning = platform_fee + withdrawal_reserve`.
- **BUG-02**: `apply_buatqris_payment_event` tidak memasukkan `withdrawal_reserve` ke `platform_earning` dan mengurangi `seller_earning` dengan `gateway_fee` secara tidak adil. Patch: perbaiki kalkulasi.
- **BUG-05**: Saat user refresh halaman checkout, state hilang dan QRIS tidak muncul. Patch: simpan state di `sessionStorage` dan restore saat load.

Untuk menerapkan patch:
```bash
# Pastikan sudah apply patch 25_payment_security_hardening.sql terlebih dahulu
supabase db reset --db-url "$SUPABASE_DB_URL"
# atau
supabase db patch 26
```

Setelah patch, pastikan env `OPENROUTER_API_KEY` dan `BQ_CALLBACK_URL` terkonfigurasi di Vercel.
- Webhook adalah sumber utama perubahan status payment.
- Provider fee tidak di-hardcode.
- Platform fee dan withdrawal reserve diatur dari Admin Master dan di-snapshot ke order.

## Prinsip penting
- Mobile-first, tetapi desktop harus memanfaatkan viewport dengan baik.
- Cari akar masalah sebelum patch.
- Jangan menebak data/error.
- Jangan mengubah logic/Supabase hanya untuk bug CSS/HTML/JS yang tidak membutuhkan database.
- Security/RLS lebih penting dari tampilan.
- Jangan expose service-role key atau provider secret.
- Setiap perubahan harus divalidasi syntax + flow + regression.


## Payment foundation update — 2026-08-25
P0/P1 foundation is now implemented in `supabase/23_payment_ledger_foundation.sql`. Payment API/backend and checkout automation remain pending.

### Payment Gateway Status
P3 backend integration for BuatQris is implemented in `/api/payment/*` plus Supabase migration `24_buatqris_payment_gateway.sql`. Sandbox-first testing is required before production.

### Latest payment status
P25 security hardening is complete. Run `supabase/25_payment_security_hardening.sql` after migration 24 before the first BuatQris sandbox test.

