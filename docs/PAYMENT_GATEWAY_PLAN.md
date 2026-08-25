# PAYMENT GATEWAY PLAN — NiagaBio × BuatQris

**Status:** PLANNING / next implementation task  
**Last updated:** 2026-08-25

## 1. Keputusan

NiagaBio menggunakan **BuatQris** sebagai payment gateway utama untuk **seller Free dan Premium** pada fase MVP payment otomatis.

GoPay Merchant tidak menjadi gateway utama marketplace pada fase ini. Fitur Kasir/Manajer GoPay dapat dipertimbangkan terpisah untuk operasional offline di masa depan.

## 2. Tujuan

Mengubah checkout dari:
```text
QRIS manual → upload bukti → seller review
```
menjadi:
```text
Checkout
→ create payment
→ QR/payment URL
→ buyer bayar
→ webhook provider
→ order paid
→ rekap/nota/admin finance otomatis mengikuti
```

Legacy/manual proof tidak boleh dihapus sebelum jalur baru terbukti stabil dan migration/rollback plan disiapkan.

## 3. Security boundary

Secret provider:
```text
BQ_ACCOUNT_ID
BQ_SECRET_TOKEN
```

Wajib:
- Vercel Environment Variables.
- Hanya serverless/backend yang membaca secret.
- Tidak boleh dimasukkan ke `assets/js/config.js`.
- Tidak boleh dikirim ke browser.
- Tidak boleh disimpan di public table.

Webhook wajib:
- diverifikasi sesuai mekanisme provider,
- idempotent,
- tidak boleh memproses transaksi dua kali,
- mencatat provider transaction ID.

## 4. Fee model NiagaBio

Default Admin Master:
```text
platform_fee          = Rp1.000 / transaksi
withdrawal_reserve    = Rp2.500 / transaksi
```

Keduanya configurable dari Admin Master.

Contoh target bisnis:
```text
Harga produk             Rp50.000
Withdrawal reserve        Rp2.500
Platform fee NiagaBio     Rp1.000
---------------------------------
Buyer total target       Rp53.500
```

**Penting:**
- `withdrawal_reserve` adalah cadangan/beban model bisnis seller untuk biaya withdrawal, bukan klaim bahwa BuatQris memotong Rp2.500 pada setiap transaksi.
- `gateway_fee` dari provider harus dicatat terpisah dan diambil dari response/settlement provider.
- Jangan double-charge buyer untuk fee yang sudah dibebankan provider jika contract provider menyatakan lain.
- Sebelum production, hitung contoh real menggunakan sandbox dan response provider aktual.

## 5. Ledger

Minimal field yang dibutuhkan:
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

Snapshot wajib dibuat saat payment/order dibuat supaya perubahan Admin Master tidak mengubah transaksi lama.

### Definisi
- `subtotal`: nilai produk sebelum biaya tambahan.
- `platform_fee`: pendapatan layanan NiagaBio.
- `withdrawal_reserve`: cadangan/beban seller yang ditampilkan transparan.
- `gateway_fee`: fee payment provider aktual.
- `buyer_total`: total yang harus dibayar buyer.
- `seller_earning`: hak seller dari penjualan.
- `platform_earning`: pendapatan NiagaBio dari transaksi.

Jangan menganggap `buyer_total`, `platform_earning`, atau `seller_earning` otomatis sama dengan saldo provider.

## 6. Admin Master financial dashboard

Admin Master target menampilkan kartu terpisah:

```text
Pendapatan Premium
Pendapatan Fee Transaksi Seller
Total Pendapatan Platform
Order Paid
Total Hak/Saldo Seller (ledger)
Gateway Fee
Withdrawal Reserve
```

### Premium revenue
Sumber historis:
`premium_requests.approved_amount` untuk request yang statusnya approved.

Jangan memakai harga Premium saat ini untuk menghitung revenue historis.

### Seller transaction revenue
Sumber:
`platform_fee` dari transaksi yang status payment-nya benar-benar paid/sukses.

### Total platform earning
```text
premium_revenue + paid_platform_fee
```

