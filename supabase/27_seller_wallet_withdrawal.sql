-- NiagaBio Migration 27 — Seller Wallet + Withdrawal Foundation
-- Run AFTER 26_fix_audit_findings.sql.
-- Scope: seller wallet ledger, payout account, withdrawal request, provider withdrawal events.
-- No admin redesign here. Withdrawal is seller-initiated, provider-processed.

begin;

alter table public.app_settings
  add column if not exists withdrawal_minimum numeric not null default 10000,
  add column if not exists withdrawal_bank_fee numeric not null default 0,
  add column if not exists withdrawal_ewallet_fee numeric not null default 2500,
  add column if not exists withdrawal_enabled boolean not null default true;

create table if not exists public.seller_payout_accounts (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references auth.users(id) on delete cascade,
  method text not null check (method in ('bank','gopay','dana','ovo','shopeepay')),
  bank_name text not null,
  bank_account text not null,
  bank_holder text not null,
  is_default boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint seller_payout_account_number_chk check (bank_account ~ '^[0-9]{6,30}$'),
  constraint seller_payout_holder_chk check (char_length(trim(bank_holder)) between 2 and 100)
);

create unique index if not exists seller_payout_accounts_default_idx
  on public.seller_payout_accounts(seller_id)
  where is_default = true;

create index if not exists seller_payout_accounts_seller_idx
  on public.seller_payout_accounts(seller_id, updated_at desc);

create table if not exists public.withdrawal_requests (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references auth.users(id) on delete cascade,
  payout_account_id uuid not null references public.seller_payout_accounts(id) on delete restrict,
  amount numeric not null check (amount > 0),
  expected_provider_fee numeric not null default 0 check (expected_provider_fee >= 0),
  provider_fee numeric not null default 0 check (provider_fee >= 0),
  reserve_held numeric not null default 0 check (reserve_held >= 0),
  reserve_used numeric not null default 0 check (reserve_used >= 0),
  net_amount numeric not null default 0 check (net_amount >= 0),
  status text not null default 'pending' check (status in ('pending','approved','success','rejected','failed','cancelled')),
  provider_status text not null default '',
  provider_withdrawal_id text not null default '',
  provider_transaction_id text not null default '',
  bank_name text not null,
  bank_account text not null,
  bank_holder text not null,
  method text not null check (method in ('bank','gopay','dana','ovo','shopeepay')),
  is_test boolean not null default false,
  failure_reason text not null default '',
  requested_at timestamptz not null default now(),
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint withdrawal_account_number_chk check (bank_account ~ '^[0-9]{6,30}$'),
  constraint withdrawal_holder_chk check (char_length(trim(bank_holder)) between 2 and 100)
);

create unique index if not exists withdrawal_requests_provider_id_idx
  on public.withdrawal_requests(provider_withdrawal_id)
  where provider_withdrawal_id <> '';

create index if not exists withdrawal_requests_seller_idx
  on public.withdrawal_requests(seller_id, created_at desc);

create index if not exists withdrawal_requests_status_idx
  on public.withdrawal_requests(status, created_at desc);

alter table public.seller_payout_accounts enable row level security;
alter table public.withdrawal_requests enable row level security;

revoke all on public.seller_payout_accounts from anon, authenticated;
revoke all on public.withdrawal_requests from anon, authenticated;
grant select, insert, update, delete on public.seller_payout_accounts to service_role;
grant select, insert, update, delete on public.withdrawal_requests to service_role;

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
    and o.payment_status = 'paid';

  select coalesce(sum(w.amount) filter (where w.status = 'pending'), 0),
         coalesce(sum(w.amount) filter (where w.status in ('approved','success')), 0),
         coalesce(sum(w.reserve_held) filter (where w.status = 'pending'), 0),
         coalesce(sum(w.reserve_used) filter (where w.status in ('approved','success')), 0)
    into pending_withdrawal, total_withdrawn, reserve_held, reserve_used
  from public.withdrawal_requests w
  where w.seller_id = target_seller_id;

  select coalesce(sum(o.withdrawal_reserve), 0)
    into reserve_accrued
  from public.orders o
  where o.seller_id = target_seller_id
    and o.payment_status = 'paid';

  available_balance := greatest(total_earned - pending_withdrawal - total_withdrawn, 0);
  reserve_available := greatest(reserve_accrued - reserve_held - reserve_used, 0);
  return next;
