# Stage 22 — Final Notification + Premium Favicon Fix

Tanggal: 2026-08-06

## Fixed

- Replaced secret/Vault-based Supabase -> Vercel push bridge with notification-id bridge.
- Removed dependency on `PUSH_WEBHOOK_SECRET` for push delivery.
- Added `push_delivery_log` idempotency to reduce duplicate push.
- Recreated `orders -> notifications` trigger safely.
- Recreated `notifications -> pg_net -> /api/send-push` trigger safely.
- Kept `notifications` in Supabase Realtime publication.
- Added server-side notification lookup in `/api/send-push`.
- Added invalid FCM token deactivation.
- Added foreground system notification handling and existing NiaPulse flow preservation.
- Kept notification unread badge runtime and realtime refresh.
- Premium active seller custom logo is now applied to storefront and checkout favicon.
- Premium active seller custom logo is now used by server-generated `/api/share` favicon.
- Replaced sidebar overlay button with a non-button overlay element so no extra menu-close button is injected.

## Setup

1. Keep the existing Vercel server variables:
   `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `FCM_PROJECT_ID`, `FCM_CLIENT_EMAIL`, `FCM_PRIVATE_KEY`.
2. Deploy this version.
3. Run only `supabase/22_push_notifications_final.sql` once.
4. Seller clicks `Aktifkan notifikasi` and grants permission.
5. Test with a new order.
