# Stage 23 — Cart + Order Tracking + P0 Payment Forgery Fix

Tanggal: 2026-09-18

## Context

Audit found that seller could flip `payment_status` to `paid` directly from
the client for `qris_buatqris` (gateway) orders, bypassing BuatQris
settlement entirely and crediting fake withdrawable balance. This stage
fixes that, and adds cart + order tracking on top of the same migration
since both touch `orders`/`orders.js`.

## Fixed (P0 security)

- `validate_order_public_fields()` now blocks any `payment_status` change on
  `qris_buatqris` orders unless the caller is `service_role` (webhook only).
  Manual methods (`qris_manual`/`qris_whatsapp`) are unaffected — sellers can
  still mark those paid after checking the uploaded proof, same as before.
- `seller/orders.js`: "Tandai Dibayar"/"Batal" buttons are now hidden for
  `qris_buatqris` orders (UI-level, on top of the DB-level fix above).

## Added (Cart + Order Tracking)

- `orders.order_group_id` (uuid) — links multiple order rows created from
  one cart checkout. Existing rows are backfilled to their own id (self
  group), so old orders stay trackable too.
- `orders.order_status` (fulfillment: pending/processing/ready/completed/
  cancelled) — fully separate from `payment_status`. Seller updates it from
  a dropdown per order row; history is logged in `order_status_history`.
- `create_public_order_batch(...)` — RPC for multi-item cart checkout.
  `platform_fee`/`withdrawal_reserve` are charged once per checkout (on the
  first item only), not once per item, per business decision.
- `apply_buatqris_payment_event(...)` — same signature as before, but on
  success now settles every order row sharing the paid order's
  `order_group_id`, not just the one `payment_transactions` points to.
- `get_order_group_tracking(order_group_id, buyer_phone)` — guest order
  lookup (no account). Does NOT return seller_earning/platform_earning/
  gateway_fee.
- `update_order_status(order_id, new_status)` — seller/admin only, blocks
  changes once an order is `completed`/`cancelled`.
- Buyer flow: "Tambah ke Keranjang" button on product cards + cart drawer
  (`assets/js/cart.js`, localStorage per seller, not synced cross-device) →
  `cart-checkout.html` (multi-item checkout, reuses `/api/payment/create`
  and `/api/payment/status` unchanged) → `track.html` (lacak pesanan by
  order_group_id + WhatsApp number).

## Known limitations (v1, by design)

- No cross-device cart sync (no buyer account = no reliable sync target).
- No auto-resume if buyer reloads mid-payment on `cart-checkout.html` (the
  old single-item `checkout.js` had this too, via `NB.get`, but that
  function doesn't exist in `supabase-client.js` — so it was already
  silently broken there; not replicated here).
- `track.html` shows current status only, not the full `order_status_history`
  timeline (table exists and is populated for future use).
- Per-item `order_status` is independent per row in a cart — if a seller
  wants uniform status across a whole cart checkout, they update each row.

## Setup

1. Review `supabase/36_cart_order_group_tracking_security_fix.sql`, then run
   it once in Supabase SQL Editor. Idempotent (safe to re-run).
2. Deploy this version (no new env vars, no changes to
   `api/payment/create.js`, `api/payment/webhook.js`, `api/payment/status.js`).
3. Smoke test in order:
   - Existing single-item "Beli" flow still works unchanged (regression check).
   - Add 2+ different products to cart, checkout, pay via BuatQris sandbox,
     confirm ALL items flip to `paid` after one webhook.
   - As seller, confirm "Tandai Dibayar"/"Batal" are gone for the
     `qris_buatqris` order above, and try changing `order_status` via the
     dropdown.
   - As seller, on a manual QRIS order, confirm "Tandai Dibayar"/"Batal"
     still work exactly as before.
   - Open `/track.html?order=<order_group_id>` with the buyer's WhatsApp
     number and confirm status shows correctly.
