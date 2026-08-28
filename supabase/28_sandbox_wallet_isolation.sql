-- NiagaBio Migration 28 — Sandbox isolation + platform_earning formula fix
-- Run AFTER 27_seller_wallet_withdrawal.sql.
--
-- Fixes (audit approved as baseline, P0 items 1/3/4):
--
-- P0-1: orders had NO is_test column. Wallet balance (get_seller_wallet_summary)
--       summed seller_earning/withdrawal_reserve from ALL paid orders, so a
--       sandbox (test=1) BuatQris payment could become real withdrawable
--       balance. Source of truth for "is this transaction a test" is
--       payment_transactions.is_test (set by our own backend at create-time
--       from app_settings.payment_sandbox, see api/payment/create.js). This
--       migration propagates that value onto orders.is_test at settlement
--       time and excludes is_test orders from wallet aggregates. is_test is
--       "sticky": once a payment_transactions row is marked test, it can
--       never be flipped back to non-test by a later webhook event.
--
-- P0-3: apply_buatqris_payment_event (as fixed in 26_fix_audit_findings.sql)
--       sets platform_earning = platform_fee + withdrawal_reserve. This
--       contradicts the active source-of-truth docs:
--         - PRD.md section 6: "Jangan mencampur: ... pendapatan platform,
--           ... reserve biaya withdrawal seller ..."
--         - docs/PAYMENT_GATEWAY_PLAN.md ("Financial semantics"):
--           "platform_earning = platform fee when the payment succeeds."
--       README's BUG-02 patch note is a historical patch note, not source of
--       truth (per PRD section 9 / Folder-structure.md), and it misreads the
--       PRD. This migration restores platform_earning = platform_fee only.
--       withdrawal_reserve remains its own separate column/ledger line, as
--       already required by PRD section 7 ("gunakan istilah ledger/
--       pendapatan/receivable secara tepat").
--
-- P0-4: idempotency guard from 26 (skip recompute once payment_status='paid')
--       is preserved unchanged; only the is_test propagation and the earning
--       formula are touched.
--
-- Not touched: RLS policies, auth, qris_manual/qris_whatsapp validation,
-- withdrawal_requests schema, function signatures (webhook.js/status.js call
-- these RPCs by fixed signature; both signatures are preserved exactly).

begin;

-- 1) orders.is_test — never client-writable (see protect_orders_fields below).
alter table public.orders
  add column if not exists is_test boolean not null default false;

-- 2) Lock is_test from browser/seller mutation, same pattern as every other
--    settlement field. INSERT always forces false (buyer/public checkout
--    never gets to claim a real order is a test order); UPDATE by non-admin/
--    non-service callers cannot change it either.
create or replace function public.protect_orders_fields()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  product_owner uuid;
  product_title text;
  product_price numeric;
  product_active boolean;
  setting_platform_fee numeric := 1000;
  setting_withdrawal_reserve numeric := 2500;
  is_service boolean := coalesce(auth.role(), '') = 'service_role';
begin
  if tg_op = 'INSERT' then
    if new.product_id is null then
      raise exception 'product_id is required' using errcode = '23502';
    end if;

    select p.user_id, p.name, coalesce(p.price, 0), p.is_active
      into product_owner, product_title, product_price, product_active
    from public.products p
    where p.id = new.product_id;

    if product_owner is null then
      raise exception 'Product not found' using errcode = '23503';
    end if;
    if product_owner <> new.seller_id or product_active is not true then
      raise exception 'Invalid product for seller' using errcode = '23514';
    end if;
    if not public.is_active_user(new.seller_id) then
      raise exception 'Seller is blocked or inactive' using errcode = '42501';
    end if;
    if coalesce(new.quantity, 0) < 1 then
      raise exception 'Quantity must be greater than zero' using errcode = '23514';
    end if;

    select greatest(coalesce(platform_fee, 1000), 0), greatest(coalesce(withdrawal_reserve, 2500), 0)
      into setting_platform_fee, setting_withdrawal_reserve
    from public.app_settings
    where id = 'global';

    new.product_name := product_title;
    new.total_price := product_price * new.quantity;
    new.platform_fee := setting_platform_fee;
    new.withdrawal_reserve := setting_withdrawal_reserve;
    new.gateway_fee := 0;
    new.buyer_total := new.total_price + setting_platform_fee + setting_withdrawal_reserve;
    new.seller_earning := new.total_price;
    new.platform_earning := 0;
    new.payment_provider := case when new.payment_method = 'qris_buatqris' then 'buatqris' else '' end;
    new.provider_transaction_id := '';
    new.provider_status := '';
    new.payment_expires_at := null;
    new.payment_status := 'pending';
    new.paid_at := null;
    new.is_test := false;
    new.created_at := coalesce(new.created_at, now());
  elsif tg_op = 'UPDATE' then
    if not public.is_admin() and not is_service then
      new.id := old.id;
      new.seller_id := old.seller_id;
      new.buyer_name := old.buyer_name;
      new.buyer_phone := old.buyer_phone;
      new.product_id := old.product_id;
      new.product_name := old.product_name;
      new.quantity := old.quantity;
      new.total_price := old.total_price;
      new.payment_method := old.payment_method;
      new.payment_status := old.payment_status;
      new.proof_image_url := old.proof_image_url;
      new.paid_at := old.paid_at;
      new.platform_fee := old.platform_fee;
      new.withdrawal_reserve := old.withdrawal_reserve;
      new.gateway_fee := old.gateway_fee;
      new.buyer_total := old.buyer_total;
      new.seller_earning := old.seller_earning;
      new.platform_earning := old.platform_earning;
      new.payment_provider := old.payment_provider;
      new.provider_transaction_id := old.provider_transaction_id;
      new.provider_status := old.provider_status;
      new.payment_expires_at := old.payment_expires_at;
      new.is_test := old.is_test;
      new.created_at := old.created_at;
    end if;

    if new.payment_status = 'paid' and new.paid_at is null then
      new.paid_at := now();
    elsif new.payment_status <> 'paid' then
      new.paid_at := null;
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

