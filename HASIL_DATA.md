# AUDIT LOGIC & SECURITY — NiagaBio (Tim Nia, Johan, Ema)

**Tanggal Audit:** Rabu, 26 Agustus 2026  
**Auditor:** Nia (Lead), Johan (Investigator), Ema (Generalist)  
**Status:** CRITICAL ISSUES FOUND  

---

## 1. TEMUAN KRITIKAL (P0)

### BUG-01: Blokir Total Metode `qris_buatqris` di Database
- **File/Function:** `supabase/15_order_proof_antispam_hardening.sql` -> Trigger `validate_order_public_fields_v15_order_hardening`.
- **Bukti:** 
  ```sql
  if new.payment_method not in ('qris_manual', 'qris_whatsapp') then
    raise exception 'Checkout hanya menerima QRIS manual' ...
  end if;
  ```
- **Dampak:** Setiap pesanan dengan metode `qris_buatqris` (yang dihasilkan oleh RPC baru di Migration 24) akan DITOLAK oleh database. Checkout otomatis BuatQris saat ini **TOTAL RUSAK**.
- **Recommended Fix:** Update trigger `validate_order_public_fields` untuk mengizinkan `qris_buatqris` dan mengizinkan `proof_image_url` kosong khusus untuk metode ini.

### BUG-02: Kebocoran Data Ledger (Accounting Hole)
- **File/Function:** `supabase/24_buatqris_payment_gateway.sql` -> RPC `apply_buatqris_payment_event`.
- **Bukti:** 
  ```sql
  set platform_earning = platform_fee
  ```
- **Dampak:** Nilai `withdrawal_reserve` (contoh: Rp2.500) dikumpulkan dari pembeli tetapi TIDAK dicatat ke dalam earning mana pun saat settlement. Uang tersebut "menguap" dari catatan akuntansi ledger `platform_earning`.
- **Recommended Fix:** `platform_earning` harus mencakup `platform_fee + withdrawal_reserve` (sesuai PRD) atau dipisahkan ke kolom earning cadangan.

---

## 2. TEMUAN HIGH (P1)

### BUG-03: Formula Pembulatan & Gateway Fee
- **Masalah:** `buyer_total` pada `orders` dihitung saat insert tanpa `gateway_fee`. API `create.js` kemudian melakukan PATCH `buyer_total` berdasarkan respons provider.
- **Dampak:** Terjadi ketidakkonsistenan antara data `orders` awal dengan data `payment_transactions`. Jika pembeli melihat total di UI sebelum QRIS muncul, harganya bisa "melompat" tiba-tiba setelah QRIS dibuat.
- **Bukti:** `23_payment_ledger_foundation.sql` menghitung total tanpa gateway fee, sedangkan BuatQris seringkali menambahkan fee ke buyer.

### BUG-04: Resiko State Machine Transaksi
- **Masalah:** Belum ada mekanisme pembersihan otomatis (cron/worker) untuk order `pending` yang sudah `expired` di sisi BuatQris tapi belum menerima webhook.
- **Dampak:** Stok produk (jika nanti ada fitur stok) atau tampilan dashboard seller akan penuh dengan order "sampah" yang sebenarnya sudah kadaluarsa di provider.

---

## 3. TEMUAN MEDIUM & LOW (P2/P3)

### BUG-05: Persistence Checkout (UX)
- **Masalah:** `assets/js/checkout.js` tidak menyimpan `order_id` di `localStorage`.
- **Dampak:** Jika pembeli tidak sengaja me-refresh halaman setelah QRIS muncul, mereka harus mengisi form dari awal dan membuat `order_id` baru (duplikasi data di database).

### BUG-06: Duplikasi Logika Validasi
- **Masalah:** Logika validasi nama pembeli dan nomor telepon ada di 3 tempat: `supabase-client.js` (frontend), `create_public_order` (RPC), dan `validate_order_public_fields` (Trigger).
- **Dampak:** Jika ada perubahan aturan bisnis (misal: panjang nama), harus mengubah 3 file. Saat ini ada sedikit perbedaan limit karakter antara frontend dan trigger.

---

## 4. CONFLICT MAP (Logic Overlap)

**Alur Konflik:**
`Migration 13 (Legacy)` -> `Migration 15 (Hardening)` -> `Migration 24 (BuatQris)`

- **RPC `create_public_order`:** Migration 24 berhasil menimpa Migration 15. (OK)
- **Trigger `validate_order`:** Migration 15 masih aktif dan TIDAK TAHU tentang `qris_buatqris`. (CONFLICT - BLOCKING)
- **Function `protect_orders_fields`:** Migration 25 berhasil menimpa Migration 24. (OK)

