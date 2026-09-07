2026-09-07T00:00:00Z — Audited commit: 404bcddfe0ca666424f6510bd24604cf45ab5f50

# LOGIC & SECURITY AUDIT — NiagaBio
Role: External security & logic auditor (read-only audit; single allowed write: HASIL_DATA.md)

Source of truth read in order before code: PRD.md, SkilAi.md, docs/PAYMENT_GATEWAY_PLAN.md
Files examined (selection): api/, lib/, assets/js/, supabase/*.sql (migrations 23..28), README.md

Note: code search has result limits; I may have missed unrelated files. Full repo search: https://github.com/Bxxcv/NiagaBio/search?q=repo%3ABxxcv%2FNiagaBio&type=code

---

EXECUTIVE SUMMARY
- Focus: logic correctness across checkout/payment/withdrawal and quick security checks.
- Active Critical findings: 1
- Active High findings: 2
- Active Medium findings: 4
- Active Low findings: 1

Top remediation priorities (short):
1) Critical: ensure provider-created transactions are durably recorded (create flow resilience + webhook reconciliation).
2) High: require ORDER_ACCESS_SECRET (fail-closed) to prevent IDOR; remove permissive fallback.
3) High: add reconciliation/upsert behavior when webhook arrives before local ledger.
4) Medium: centralize rate-limiting and implement per-order idempotency.
5) Medium: enforce migration ordering and test is_test isolation.

---

DETAILED FINDINGS

1) Severity: Critical
- File + lines: api/payment/create.js — provider create -> insert payment_transactions -> PATCH orders sequence
- Deskripsi (kenapa logic bug): The server calls the external provider (createQris) and then inserts a local payment_transactions row and patches orders. If the DB insert/PATCH fails after provider returns success (transient network/DB error, race), the provider transaction exists but local ledger is missing or inconsistent. The webhook settlement RPC (apply_buatqris_payment_event) requires an existing payment_transactions row and will raise 'Payment transaction not found' if absent, leading to failed settlement and unreconciled funds.
- Migration/version: serverless code (P3 backend) and RPC apply_buatqris_payment_event (migrations 24/26/28) — current behavior in active code.
- Skenario konkret: provider returns transaction_id; server fails to persist local tx due to Supabase outage; buyer pays; webhook arrives and RPC errors with P0002; funds not reflected in ledger or seller wallet.
- Dampak: real money collected but not recorded; manual reconciliation, potential lost revenue, order fulfillment failures and disputes.
- Rekomendasi: make the create flow resilient/transactional: ensure durable local record before returning success (retry with idempotency keys), or record provider-created events in a durable incoming_webhooks queue on webhook receipt, or perform safe upsert of payment_transactions from webhook when missing (marking imported entries). Add monitoring/alerting for missing-local-tx conditions and an automated reconciliation worker.


2) Severity: High
- File + lines: lib/buatqris.js (orderAccessToken, verifyOrderAccessToken) and api/payment/create.js & api/payment/status.js (access token checks)
- Deskripsi (kenapa logic bug): verifyOrderAccessToken(...) intentionally returns true if ORDER_ACCESS_SECRET env var is empty (fallback permissive). This means that if ORDER_ACCESS_SECRET is not configured (deployment misconfiguration), endpoints that rely on this check will grant access to any caller for existing provider transactions branch, enabling IDOR/data leakage.
- Migration/version: serverless code (current) — active.
- Skenario konkret: in a deployment without ORDER_ACCESS_SECRET set, an attacker who knows or guesses an order_id can request /api/payment/create (existing branch) or /api/payment/status and obtain QR/payment_url or transaction state for orders they don't own.
- Dampak: IDOR — exposure of payment URLs and transaction data; privacy and payment integrity issues.
- Rekomendasi: fail-closed: if ORDER_ACCESS_SECRET is unset, reject attempts and surface a deploy-time error/alert. Change verifyOrderAccessToken to return false (or 403/503) when secret is missing. Add deploy checklist/tests ensuring ORDER_ACCESS_SECRET exists before enabling payment endpoints.


3) Severity: High
- File + lines: api/payment/webhook.js and supabase RPC apply_buatqris_payment_event (supabase/24_..., 26, 28)
- Deskripsi (kenapa logic bug): Webhook handler verifies signature and directly calls apply_buatqris_payment_event which expects an existing payment_transactions row. If webhook arrives before the payment_transactions insert (race) or that insert failed, RPC raises 'Payment transaction not found' and webhook processing fails. There is no durable queue/backfill path; transient failures may lead to unreconciled payments.
- Migration/version: current RPC (migration 28 is authoritative for financial semantics) still requires payment_transactions to exist — active.
- Skenario konkret: provider posts payment.success quickly; local INSERT hasn't completed or failed; webhook fails; provider may retry but if exhausted payment remains unrecorded.
- Dampak: missed settlements, manual ops burden, possible customer/seller impact.
- Rekomendasi: when RPC indicates missing payment_transactions, persist the webhook payload (delivery id, raw body, headers) to a durable table and either return 200 (ack) or 202, and process asynchronously (with careful consideration of provider retry and idempotency). Alternatively, attempt a safe upsert/create of payment_transactions from webhook data (marking origin=webhook/imported) if enough data exists. Add a reconciliation worker scanning provider transactions vs local ledger.


4) Severity: Medium
- File + lines: api/payment/create.js (amount rounding and buyer_total usage)
- Deskripsi (kenapa logic bug): Money handling occurs in multiple places with rounding (Math.round(Number(order.buyer_total)), trigger-calculated buyer_total, provider-returned provider.total_amount). Inconsistent rounding or decimal handling can lead to small mismatches and visible price jumps in UI, or rare reconciliation differences.
- Migration/version: supabase/23_payment_ledger_foundation.sql sets snapshot fields; api/payment/create.js and settlement RPC update buyer_total.
- Skenario konkret: buyer sees buyer_total pre-create; provider adds gateway_fee changing total_amount; UI shows different value leading to complaints; rounding edge cases may cause tiny accounting diffs.
- Dampak: UX issues, reconciliation edge-cases.
- Rekomendasi: standardize on integer smallest-currency units across frontend, server, and DB; avoid floating point; add tests for rounding; consider deferring persist of buyer_total until provider response or explicitly surface that fees may change.


5) Severity: Medium
- File + lines: api/payment/status.js & api/payment/create.js — rate limiting (in-memory Map keyed by x-forwarded-for)
- Deskripsi (kenapa logic bug): Rate limiting is per-instance and in-memory on serverless platform; counters reset on cold starts and cannot protect against distributed attacks or IP-spoofing. Reliance on X-Forwarded-For can be dangerous if not sanitized by platform.
- Migration/version: serverless code (active).
- Skenario konkret: distributed attacker rotates IPs or leverages many clients to spam create/status, exhausting provider quotas or costing money.
- Dampak: DoS on provider or increased costs.
- Rekomendasi: move rate-limiting to centralized store (Redis) or use edge/CDN rate limits; prefer per-order or per-account limits rather than IP-only.


6) Severity: Medium
- File + lines: assets/js/checkout.js + create_public_order RPC (supabase) — duplicate order creation / dedup
- Deskripsi (kenapa logic bug): Client persistence is sessionStorage but server-side dedup must handle near-duplicate requests robustly. If dedup relies on identical payloads, small variations (phone format) cause duplicates.
- Migration/version: create_public_order RPC (migration 24+) and frontend code.
- Skenario konkret: user refreshes or double-submits, creating multiple orders; potential double-charges.
- Dampak: DB spam, pending orders, user friction.
- Rekomendasi: implement server-side idempotency token for create_public_order (short-lived), normalize inputs before dedup, and enforce dedup within timeframe.


7) Severity: Medium
- File + lines: supabase/26_fix_audit_findings.sql and supabase/28_sandbox_wallet_isolation.sql — is_test propagation and wallet isolation
- Deskripsi (kenapa logic bug): Migration history shows reconciliation of platform_earning and introduction of orders.is_test in migration 28 to exclude test orders from wallet summaries. If migrations are not applied in correct order across environments, sandbox transactions may affect live balances.
- Migration/version: 28 is authoritative; environments missing 28 are at risk.
- Skenario konkret: staging or some environments run through 26 but not 28; test payments leak into balances.
- Dampak: incorrect balances, fraudulent withdrawals.
- Rekomendasi: enforce migration ordering in CI/CD, include integration tests that confirm is_test exclusion and correct platform_earning formula.


8) Severity: Low
- File + lines: lib/buatqris.js — console.info raw provider response logging
- Deskripsi (kenapa logic bug): provider responses are logged (JSON truncated to 1200 chars) but no explicit redaction of possibly sensitive fields.
- Skenario konkret: logs shipped to centralized system show provider-returned data.
- Dampak: information disclosure in logs.
- Rekomendasi: redact sensitive keys from provider response before logging and ensure logging access controls/retention policies.


AREAS VERIFIED SAFE (short)
- Webhook HMAC verification: AMAN — signHmac(rawBody, signingSecret) + timing-safe compare used; ensure proxy preserves raw body.
- protect_orders_fields + RLS: AMAN — triggers and RLS protect settlement fields from browser mutation.
- Withdrawal state-machine improvements: AMAN — migration 28 adds guards and sticky is_test propagation.


HISTORY / RESOLVED (anti-false-positive)
- Trigger v15 blocking qris_buatqris — RESOLVED by migration 26 (validate_order_public_fields rebuilt). Do not report as active if migration 26+ applied.
- Platform_earning inclusion of withdrawal_reserve — migration 26 applied this but migration 28 corrected back to PRD behavior (platform_earning = platform_fee, withdrawal_reserve separate). Treat 28 as authoritative; check environments.


SUMMARY — counts & priority
- Critical: 1
- High: 2
- Medium: 4
- Low: 1

Fix priority (practical):
1) (Critical) Resilient create flow + webhook reconciliation.
2) (High) Require ORDER_ACCESS_SECRET (fail-closed) to prevent IDOR.
3) (High) Add webhook upsert/reconcile path for missing payment_transactions.
4) (Medium) Centralize rate limiting, add per-order idempotency.
5) (Medium) Enforce migration ordering & test is_test isolation.
6) (Low) Redact provider logs.

---

FOLLOW-UP SUGGESTIONS (ops)
- Automated E2E tests for create → immediate pay → webhook → reconcile, including the race where webhook arrives before DB write.
- Monitoring/alerting for error text 'Payment transaction not found' and create.js 502 path.
- Deploy-time check that ORDER_ACCESS_SECRET exists and fail deployment or disable payment endpoints if missing.

---

I will now commit this file as HASIL_DATA.md and push with message "docs: logic & security audit report 2026-09-07".