comment on function public.protect_orders_fields() is
'P28: adds is_test to the locked-field list (P25 pattern unchanged otherwise); non-admin/non-service callers cannot mutate order payment/settlement/is_test fields; service_role is the settlement path.';

-- 3) Settlement RPC — same signature as 24/26 (webhook.js/status.js call it
--    positionally via PostgREST rpc, signature must not change).
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
  effective_is_test boolean;
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

  -- Sticky is_test: a transaction created as sandbox can never be flipped
  -- back to "real" by a later webhook event (defense in depth beyond the
  -- HMAC signature check already required on the webhook route).
  effective_is_test := coalesce(tx.is_test, false) or coalesce(p_is_test, false);

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
      is_test = effective_is_test,
      updated_at = now()
  where id = tx.id
  returning * into tx;

  select * into order_row from public.orders where id = tx.order_id for update;
  if order_row.id is null then
    raise exception 'Order not found for payment transaction' using errcode = 'P0002';
  end if;

  -- Already settled: keep idempotent, do not recompute earnings (from 26).
  if order_row.payment_status = 'paid' and clean_status <> 'success' then
    update public.orders set is_test = effective_is_test where id = order_row.id;
    return tx;
  end if;

  if clean_status = 'success' then
    if order_row.payment_status = 'paid' then
      -- Duplicate success webhook: refresh provider refs only, no re-credit.
      update public.orders
      set provider_status = 'success',
          provider_transaction_id = tx.provider_transaction_id,
          payment_provider = 'buatqris',
          is_test = effective_is_test,
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
          -- Platform revenue = platform fee only (PRD section 6 / PAYMENT_GATEWAY_PLAN
          -- financial semantics). withdrawal_reserve stays a separate ledger line and
          -- is never counted as platform profit.
          platform_earning = order_row.platform_fee,
          payment_provider = 'buatqris',
          provider_transaction_id = tx.provider_transaction_id,
          payment_expires_at = coalesce(p_expires_at, payment_expires_at),
          is_test = effective_is_test,
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
        is_test = effective_is_test,
        updated_at = now()
    where id = order_row.id and payment_status <> 'paid';
  else
    update public.orders
    set provider_status = 'pending',
        payment_provider = 'buatqris',
        provider_transaction_id = tx.provider_transaction_id,
        payment_expires_at = coalesce(p_expires_at, payment_expires_at),
        is_test = effective_is_test,
        updated_at = now()
    where id = order_row.id and payment_status = 'pending';
  end if;

  return tx;
end;
$$;

revoke all on function public.apply_buatqris_payment_event(text,text,numeric,numeric,numeric,numeric,text,timestamptz,timestamptz,text,text,boolean) from public, anon, authenticated;
grant execute on function public.apply_buatqris_payment_event(text,text,numeric,numeric,numeric,numeric,text,timestamptz,timestamptz,text,text,boolean) to service_role;