---

## 5. PAYMENT FLOW MAP (Actual)

1. **Frontend:** `NB.createPublicOrder()` -> RPC Database (Berhasil insert `orders` status pending).
2. **Frontend:** Call `/api/payment/create` -> Backend Vercel.
3. **Backend:** Call BuatQris API -> Dapatkan QRIS & `transaction_id`.
4. **Backend:** Insert `payment_transactions` & PATCH `orders` (Bind data provider).
5. **Webhook:** BuatQris -> `/api/payment/webhook` -> RPC `apply_buatqris_payment_event`.
6. **Settlement:** Database mengupdate `orders` menjadi `paid` dan menghitung `earnings`.

---

## 6. DATABASE ACTIVE LOGIC

| Object Name | Last Migration | Status | Note |
|---|---|---|---|
| `public.orders` (Table) | 24 | Active | Memiliki kolom ledger baru. |
| `create_public_order` (RPC) | 24 | Active | Support `qris_buatqris`. |
| `protect_orders_fields` (Trigger) | 25 | Active | Guard finansial aman. |
| `validate_order_...` (Trigger) | 15 | **BLOCKING** | Memblokir metode pembayaran baru. |
| `apply_buatqris_...` (RPC) | 24 | Active | Ledger settlement logic. |

---

## 7. TOP 10 BUG TERPENTING
1. **Trigger v15 memblokir qris_buatqris (Total Block).**
2. **Withdrawal reserve tidak masuk ke platform_earning (Accounting Loss).**
3. **Gateway fee tidak dihitung dalam buyer_total awal (Price Jump).**
4. **Validasi trigger v15 mewajibkan proof_image_url untuk semua QRIS (Total Block).**
5. **Ketidaksesuaian kontrak limit karakter antara frontend vs database.**
6. **Tiadanya auto-cancel untuk order expired (Stale Data).**
7. **`platform_earning` hanya mencatat `platform_fee` statis.**
8. **Double validation trigger jika migration lama tidak di-drop dengan benar.**
9. **Checkout UI tidak persist session (Poor UX).**
10. **`is_safe_public_image_url` vs `is_safe_proof_reference` (Inconsistency).**

---

## 8. ROOT CAUSE UTAMA
1. **Regression Failure:** Fitur baru (Migration 24) tidak membersihkan/mengupdate trigger validasi lama (Migration 15).
2. **Accounting Incompleteness:** Perencanaan ledger di SQL tidak mengikuti model finansial di PRD secara utuh (kasus `withdrawal_reserve`).
3. **State Management:** Alur checkout dianggap linear (sekali jalan), tidak memperhitungkan interupsi (refresh/error ditengah jalan).

---

## 9. RENCANA PERBAIKAN (FILE & SQL)

### A. SQL yang harus diperbaiki (`supabase/26_fix_audit_findings.sql` - NEW PLAN):
1. **Drop & Recreate** `validate_order_public_fields` untuk:
   - Menambah `qris_buatqris` ke whitelist.
   - Mengizinkan `proof_image_url` kosong jika `qris_buatqris`.
2. **Update** `apply_buatqris_payment_event`:
   - `platform_earning = platform_fee + withdrawal_reserve`.
   - Pastikan `gateway_fee` tidak memotong `seller_earning` jika modelnya adalah buyer-paid.

### B. File yang harus diubah:
1. `assets/js/checkout.js`: Tambah persistence `order_id` sederhana di `sessionStorage`.
2. `api/payment/create.js`: Tambah log audit yang lebih detil untuk debugging provider.

---

## 10. TEST PLAN

### Happy Path:
- Checkout produk -> Scan QRIS -> Bayar -> Webhook masuk -> Dashboard Seller muncul "Paid" -> Rekap Earning benar (Subtotal + Fee + Reserve).

### Failure Path:
- QRIS Expired -> Webhook masuk -> Order otomatis "Cancelled".
- User refresh saat QRIS muncul -> Halaman tetap menampilkan QRIS yang sama (Resumption).

### Security Test:
- Seller mencoba update `seller_earning` sendiri via konsol -> Harus GAGAL (Protected by Trigger P25).
- Buyer mencoba bypass `platform_fee` -> Harus GAGAL (Recalculated on Insert & Settlement).

---

**Prioritas:**
- **P0:** Perbaikan Trigger v15 & Accounting Settlement (Wajib sebelum testing).
- **P1:** Price consistency & UX Resumption.
