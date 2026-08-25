-- NiagaBio Payment Ledger Foundation
-- P0/P1: additive foundation only. Does NOT call BuatQris.
-- Run after the existing production migrations are complete.

begin;

-- 1) Admin Master payment configuration.
alter table public.app_settings
  add column if not exists platform_fee numeric(14,2) not null default 1000 check (platform_fee >= 0),
  add column if not exists withdrawal_reserve numeric(14,2) not null default 2500 check (withdrawal_reserve >= 0),
  add column if not exists payment_gateway_enabled boolean not null default true,
  add column if not exists payment_provider text not null default 'buatqris',
  add column if not exists payment_sandbox boolean not null default true;

-- 2) Order fee/payment snapshots. total_price remains the seller-product subtotal.
alter table public.orders
  add column if not exists platform_fee numeric(14,2) not null default 0 check (platform_fee >= 0),
  add column if not exists withdrawal_reserve numeric(14,2) not null default 0 check (withdrawal_reserve >= 0),
  add column if not exists gateway_fee numeric(14,2) not null default 0 check (gateway_fee >= 0),
  add column if not exists buyer_total numeric(14,2) not null default 0 check (buyer_total >= 0),
  add column if not exists seller_earning numeric(14,2) not null default 0 check (seller_earning >= 0),
  add column if not exists platform_earning numeric(14,2) not null default 0 check (platform_earning >= 0),
  add column if not exists payment_provider text default '',
  add column if not exists provider_transaction_id text default '',
  add column if not exists provider_status text default '',
  add column if not exists payment_expires_at timestamptz;

-- Backfill legacy orders conservatively.
update public.orders
set seller_earning = total_price
where seller_earning = 0 and total_price > 0;

update public.orders
set buyer_total = total_price
where buyer_total = 0 and total_price > 0;

-- 2b) Protect new financial snapshots on every insert/update.
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
    new.payment_provider := '';
    new.provider_transaction_id := '';
    new.provider_status := '';
    new.payment_expires_at := null;
    new.payment_status := 'pending';
    new.paid_at := null;
    new.created_at := coalesce(new.created_at, now());
  elsif tg_op = 'UPDATE' then
    if not public.is_admin() then
      new.id := old.id;
      new.seller_id := old.seller_id;
      new.buyer_name := old.buyer_name;
      new.buyer_phone := old.buyer_phone;
      new.product_id := old.product_id;
      new.product_name := old.product_name;
      new.quantity := old.quantity;
      new.total_price := old.total_price;
      new.payment_method := old.payment_method;
      new.proof_image_url := old.proof_image_url;
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

-- 3) Snapshot fee/ledger fields at order creation without changing legacy total_price.
create or replace function public.create_public_order(
  target_seller_id uuid,
  target_product_id uuid,
  buyer_name_input text,
  buyer_phone_input text,
  quantity_input integer default 1,
  proof_image_url_input text default '',
  payment_method_input text default 'qris_manual'
)
returns public.orders
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  product_owner uuid;
  product_title text;
  product_price numeric;
  product_active boolean;
  clean_buyer_name text;
  clean_buyer_phone text;
  clean_method text;
  clean_proof_url text;
  clean_quantity integer;
  recent_duplicate_count integer;
  setting_platform_fee numeric := 1000;
  setting_withdrawal_reserve numeric := 2500;
  inserted_order public.orders;