-- 4) Wallet balance must never include test-mode orders/withdrawals.
create or replace function public.get_seller_wallet_summary(target_seller_id uuid)
returns table (
  total_earned numeric,
  pending_withdrawal numeric,
  total_withdrawn numeric,
  available_balance numeric,
  reserve_accrued numeric,
  reserve_held numeric,
  reserve_used numeric,
  reserve_available numeric
)
language plpgsql
security definer
set search_path to public, auth, pg_temp
as $$
declare
  is_service boolean := coalesce(auth.role(), '') = 'service_role';
  is_owner boolean := auth.uid() = target_seller_id;
begin
  if not is_service and not is_owner then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  select coalesce(sum(o.seller_earning), 0)
    into total_earned
  from public.orders o
  where o.seller_id = target_seller_id
    and o.payment_status = 'paid'
    and o.is_test = false;

  select coalesce(sum(w.amount) filter (where w.status = 'pending'), 0),
         coalesce(sum(w.amount) filter (where w.status in ('approved','success')), 0),
         coalesce(sum(w.reserve_held) filter (where w.status = 'pending'), 0),
         coalesce(sum(w.reserve_used) filter (where w.status in ('approved','success')), 0)
    into pending_withdrawal, total_withdrawn, reserve_held, reserve_used
  from public.withdrawal_requests w
  where w.seller_id = target_seller_id
    and w.is_test = false;

  select coalesce(sum(o.withdrawal_reserve), 0)
    into reserve_accrued
  from public.orders o
  where o.seller_id = target_seller_id
    and o.payment_status = 'paid'
    and o.is_test = false;

  available_balance := greatest(total_earned - pending_withdrawal - total_withdrawn, 0);
  reserve_available := greatest(reserve_accrued - reserve_held - reserve_used, 0);
  return next;
end;
$$;

revoke all on function public.get_seller_wallet_summary(uuid) from public, anon, authenticated;
grant execute on function public.get_seller_wallet_summary(uuid) to authenticated, service_role;

-- 5) P1-7/P1-8: withdrawal race + state-machine guard.
--
-- api/withdraw/create.js previously bound the freshly-created provider
-- withdrawal_id via a raw PATCH, racing against the webhook path
-- (apply_buatqris_withdrawal_event, which locks by provider_withdrawal_id).
-- This adds one row-locked, idempotent function for that initial binding so
-- both code paths use a consistent, locked state-transition path.
create or replace function public.attach_buatqris_withdrawal_provider_ref(
  p_request_id uuid,
  p_provider_withdrawal_id text,
  p_provider_transaction_id text default '',
  p_provider_status text default 'pending',
  p_provider_fee numeric default 0,
  p_net_amount numeric default 0,
  p_is_test boolean default false
)
returns public.withdrawal_requests
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  row_data public.withdrawal_requests;
  clean_status text := lower(trim(coalesce(p_provider_status, 'pending')));
  fee numeric := greatest(coalesce(p_provider_fee, 0), 0);
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Service role required' using errcode = '42501';
  end if;
  if clean_status not in ('pending','approved','success','rejected','failed','cancelled') then
    raise exception 'Invalid withdrawal status' using errcode = '22023';
  end if;

  select * into row_data from public.withdrawal_requests where id = p_request_id for update;
  if row_data.id is null then
    raise exception 'Withdrawal request not found' using errcode = 'P0002';
  end if;

  -- Idempotent: only attach the provider reference once. If a webhook has
  -- already raced ahead (should be impossible before this ref exists, but
  -- guarded regardless), do not overwrite it.
  if coalesce(row_data.provider_withdrawal_id, '') <> '' then
    return row_data;
  end if;

  update public.withdrawal_requests
  set provider_withdrawal_id = left(trim(p_provider_withdrawal_id), 120),
      provider_transaction_id = left(coalesce(p_provider_transaction_id, ''), 120),
      provider_status = clean_status,
      provider_fee = fee,
      reserve_used = case when clean_status in ('approved','success') then fee else 0 end,
      reserve_held = case when clean_status in ('approved','success','rejected','failed','cancelled') then 0 else reserve_held end,
      net_amount = greatest(coalesce(p_net_amount, row_data.amount - fee), 0),
      status = case when clean_status in ('approved','success') then clean_status else row_data.status end,
      is_test = coalesce(row_data.is_test, false) or coalesce(p_is_test, false),
      processed_at = case when clean_status in ('approved','success','rejected','failed','cancelled') then now() else processed_at end,
      updated_at = now()
  where id = row_data.id
  returning * into row_data;

  return row_data;
end;
$$;