end;
$$;

revoke all on function public.get_seller_wallet_summary(uuid) from public, anon, authenticated;
grant execute on function public.get_seller_wallet_summary(uuid) to authenticated, service_role;

create or replace function public.reserve_seller_withdrawal(
  target_seller_id uuid,
  target_payout_account_id uuid,
  requested_amount numeric,
  expected_fee numeric default 0,
  is_test_input boolean default false
)
returns public.withdrawal_requests
language plpgsql
security definer
set search_path to public, auth, pg_temp
as $$
declare
  is_service boolean := coalesce(auth.role(), '') = 'service_role';
  account_row public.seller_payout_accounts;
  settings_row public.app_settings;
  wallet record;
  new_request public.withdrawal_requests;
  min_amount numeric;
begin
  if not is_service then
    raise exception 'Service role required' using errcode = '42501';
  end if;

  select * into settings_row from public.app_settings where id = 'global';
  min_amount := greatest(coalesce(settings_row.withdrawal_minimum, 10000), 10000);
  if requested_amount < min_amount then
    raise exception 'Minimum withdrawal adalah Rp %', to_char(min_amount, 'FM999G999G999G990') using errcode = '23514';
  end if;

  if settings_row.withdrawal_enabled is false then
    raise exception 'Withdrawal sedang dinonaktifkan.' using errcode = '42501';
  end if;

  select * into account_row
  from public.seller_payout_accounts
  where id = target_payout_account_id
    and seller_id = target_seller_id
  for update;
  if account_row.id is null then
    raise exception 'Rekening/e-wallet payout tidak ditemukan.' using errcode = 'P0002';
  end if;

  -- Lock the seller row so concurrent withdrawal requests cannot overspend the same ledger balance.
  perform 1 from public.profiles where user_id = target_seller_id for update;

  select * into wallet from public.get_seller_wallet_summary(target_seller_id);
  if requested_amount > wallet.available_balance then
    raise exception 'Saldo tersedia tidak mencukupi.' using errcode = '42501';
  end if;

  if greatest(coalesce(expected_fee, 0), 0) > wallet.reserve_available then
    raise exception 'Cadangan biaya withdrawal seller tidak mencukupi untuk metode ini.' using errcode = '42501';
  end if;

  insert into public.withdrawal_requests (
    seller_id, payout_account_id, amount, expected_provider_fee,
    provider_fee, reserve_held, reserve_used, net_amount,
    status, provider_status, bank_name, bank_account, bank_holder,
    method, is_test, requested_at, created_at, updated_at
  ) values (
    target_seller_id, target_payout_account_id, round(requested_amount, 2),
    greatest(coalesce(expected_fee, 0), 0), 0,
    greatest(coalesce(expected_fee, 0), 0), 0,
    greatest(round(requested_amount - greatest(coalesce(expected_fee, 0), 0), 2), 0),
    'pending', 'pending', account_row.bank_name, account_row.bank_account,
    account_row.bank_holder, account_row.method, coalesce(is_test_input, false),
    now(), now(), now()
  ) returning * into new_request;

  return new_request;
end;
$$;

revoke all on function public.reserve_seller_withdrawal(uuid, uuid, numeric, numeric, boolean) from public, anon, authenticated;
grant execute on function public.reserve_seller_withdrawal(uuid, uuid, numeric, numeric, boolean) to service_role;

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
      is_test = coalesce(p_is_test, is_test),
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