begin
  clean_buyer_name := left(trim(coalesce(buyer_name_input, '')), 80);
  if length(clean_buyer_name) < 2 then
    raise exception 'Nama pembeli wajib diisi' using errcode = '23514';
  end if;

  clean_buyer_phone := regexp_replace(coalesce(buyer_phone_input, ''), '[^0-9]', '', 'g');
  if length(clean_buyer_phone) not between 8 and 18 then
    raise exception 'Nomor pembeli tidak valid' using errcode = '23514';
  end if;

  clean_quantity := greatest(coalesce(quantity_input, 1), 1);
  if clean_quantity > 999 then
    raise exception 'Jumlah produk terlalu besar' using errcode = '23514';
  end if;

  clean_method := coalesce(nullif(trim(lower(payment_method_input)), ''), 'qris_manual');
  if clean_method not in ('qris_manual', 'qris_whatsapp') then
    raise exception 'Checkout hanya menerima QRIS manual' using errcode = '23514';
  end if;

  clean_proof_url := trim(coalesce(proof_image_url_input, ''));
  if clean_proof_url = '' then
    raise exception 'Bukti pembayaran wajib diupload' using errcode = '23514';
  end if;

  if not public.is_safe_proof_reference(clean_proof_url, 'proofs', target_seller_id) then
    raise exception 'Bukti bayar tidak aman' using errcode = '23514';
  end if;

  select p.user_id, p.name, coalesce(p.price, 0), p.is_active
  into product_owner, product_title, product_price, product_active
  from public.products p
  where p.id = target_product_id;

  if product_owner is null then
    raise exception 'Produk tidak ditemukan' using errcode = '23503';
  end if;

  if product_owner <> target_seller_id or product_active is not true then
    raise exception 'Produk tidak valid untuk seller ini' using errcode = '23514';
  end if;

  if not public.is_active_user(target_seller_id) then
    raise exception 'Seller sedang tidak aktif' using errcode = '42501';
  end if;

  select count(*)
  into recent_duplicate_count
  from public.orders o
  where o.seller_id = target_seller_id
    and o.product_id = target_product_id
    and o.buyer_phone = clean_buyer_phone
    and o.created_at > now() - interval '2 minutes';

  if recent_duplicate_count > 0 then
    raise exception 'Pesanan serupa baru saja dikirim. Tunggu sebentar sebelum mencoba lagi.' using errcode = '42901';
  end if;

  select count(*)
  into recent_duplicate_count
  from public.orders o
  where o.seller_id = target_seller_id
    and o.buyer_phone = clean_buyer_phone
    and o.created_at > now() - interval '15 minutes';

  if recent_duplicate_count >= 5 then
    raise exception 'Terlalu banyak pesanan dari nomor ini. Coba lagi beberapa menit lagi.' using errcode = '42901';
  end if;

  select
    greatest(coalesce(platform_fee, 1000), 0),
    greatest(coalesce(withdrawal_reserve, 2500), 0)
  into setting_platform_fee, setting_withdrawal_reserve
  from public.app_settings
  where id = 'global';

  insert into public.orders (
    seller_id,
    buyer_name,
    buyer_phone,
    product_id,
    product_name,
    quantity,
    total_price,
    payment_method,
    payment_status,
    proof_image_url,
    paid_at,
    platform_fee,
    withdrawal_reserve,
    gateway_fee,
    buyer_total,
    seller_earning,
    platform_earning,
    payment_provider,
    created_at,
    updated_at
  ) values (
    target_seller_id,
    clean_buyer_name,
    clean_buyer_phone,
    target_product_id,
    product_title,
    clean_quantity,
    product_price * clean_quantity,
    clean_method,
    'pending',
    clean_proof_url,
    null,
    setting_platform_fee,
    setting_withdrawal_reserve,
    0,
    (product_price * clean_quantity) + setting_platform_fee + setting_withdrawal_reserve,
    product_price * clean_quantity,
    0,
    '',
    now(),
    now()
  )
  returning * into inserted_order;

  return inserted_order;
end;
$$;

revoke all on function public.create_public_order(uuid, uuid, text, text, integer, text, text) from public;
grant execute on function public.create_public_order(uuid, uuid, text, text, integer, text, text) to anon, authenticated;

-- 3) Provider transaction table for idempotent webhook/payment state.
create table if not exists public.payment_transactions (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  seller_id uuid not null references auth.users(id) on delete cascade,
  provider text not null default 'buatqris',
  provider_transaction_id text not null,
  status text not null default 'pending'
    check (status in ('pending','success','expired','failed','cancelled')),
  requested_amount numeric(14,2) not null default 0 check (requested_amount >= 0),
  provider_total_amount numeric(14,2) not null default 0 check (provider_total_amount >= 0),
  gateway_fee numeric(14,2) not null default 0 check (gateway_fee >= 0),
  provider_credit_amount numeric(14,2) not null default 0 check (provider_credit_amount >= 0),
  qr_url text default '',
  payment_url text default '',
  qris_method text default '',
  is_test boolean not null default false,
  expires_at timestamptz,
  paid_at timestamptz,
  last_webhook_delivery_id text default '',
  last_event_type text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, provider_transaction_id)
);

create index if not exists payment_transactions_order_idx
  on public.payment_transactions(order_id, created_at desc);

create index if not exists payment_transactions_seller_idx
  on public.payment_transactions(seller_id, created_at desc);

create index if not exists payment_transactions_status_idx
  on public.payment_transactions(status, created_at desc);

-- 4) RLS: seller may only read own payment transactions; Admin Master may read all.
alter table public.payment_transactions enable row level security;

drop policy if exists "payment_transactions_select_own_or_admin" on public.payment_transactions;
create policy "payment_transactions_select_own_or_admin"
on public.payment_transactions for select
to authenticated
using (seller_id = auth.uid() or public.is_admin());

-- Writes are intentionally backend-only. Do NOT grant anon/client insert/update.
revoke all on table public.payment_transactions from anon;
revoke all on table public.payment_transactions from authenticated;
grant select on public.payment_transactions to authenticated;

-- 5) Updated-at trigger.
drop trigger if exists touch_payment_transactions_updated_at on public.payment_transactions;
create trigger touch_payment_transactions_updated_at
before update on public.payment_transactions
for each row execute function public.touch_updated_at();

commit;

-- Read-only verification examples:
-- select column_name, data_type from information_schema.columns where table_schema='public' and table_name in ('app_settings','orders','payment_transactions') order by table_name, ordinal_position;
-- select schemaname, tablename, policyname from pg_policies where schemaname='public' and tablename='payment_transactions';
