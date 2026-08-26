-- NiagaBio Migration 26 — Fix audit findings (HASIL_DATA.md)
-- Run AFTER 25_payment_security_hardening.sql.
-- Fixes:
--   BUG-01: trigger v15 blocks payment_method 'qris_buatqris' -> whitelist it,
--           allow empty proof_image_url for gateway orders.
--   BUG-02: settlement lost withdrawal_reserve -> platform_earning must be
--           platform_fee + withdrawal_reserve (per PRD financial model).
-- Notes:
--   - apply_buatqris_payment_event KEEPS its RPC signature
--     (text,text,numeric,numeric,numeric,numeric,text,timestamptz,timestamptz,text,text,boolean)
--     because api/payment/webhook.js and api/payment/status.js call it via PostgREST rpc.
--   - app_settings is single-row (id='global') with typed columns, NOT key/value.
--   - Idempotent: safe to re-run.

begin;

-- ============================================================
-- 1) BUG-01: rebuild public order validation trigger
-- ============================================================
drop trigger if exists validate_order_public_fields_v31 on public.orders;
drop trigger if exists validate_order_public_fields_v12_final on public.orders;
drop trigger if exists validate_order_public_fields_v13_checkout_fix on public.orders;
drop trigger if exists validate_order_public_fields_v15_order_hardening on public.orders;
drop trigger if exists validate_order_public_fields_v26_fix_audit on public.orders;

create or replace function public.validate_order_public_fields()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
begin
  if new.payment_method not in ('whatsapp', 'qris_manual', 'qris_whatsapp', 'qris_buatqris') then
    raise exception 'Metode pembayaran tidak didukung' using errcode = '23514';
  end if;

  -- Manual methods require uploaded proof. Gateway orders settle via webhook.
  if new.payment_method in ('qris_manual', 'qris_whatsapp')
    and coalesce(new.proof_image_url, '') = '' then
    raise exception 'Bukti pembayaran wajib diunggah untuk QRIS manual' using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger validate_order_public_fields_v26_order_methods
  before insert or update on public.orders
  for each row execute function public.validate_order_public_fields();

-- ============================================================
-- 2) BUG-02: correct settlement ledger in BuatQris RPC
--    Signature and guards identical to migration 24.
-- ============================================================
create or replace function public.apply_buatqris_payment_event(
  p_transaction_id text,
  p_status text,
  p_amount numeric default 0,
  p_total_amount numeric default 0,
  p_credit_amount numeric default 0,
  p_admin_fee numeric default 0,
  p_qris_method text default '',
  p_paid_at timestamptz default null,
  p_expires_at timestamptz default null,
  p_delivery_id text default '',
  p_event_type text default '',
  p_is_test boolean default false
)
returns public.payment_transactions
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  tx public.payment_transactions;
  clean_status text := lower(trim(coalesce(p_status, 'pending')));
  order_row public.orders;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Service role required' using errcode = '42501';
  end if;

  if clean_status not in ('pending','success','expired','failed','cancelled') then
    raise exception 'Invalid provider status' using errcode = '22023';
  end if;

  select * into tx
  from public.payment_transactions
  where provider = 'buatqris'
    and provider_transaction_id = trim(p_transaction_id)
  for update;

  if tx.id is null then
    raise exception 'Payment transaction not found' using errcode = 'P0002';
  end if;

  update public.payment_transactions
  set status = clean_status,
      provider_total_amount = greatest(coalesce(p_total_amount, 0), 0),
      gateway_fee = greatest(coalesce(p_admin_fee, 0), 0),
      provider_credit_amount = greatest(coalesce(p_credit_amount, 0), 0),
      qris_method = left(coalesce(p_qris_method, ''), 50),
      expires_at = coalesce(p_expires_at, expires_at),
      paid_at = case when clean_status = 'success' then coalesce(p_paid_at, now()) else paid_at end,
      last_webhook_delivery_id = left(coalesce(p_delivery_id, ''), 120),
      last_event_type = left(coalesce(p_event_type, ''), 80),
      is_test = coalesce(p_is_test, is_test),
      updated_at = now()
  where id = tx.id
  returning * into tx;

  select * into order_row from public.orders where id = tx.order_id for update;
  if order_row.id is null then
    raise exception 'Order not found for payment transaction' using errcode = 'P0002';
  end if;

  -- Already settled: keep idempotent, do not recompute earnings.
  if order_row.payment_status = 'paid' and clean_status <> 'success' then
    return tx;
  end if;

  if clean_status = 'success' then
    if order_row.payment_status = 'paid' then
      -- Duplicate success webhook: refresh provider refs only.
      update public.orders
      set provider_status = 'success',
          provider_transaction_id = tx.provider_transaction_id,
          payment_provider = 'buatqris',
          updated_at = now()
      where id = order_row.id;
    else
      update public.orders
      set payment_status = 'paid',
          paid_at = coalesce(p_paid_at, now()),
          provider_status = 'success',
          gateway_fee = greatest(coalesce(p_admin_fee, 0), 0),
          buyer_total = greatest(coalesce(p_total_amount, buyer_total), buyer_total),
          -- Seller receives full product subtotal; buyer-paid fees are not deducted.
          seller_earning = order_row.total_price,
          -- Platform revenue = platform fee + withdrawal reserve (PRD section 6/7).
          platform_earning = order_row.platform_fee + order_row.withdrawal_reserve,
          payment_provider = 'buatqris',
          provider_transaction_id = tx.provider_transaction_id,
          payment_expires_at = coalesce(p_expires_at, payment_expires_at),
          updated_at = now()
      where id = order_row.id;
    end if;
  elsif clean_status in ('expired','failed','cancelled') then
    update public.orders
    set payment_status = 'cancelled',
        paid_at = null,
        provider_status = clean_status,
        payment_provider = 'buatqris',
        provider_transaction_id = tx.provider_transaction_id,
        payment_expires_at = coalesce(p_expires_at, payment_expires_at),
        updated_at = now()
    where id = order_row.id and payment_status <> 'paid';
  else
    update public.orders
    set provider_status = 'pending',
        payment_provider = 'buatqris',
        provider_transaction_id = tx.provider_transaction_id,
        payment_expires_at = coalesce(p_expires_at, payment_expires_at),
        updated_at = now()
    where id = order_row.id and payment_status = 'pending';
  end if;

  return tx;
end;
$$;

revoke all on function public.apply_buatqris_payment_event(text,text,numeric,numeric,numeric,numeric,text,timestamptz,timestamptz,text,text,boolean) from public, anon, authenticated;
grant execute on function public.apply_buatqris_payment_event(text,text,numeric,numeric,numeric,numeric,text,timestamptz,timestamptz,text,text,boolean) to service_role;

commit;