revoke all on function public.attach_buatqris_withdrawal_provider_ref(uuid,text,text,text,numeric,numeric,boolean) from public, anon, authenticated;
grant execute on function public.attach_buatqris_withdrawal_provider_ref(uuid,text,text,text,numeric,numeric,boolean) to service_role;

-- P1-8: apply_buatqris_withdrawal_event previously accepted any status
-- transition unconditionally (no monotonic guard), so an out-of-order/replay
-- webhook could move a terminal request (success/rejected/failed/cancelled)
-- back to a non-terminal one. Same signature as 27; only the state-machine
-- guard is added.
create or replace function public.apply_buatqris_withdrawal_event(
  p_withdrawal_id text,
  p_status text,
  p_amount numeric default 0,
  p_fee numeric default 0,
  p_net_amount numeric default 0,
  p_bank_name text default '',
  p_bank_account text default '',
  p_bank_holder text default '',
  p_provider_transaction_id text default '',
  p_is_test boolean default false,
  p_processed_at timestamptz default null
)
returns public.withdrawal_requests
language plpgsql
security definer
set search_path to public, auth, pg_temp
as $$
declare
  clean_status text := lower(trim(coalesce(p_status, 'pending')));
  row_data public.withdrawal_requests;
  actual_fee numeric := greatest(coalesce(p_fee, 0), 0);
  is_terminal boolean;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Service role required' using errcode = '42501';
  end if;
  if clean_status not in ('pending','approved','success','rejected','failed','cancelled') then
    raise exception 'Invalid withdrawal status' using errcode = '22023';
  end if;

  select * into row_data
  from public.withdrawal_requests
  where provider_withdrawal_id = trim(p_withdrawal_id)
  for update;

  if row_data.id is null then
    raise exception 'Withdrawal request not found' using errcode = 'P0002';
  end if;

  if coalesce(p_amount, 0) > 0 and abs(coalesce(p_amount, 0) - row_data.amount) > 0.01 then
    raise exception 'Withdrawal amount mismatch' using errcode = '22003';
  end if;

  is_terminal := row_data.status in ('success','rejected','failed','cancelled');

  -- Once in a terminal state, ignore any event that would move it to a
  -- DIFFERENT state (out-of-order/replay webhook). A repeat of the SAME
  -- terminal status is a harmless idempotent no-op (falls through below,
  -- values recomputed identically).
  if is_terminal and clean_status <> row_data.status then
    return row_data;
  end if;

  -- 'approved' is an in-flight state (funds already locked at the provider);
  -- do not let a stale/out-of-order 'pending' webhook regress it.
  if row_data.status = 'approved' and clean_status = 'pending' then
    return row_data;
  end if;

  update public.withdrawal_requests
  set status = clean_status,
      provider_status = clean_status,
      provider_fee = actual_fee,
      reserve_used = case when clean_status in ('approved','success') then actual_fee else 0 end,
      reserve_held = case when clean_status in ('approved','success','rejected','failed','cancelled') then 0 else reserve_held end,
      net_amount = greatest(coalesce(p_net_amount, row_data.amount - actual_fee), 0),
      bank_name = coalesce(nullif(trim(p_bank_name), ''), bank_name),
      bank_account = coalesce(nullif(trim(p_bank_account), ''), bank_account),
      bank_holder = coalesce(nullif(trim(p_bank_holder), ''), bank_holder),
      provider_transaction_id = left(coalesce(p_provider_transaction_id, ''), 120),
      is_test = coalesce(row_data.is_test, false) or coalesce(p_is_test, false),
      processed_at = case when clean_status in ('approved','success','rejected','failed','cancelled') then coalesce(p_processed_at, now()) else processed_at end,
      failure_reason = case when clean_status in ('rejected','failed','cancelled') then coalesce(failure_reason, '') else failure_reason end,
      updated_at = now()
  where id = row_data.id
  returning * into row_data;

  return row_data;
end;
$$;

revoke all on function public.apply_buatqris_withdrawal_event(text,text,numeric,numeric,numeric,text,text,text,text,boolean,timestamptz) from public, anon, authenticated;
grant execute on function public.apply_buatqris_withdrawal_event(text,text,numeric,numeric,numeric,text,text,text,text,boolean,timestamptz) to service_role;

commit;

-- Read-only verification queries (run manually, not part of migration):
-- select column_name from information_schema.columns where table_schema='public' and table_name='orders' and column_name='is_test';
-- select proname, prosrc ilike '%is_test = false%' from pg_proc where proname='get_seller_wallet_summary';
-- select o.id, o.payment_status, o.is_test, o.seller_earning, o.platform_earning, o.withdrawal_reserve from public.orders o order by o.created_at desc limit 20;