Pisahkan dari gateway fee dan seller earning.

## 7. Database plan

Sebelum coding frontend payment, lakukan audit struktur `orders` dan `app_settings`.

Target:
- `app_settings`: platform fee, withdrawal reserve, provider enable/active config yang aman untuk admin.
- `orders`: snapshot fee/payment fields atau relasi payment transaction.
- `payment_transactions`: provider-specific transaction state jika diperlukan.

Jangan membuat migration hanya berdasarkan dugaan. Baca schema/function/RLS aktual terlebih dahulu.

Migration harus:
- additive/idempotent bila memungkinkan,
- tidak merusak order lama,
- menjaga status legacy manual,
- memiliki RLS/policy sesuai ownership/admin,
- memiliki audit/read-only validation query.

## 8. Backend plan

Planned serverless endpoints:
```text
POST /api/payment/create
POST /api/payment/webhook
POST /api/payment/status
```

### Create
Input minimal:
- seller/order reference
- amount dasar
- platform fee snapshot
- withdrawal reserve snapshot
- callback/webhook reference sesuai provider contract
- sandbox flag saat development

Output ke frontend hanya data pembayaran yang memang boleh public:
- payment URL
- QR URL / QR image reference
- transaction ID non-secret
- expires/status jika tersedia

### Webhook
Tanggung jawab:
1. verify signature/authenticity,
2. validate transaction/reference,
3. idempotency check,
4. update payment transaction,
5. update order payment status,
6. set `paid_at`,
7. update ledger fields,
8. emit notification jika diperlukan.

### Status
Dipakai sebagai:
- fallback/manual check,
- recovery saat webhook terlambat,
- bukan alasan untuk polling agresif dari browser.

## 9. Checkout UX

Buyer harus melihat:
```text
Produk
Subtotal
Biaya layanan NiagaBio
Cadangan biaya withdrawal
Gateway fee (jika memang dibebankan ke buyer)
Total
QR/payment button
Status pembayaran
```

Copy harus transparan dan mudah dimengerti.

Jangan menyebut reserve sebagai "biaya BuatQris" jika itu bukan fee provider yang aktual.

## 10. Free vs Premium

Payment gateway berlaku untuk **keduanya**.

Perbedaan Free/Premium tetap pada fitur produk, theme, limit, analytics, dll.; jangan membuat payment flow menjadi dua sistem berbeda tanpa requirement bisnis.

## 11. Testing plan

### Sandbox
- create payment sukses
- payment pending
- payment success
- payment expired
- payment failed
- duplicate webhook
- webhook out-of-order
- provider timeout
- retry
- invalid signature
- mismatched amount
- mismatched seller/order

### Regression
- manual QRIS legacy masih aman selama migration
- orders lama tetap terbaca
- rekap lama tetap benar
- nota lama tetap bisa dicetak
- Admin Premium revenue tetap benar
- RLS tidak turun
- secret tidak muncul di network/frontend

### UX
- mobile 360px
- mobile 390–430px
- desktop
- payment success
- payment expired
- browser refresh di tengah payment

## 12. Urutan implementasi

```text
P0  Audit schema/RLS/current checkout
P1  Finalize ledger + Admin Master settings
P2  Migration database
P3  Backend BuatQris create/webhook/status
P4  Checkout payment UI
P5  Order/reconciliation/nota
P6  Admin Master financial dashboard
P7  Sandbox end-to-end
P8  Security/regression audit
P9  Production rollout + rollback plan
```

Tidak boleh melompat langsung ke P4 sebelum P0–P2 tervalidasi.

## 13. Pertanyaan/hal yang wajib diverifikasi sebelum production

- Contract API BuatQris yang dipakai akun NiagaBio.
- Exact fee calculation/settlement dari response provider.
- Webhook signature/verification contract.
- Expiration behavior.
- Settlement timing.
- Withdrawal rules terbaru.
- Legal/compliance untuk model biaya/ledger platform.

Jangan mengklaim settlement otomatis atau split payout sebelum provider benar-benar mendukungnya.
