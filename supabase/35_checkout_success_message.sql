-- =========================================================
-- 35_checkout_success_message.sql
-- Tujuan: seller bisa atur pesan custom & link redirect yang muncul di
-- layar "Pembayaran Berhasil" buyer. Reuse tabel checkout_settings yang
-- sudah ada (RLS-nya sudah benar: anon boleh SELECT, cuma pemilik yang
-- boleh INSERT/UPDATE). Additive only.
-- =========================================================

alter table public.checkout_settings
  add column if not exists success_message text default '',
  add column if not exists success_redirect_url text default '';
