# HASIL AUDIT — NiagaBio Checkout & Accounting
**Tanggal audit:** 2026-09-13
**Auditor:** Arise (AI Assistant)
**Scope:** Validasi harga checkout, accounting seller/platform, sandbox isolation, webhook security

---

## 1. MIGRATION AKTIF YANG DIAUDIT

| Migration | File | Fungsi Utama |
|---|---|---|
| 24 | `24_buatqris_payment_gateway.sql` | `apply_buatqris_payment_event` (versi awal) |
| 26 | `26_fix_audit_findings.sql` | `apply_buatqris_payment_event` (patch audit) |
| 28 | `28_sandbox_wallet_isolation.sql` | `apply_buatqris_payment_event` (versi aktif), `get_seller_wallet_summary` |
| 32 | `32_normalize_buyer_phone_dedup.sql` | `create_public_order` (versi aktif) |

---

## 2. HASIL AUDIT PER AREA

### 2.1 Accounting Harga — BENAR

`create_public_order` (migration 32) saat order dibuat:

```sql
gateway_fee    = 0                                          -- belum diketahui
buyer_total    = (product_price * qty) + platform_fee + withdrawal_reserve
seller_earning = product_price * qty                       -- full subtotal
platform_earning = 0                                       -- belum settlement
```

`apply_buatqris_payment_event` (migration 28) saat settlement (webhook success):

```sql
gateway_fee      = p_admin_fee dari provider               -- aktual provider
buyer_total      = greatest(p_total_amount, buyer_total)   -- aktual provider
seller_earning   = order_row.total_price                   -- full product subtotal
platform_earning = order_row.platform_fee                  -- platform_fee saja (PRD s.10)
```

Sesuai PRD section 10:
- `seller_earning` = hak seller penuh, tidak dikurangi gateway_fee
- `platform_earning` = `platform_fee` saja, BUKAN include `withdrawal_reserve`
- `withdrawal_reserve` = cadangan biaya withdrawal, bukan profit platform
- `gateway_fee` = biaya provider aktual dari webhook

**STATUS: BENAR**

---

### 2.2 Sandbox Isolation — BENAR

Migration 28 menambahkan `orders.is_test`:

- `is_test` di-set dari `payment_transactions.is_test` saat settlement
- Sticky: `effective_is_test = coalesce(tx.is_test, false) OR coalesce(p_is_test, false)` — tidak bisa di-flip ke false
- `get_seller_wallet_summary` hanya sum order dengan `is_test = false`
- Webhook `apply_buatqris_payment_event` hanya bisa dipanggil `service_role`

**STATUS: AMAN — sandbox payment tidak masuk withdrawable balance**

---

### 2.3 Webhook Security — BENAR

File: `api/payment/webhook.js`

- HMAC verification via `signHmac` + `safeTimingEqual` (timing-safe compare)
- `BQ_SIGNING_SECRET` dari ENV, bukan hardcode
- Jika secret kosong → 500, bukan bypass
- Idempotency: duplicate `success` webhook hanya update provider refs, tidak re-credit seller
- Out-of-order: order sudah `paid` + webhook bukan `success` → skip, hanya update `is_test`

**STATUS: AMAN**

---

### 2.4 apply_buatqris_payment_event Access Control — BENAR

```sql
revoke all on function ... from public, anon, authenticated;
grant execute on function ... to service_role;
```

Di dalam function:
```sql
if coalesce(auth.role(), '') <> 'service_role' then
  raise exception 'Service role required';
end if;
```

Double guard: revoke + runtime check.

**STATUS: AMAN — seller tidak bisa memalsukan settlement dari client**

---

### 2.5 Dedup Guard Nomor HP — BENAR

Migration 32 menambahkan normalisasi untuk perbandingan dedup:

```sql
dedup_phone_key := case
  when left(clean_buyer_phone, 2) = '62' and length(...) between 10 and 15
    then '0' || substr(clean_buyer_phone, 3)
  else clean_buyer_phone
end;
```

- `081234567890` dan `6281234567890` dianggap sama oleh dedup guard
- Nilai yang DISIMPAN ke DB tidak berubah (`clean_buyer_phone`)
- Window: 2 menit per produk, 15 menit max 5 order per seller

**STATUS: BENAR**

---

### 2.6 Preview Harga di Form Checkout — UX ISSUE (Minor)

**Temuan:** Sebelum buyer klik "Lanjut ke Pembayaran", summary hanya menampilkan subtotal produk. `platform_fee` (Rp1.000) dan `withdrawal_reserve` (Rp2.500) baru muncul setelah QRIS dibuat di `renderPayment`.

**Dampak:** Buyer bisa kaget total berubah dari Rp50.000 menjadi Rp53.500 setelah klik lanjut.

**Bukan bug teknis** — tidak ada data yang salah. Tapi UX-nya misleading.

**STATUS: PERLU FIX UI — belum diimplementasi**

---

## 3. RINGKASAN STATUS

| Area | Status | Prioritas |
|---|---|---|
| Harga RPC (DB) | Benar | - |
| Accounting seller_earning | Benar | - |
| platform_earning vs withdrawal_reserve dipisah | Benar | - |
| Sandbox isolation (is_test sticky) | Aman | - |
| HMAC webhook | Aman | - |
| Idempotency duplicate webhook | Aman | - |
| Access control settlement (service_role only) | Aman | - |
| Dedup nomor HP | Benar | - |
| Preview harga sebelum QRIS (UX) | Issue | P2 |

---

## 4. YANG BELUM DIUJI

- Live provider (BuatQris masih SANDBOX)
- `apply_buatqris_withdrawal_event` — belum diaudit di sesi ini
- RLS policy seluruh tabel terkait (orders, payment_transactions, seller_wallets)
- `get_seller_wallet_summary` edge case (seller tanpa order paid)
- Withdrawal race condition / double spend — tercatat di PRD, belum diverifikasi source

---

## 5. REKOMENDASI NEXT STEP

1. **P2 — Fix preview harga checkout**: Tampilkan breakdown fee sebelum buyer klik lanjut
2. **Audit `apply_buatqris_withdrawal_event`**: Cek withdrawal race condition dan double spend guard
3. **Audit RLS** `orders`, `payment_transactions`, `seller_wallets`
4. **Live test** setelah BuatQris sandbox → production
