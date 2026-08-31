-- NiagaBio Migration 31 — Add qris_image column to payment_transactions
-- Safe to run repeatedly (idempotent).
--
-- Problem: BuatQris API returns a qris_image field (base64 or URL of the QR
-- image) alongside qr_url. The frontend checkout.js uses:
--   const qrSource = payment.qris_image || payment.qr_url || '';
-- But qris_image was never persisted to the DB, so on page restore the QR
-- image could not be shown — only the fallback "Buka Halaman Pembayaran"
-- link worked because payment_url was stored.
--
-- Fix: Add qris_image column so it is persisted on create and returned by
-- the status API, enabling the QR to render correctly on page restore.

begin;

alter table public.payment_transactions
  add column if not exists qris_image text not null default '';

commit;

-- Verification:
-- select column_name, data_type
-- from information_schema.columns
-- where table_schema = 'public'
--   and table_name = 'payment_transactions'
--   and column_name = 'qris_image';
