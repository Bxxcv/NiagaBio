# SECURITY AUDIT — NiagaBio

Tanggal/Waktu Audit: 2026-09-06T00:00:00Z
Commit yang diaudit: 404bcddfe0ca666424f6510bd24604cf45ab5f50
Auditor eksternal: Security AI (role: external auditor)

Catatan metadata: saya membaca PRD.md, SkilAi.md, docs/PAYMENT_GATEWAY_PLAN.md dan file sumber di folder api/, lib/, assets/js/, serta semua supabase/*.sql yang relevan sebelum menulis laporan. Hasil pencarian kode mungkin tidak lengkap (search limited); lihat lebih banyak hasil di repo: https://github.com/Bxxcv/NiagaBio/search?q=buatqris&type=code

---

Ringkasan singkat (langsung):
- Temuan Critical: 2
- Temuan High: 3
- Temuan Medium: 3
- Temuan Low: 2

Prioritas perbaikan (urut):
1) Perbaiki trigger/validasi DB yang memblokir metode qris_buatqris (Critical).
2) Pastikan ledger settlement mencatat withdrawal_reserve dengan benar dan tidak menimbulkan "lost money" (Critical).
3) Perkuat/verifikasi idempotency & signature webhook (High).
4) Periksa akses/ownership di endpoints create/status (High).
5) Others: rate limit hardening, UX persistence, reconcile gateway fee handling.

---

Detail temuan (format: Severity / File + baris / Deskripsi / Skenario eksploitasi / Rekomendasi)

1) Severity: Critical
File + baris: supabase/15_order_proof_antispam_hardening.sql (trigger validate_order_public_fields, migration 15) — kontekst: trigger v15 yang aktif di DB (lihat file migration/trigger references di repo, validate_order_public_fields_v15...)
Deskripsi: Trigger validasi lama (migration 15) menolak metode payment selain 'qris_manual' dan 'qris_whatsapp' sehingga metode baru 'qris_buatqris' diblokir pada level DB. Ini membuat alur checkout otomatis (createPublicOrder + /api/payment/create) gagal karena insert/update orders terhalang.
Skenario eksploitasi: bukan eksploitasi oleh attacker, tetapi regresi fungsional kritikal — buyer mencoba checkout, order ditolak oleh DB, UX gagal, revenue flow terhenti.
Dampak: Kegagalan checkout massal untuk semua pengguna yang memilih qris_buatqris; bisnis tidak menerima pembayaran.
Rekomendasi: Segera perbarui trigger validasi untuk memasukkan 'qris_buatqris' dalam whitelist dan izinkan proof_image_url kosong untuk metode gateway. Pastikan perubahan diuji di sandbox dan dicatat di migration terpisah (tidak menjalankan SQL di production tanpa review).

2) Severity: Critical
File + baris: supabase/24_buatqris_payment_gateway.sql / supabase/26_fix_audit_findings.sql (function apply_buatqris_payment_event) — baris update orders settlement
Deskripsi: Pada versi migration awal, penulisan settlement pada orders/ledger tidak memasukkan withdrawal_reserve ke dalam pencatatan pendapatan platform (atau ada inkonsistensi antara beberapa migration). Beberapa migration (26, 28) menunjukkan konflik dokumentasi/implementasi tentang apakah platform_earning harus mencakup withdrawal_reserve atau tidak. Ada risiko accounting hole: withdrawal_reserve diambil dari buyer tetapi tidak tercatat ke ledger mana pun.
Skenario eksploitasi: seorang operator atau proses yang mengandalkan rekap keuangan akan melihat selisih; tidak eksploitasi langsung tetapi berakibat uang "hilang" di laporan dan potensi audit/regulasi finance failure.
Dampak: Laporan keuangan tidak konsisten; saldo withdrawable/rekonsiliasi admin akan salah; potensi audit/keuangan bermasalah.
Rekomendasi: Konsolidasikan kebijakan di PRD sebagai sumber kebenaran (platform_earning = platform_fee; withdrawal_reserve terpisah) atau secara tersurat: platform_earning = platform_fee dan withdrawal_reserve disimpan di kolom terpisah, atau platform_earning = platform_fee + withdrawal_reserve (pilih satu). Perbarui semua migration/implementasi RPC apply_buatqris_payment_event/patch agar formula konsisten, tambahkan unit/integration test untuk rekonsiliasi ledger. Jangan mengubah RLS atau menonaktifkannya.

3) Severity: High
File + baris: api/payment/webhook.js (readRawBody + HMAC verification / signHmac in lib/buatqris.js) — lines: webhook handler
Deskripsi: Webhook memverifikasi HMAC signature dengan signHmac(rawBody, secret) dan safeTimingEqual(expected, signature). Code uses Buffer and crypto.timingSafeEqual with an equality length check. Implementation appears correct (sign only raw body, compare with timing-safe equal and check secret configured). However: potential pitfalls observed:
- If the signature header is missing or signing secret missing, handler returns 401 or 500. That is OK but must ensure logging doesn't leak secret.
- safeTimingEqual compares Buffers only if lengths equal; if lengths differ it returns false — that is expected. No obvious timing attack because crypto.timingSafeEqual used.
Skenario eksploitasi: low likelihood of HMAC bypass. But misconfiguration (missing BQ_SIGNING_SECRET in env) could cause webhook to return 500 and block settlement. Also if deployment uses a proxy that modifies raw body (e.g., JSON parser earlier or encoding changes), signature verification will fail. If the service uses different canonicalization, forged signature attempts will fail.
Dampak: If signature verification is faulty or raw body not preserved, webhooks may be rejected or, worse, improperly accepted. Current code appears sound but must ensure Vercel and any proxies preserve raw body and header naming (x-buatqris-signature).
Rekomendasi: Keep current raw-body HMAC approach. Extra recommendations: (a) Log only presence of signature and verification result (no secret), (b) add explicit check and alert if BQ_SIGNING_SECRET missing on startup/deploy, (c) record webhook delivery_id & raw headers for forensics (without storing raw secrets), (d) add rate limiting on webhook endpoint or verify delivery ids to avoid replay storms.

4) Severity: High
File + baris: api/payment/create.js and api/payment/status.js — ownership checks and exposure of order_id
Deskripsi: Endpoints accept order_id and fetch payment_transactions/orders via Supabase service role (supabaseRequest with SERVICE_ROLE key). There is no explicit ownership check in these endpoints verifying that the requester (browser user) is the same buyer or authorized actor for that order. The assumption in PRD/README is that RLS and triggers protect data; however these endpoints run server-side with service_role and thus bypass RLS. The code relies on callers to present order_id only for orders they own, but server-side code must enforce ownership/permission.
Skenario eksploitasi: Malicious user A crafts a request to /api/payment/create or /api/payment/status for order_id belonging to user B. Since the endpoint uses service role to read order data and does not check that req identifies the same buyer/user (no verifyAuth() usage or JWT check in these handlers), attacker could obtain QR data (qr_url/payment_url) or obtain payment transaction state for other orders. That can leak sensitive info and allow tracking of other users' payments or attempt to force re-creation of payment transactions for other orders.
Dampak: IDOR — information disclosure of payment URLs, ability to re-trigger provider create (if create endpoint allows creating a payment for arbitrary order), potential race or duplicate transactions charged to buyers not intended.
Rekomendasi: Enforce authorization on these endpoints. For buyer-facing endpoints that accept an order_id, validate that the requester (via cookie/JWT or a validated token) matches order.buyer identity or that order is public resource with restrictions. If endpoint is intended to be callable anonymously (public store checkout), ensure createPublicOrder flow prevents attackers from querying arbitrary order_ids (e.g., make order id unguessable or require a per-order client token). Specifically: call verifyAuth() / check Supabase JWT or require a short-lived order token stored in the order record to validate create/status calls. Do NOT use service_role queries without an associated auth check.

5) Severity: High
File + baris: api/payment/_supabase.js & other serverless functions — use of SUPABASE_SERVICE_ROLE_KEY in serverless functions and logging
Deskripsi: All serverless payment handlers use SUPABASE_SERVICE_ROLE_KEY for requests to REST endpoints. This is required. However, ensure these service-role calls are never reachable from client-side, and that any errors/logging do not leak keys. I found supabaseRequest implementations that add the service key in Authorization header — fine server-side.
Skenario eksploitasi: If any serverless function accidentally returns or logs the service role key (e.g., logging full response with headers or provider content), keys could be leaked. Also attacker exploiting SSR misroute might call endpoints that leak debug stack with env values.
Dampak: Service-role key compromise => full DB access.
Rekomendasi: Audit logs to avoid printing process.env values; confirm no stack traces return env. Ensure Vercel function environment variables are configured using secrets and not accidentally surfaced. Add structured error handling that never returns internal error text in production.

6) Severity: Medium
File + baris: api/payment/status.js (rate limiting) and api/payment/create.js (rate limiting in-memory)
Deskripsi: Rate limiting uses an in-memory Map keyed by x-forwarded-for or socket remoteAddress. On serverless (Vercel), this is per-instance and resets on cold start; attackers can rotate source IPs (via proxies) or spoof X-Forwarded-For if the deployment is behind a permissive CDN. Also Map keyed by IP allows circumvention by distributed bots.
Skenario eksploitasi: Attacker floods status/create endpoints causing provider API abuse or spamming create operations, causing real charges or exhausting rate quotas.
Dampak: Denial-of-service to payment provider quotas, spam transactions, increased cost.
Rekomendasi: Move rate limiting to a persistent store (Redis) or use Vercel/Cloudflare rate-limiting edge rules. Validate/protect X-Forwarded-For by relying on platform-provided header or use per-account throttles (seller/account-based) rather than IP-only. Ensure status endpoint rate-limit applies per order_id and per account.

7) Severity: Medium
File + baris: assets/js/checkout.js — persistence UX and potential duplicate orders
Deskripsi: Checkout saves order snapshot to sessionStorage on submit; current code in repo shows persistence is implemented (sessionStorage.setItem) — earlier audit had flagged lacking localStorage but code now persists to sessionStorage. However sessionStorage is per-tab and lost on tab close; attacker could replay requests and create many orders.
Skenario eksploitasi: Non-malicious: user refreshes and duplicates orders; malicious: attacker scripts create many fake orders.
Dampak: database spam, pending orders backlog.
Rekomendasi: Implement a dedup token for createPublicOrder (server-side dedup guard) tied to buyer session or fingerprint, and ensure create_public_order RPC enforces dedup by recent identical attempts. Persist order id in sessionStorage is OK but consider also exposing a resumable short token to client and server to avoid duplicates.

8) Severity: Medium
File + baris: supabase/26_fix_audit_findings.sql and supabase/28_sandbox_wallet_isolation.sql — sandbox/live isolation and is_test
Deskripsi: Several migrations touch is_test propagation and platform_earning calculation. There are conflicting comments across migrations. It's critical sandbox/test payments cannot affect production wallet balances. Migration 28 attempts to add orders.is_test and ensure get_seller_wallet_summary excludes is_test orders.
Skenario eksploitasi: If is_test not reliably set/locked, sandbox transactions might be included into seller balances or reconciliations, allowing fake balances.
Dampak: Incorrect seller balances, potential fraudulent withdrawals.
Rekomendasi: Ensure orders.is_test is set at insertion time correctly and immutable for non-admin; protect it via protect_orders_fields trigger (done in some migrations). Add tests to ensure wallet summaries exclude is_test and that webhook/test flag propagation is sticky and immutable.

9) Severity: Low
File + baris: lib/buatqris.js — logging of provider response
Deskripsi: buatQrisRequest logs provider body via console.info('[NiagaBio] [BuatQris] raw response', { body: JSON.stringify(body).slice(0, 1200) }). This is useful for debugging but might include provider-returned PII or tokens if provider returns sensitive fields.
Skenario eksploitasi: If logs are shipped to a logging provider accessible by many parties, sensitive provider returned data (though unlikely to include secrets) might be exposed.
Dampak: Information disclosure in logs.
Rekomendasi: Keep logs truncated (they are truncated) and ensure logging system redacts secrets. Do not log environment secrets. Add explicit redaction for any fields known to be sensitive.

10) Severity: Low
File + baris: api/payment/create.js — amount consistency & buyer_total mismatch
Deskripsi: create.js constructs amount from order.buyer_total and provider returns provider.total_amount and admin_fee. Code writes provider_total_amount and gateway_fee to payment_transactions and patches orders.buyer_total = greatest(provider.total_amount, buyer_total). This is acceptable, but initial buyer_total stored at insert time might not include gateway_fee causing a visible UI jump. It's a UX/data consistency issue more than pure security.
Skenario eksploitasi: An attacker could attempt to manipulate displayed prices, but protect_orders_fields prevents browser from setting financial fields.
Dampak: Confusion and potential customer complaints.
Rekomendasi: Consider making buyer_total in orders null until provider returns, or set display semantics to show provider_total predicted. Also ensure reconciliation tests.

---

Areas verified as SAFE (short):
- Webhook HMAC verification is implemented against raw body and uses crypto.timingSafeEqual — AMAN (implementation uses safeTimingEqual and signHmac correctly). Ensure environment and proxies preserve raw body.
- protect_orders_fields trigger pattern: browser cannot mutate settlement fields — AMAN (RLS + trigger approach documented across migrations).
- SUPABASE_SERVICE_ROLE_KEY is only used server-side (api/payment/_supabase.js) and not in frontend — AMAN (but must ensure no accidental exposure in logs or UI).

---

Additional operational recommendations (non-code changes):
- Add end-to-end tests for create→webhook→settlement including idempotency and replay protection.
- Add alerting on webhook failure rates and signature verification failures.
- Use a hardened rate-limiter (Redis or edge) for payment endpoints and per-order throttles.
- Add short-lived per-order token to authorize /api/payment/create and /api/payment/status calls to avoid IDOR when order_id is guessable.

---

Kesimpulan & tally:
- Critical: 2 (DB trigger blocking qris_buatqris; accounting/ledger hole for withdrawal_reserve)
- High: 3 (IDOR/ownership missing on server-side endpoints; webhook operational hardening; service-role usage/log hygiene)
- Medium: 3 (rate limit bypassability; sandbox/live isolation risk; duplicate-order prevention)
- Low: 2 (logging of provider responses; buyer_total UX mismatch)

Urutan perbaikan (praktis):
1) Fix DB trigger (migration/trigger update) to allow qris_buatqris and proof_image_url empty where appropriate. Test in sandbox.
2) Fix ledger settlement logic and define canonical accounting (PRD source of truth). Add reconciliation test.
3) Enforce authorization on serverless endpoints that use service_role (require JWT/verifyAuth or per-order token). Do not trust order_id alone.
4) Harden webhook delivery handling (delivery_id idempotency, rate-limit, logging). Ensure raw body preserved.
5) Move rate-limiting to an external persistent service or edge rules and apply per-order/account quotas.

---

Catatan proses (apa yang saya lakukan):
- Saya membaca PRD.md, SkilAi.md, docs/PAYMENT_GATEWAY_PLAN.md and scanned repo files in api/, lib/, assets/js/, supabase/*.sql to ground findings. Pencarian kode terbatas (results capped) — lihat pencarian lanjutan di: https://github.com/Bxxcv/NiagaBio/search?q=buatqris&type=code
- Saya menulis laporan ini ke HASIL_DATA.md di repository Anda (meng-overwrite isi lama) dan membuat commit "docs: security audit report 2026-09-06".

---

Jika Anda mau, saya dapat:
- Menambahkan contoh checklist test-case (per-issue) untuk tim QA/Dev.
- Membuat PR draft untuk docs (non-code) yang menjelaskan perubahan DB yang diusulkan agar cepat ditinjau.

---

Disclaimer: hasil pencarian kode mungkin tidak lengkap — beberapa file besar atau pola nama lain mungkin belum tercakup oleh search yang saya jalankan. Untuk melihat lebih banyak hasil: https://github.com/Bxxcv/NiagaBio/search?q=buatqris&type=code
