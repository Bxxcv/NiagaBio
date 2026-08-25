-- NiagaBio Payment Gateway P3 — BuatQris
-- Run AFTER 23_payment_ledger_foundation.sql.
-- No provider secret is stored in Supabase.

begin;

-- 1) Allow the gateway flow to create an order without manual proof upload.
alter table public.orders drop constraint if exists orders_payment_method_check;
alter table public.orders
  add constraint orders_payment_method_check
  check (payment_method in ('whatsapp','qris_manual','qris_whatsapp','qris_buatqris'));

-- 2) Rebuild order protection so service_role (Vercel backend/webhook) may
-- update payment state while normal browser clients remain blocked from
-- mutating seller/financial/provider fields.
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

-- 3) Rebuild public order RPC: BuatQris no longer requires manual proof.
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

  clean_method := coalesce(nullif(trim(lower(payment_method_input)), ''), 'qris_buatqris');
  if clean_method not in ('qris_buatqris', 'qris_manual', 'qris_whatsapp') then
    raise exception 'Metode pembayaran tidak valid' using errcode = '23514';
  end if;

  clean_proof_url := trim(coalesce(proof_image_url_input, ''));
  if clean_method <> 'qris_buatqris' then
    if clean_proof_url = '' then
      raise exception 'Bukti pembayaran wajib diupload sebelum kirim pesanan.' using errcode = '23514';
    end if;
    if not public.is_safe_proof_reference(clean_proof_url, 'proofs', target_seller_id) then
      raise exception 'Bukti bayar tidak aman' using errcode = '23514';
    end if;
  else
    clean_proof_url := '';
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

  select count(*) into recent_duplicate_count
  from public.orders o
  where o.seller_id = target_seller_id
    and o.product_id = target_product_id
    and o.buyer_phone = clean_buyer_phone
    and o.created_at > now() - interval '2 minutes';
  if recent_duplicate_count > 0 then
    raise exception 'Pesanan serupa baru saja dikirim. Tunggu sebentar sebelum mencoba lagi.' using errcode = '42901';
  end if;

  select count(*) into recent_duplicate_count
  from public.orders o
  where o.seller_id = target_seller_id
    and o.buyer_phone = clean_buyer_phone
    and o.created_at > now() - interval '15 minutes';
  if recent_duplicate_count >= 5 then
    raise exception 'Terlalu banyak pesanan dari nomor ini. Coba lagi beberapa menit lagi.' using errcode = '42901';
  end if;

  select greatest(coalesce(platform_fee, 1000), 0), greatest(coalesce(withdrawal_reserve, 2500), 0)
  into setting_platform_fee, setting_withdrawal_reserve
  from public.app_settings
  where id = 'global';

  insert into public.orders (
    seller_id, buyer_name, buyer_phone, product_id, product_name, quantity,
    total_price, payment_method, payment_status, proof_image_url, paid_at,
    platform_fee, withdrawal_reserve, gateway_fee, buyer_total, seller_earning,
    platform_earning, payment_provider, created_at, updated_at
  ) values (
    target_seller_id, clean_buyer_name, clean_buyer_phone, target_product_id, product_title, clean_quantity,
    product_price * clean_quantity, clean_method, 'pending', clean_proof_url, null,
    setting_platform_fee, setting_withdrawal_reserve, 0,
    (product_price * clean_quantity) + setting_platform_fee + setting_withdrawal_reserve,
    product_price * clean_quantity, 0,
    case when clean_method = 'qris_buatqris' then 'buatqris' else '' end,
    now(), now()
  ) returning * into inserted_order;

  return inserted_order;
end;
$$;

revoke all on function public.create_public_order(uuid, uuid, text, text, integer, text, text) from public;
grant execute on function public.create_public_order(uuid, uuid, text, text, integer, text, text) to anon, authenticated;

-- 4) Provider event application: service_role only and idempotent by transaction_id.
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

  if clean_status = 'success' then
    update public.orders
    set payment_status = 'paid',
        paid_at = coalesce(p_paid_at, now()),
        provider_status = 'success',
        gateway_fee = greatest(coalesce(p_admin_fee, 0), 0),
        buyer_total = greatest(coalesce(p_total_amount, buyer_total), buyer_total),
        seller_earning = total_price,
        platform_earning = platform_fee,
        payment_provider = 'buatqris',
        provider_transaction_id = tx.provider_transaction_id,
        payment_expires_at = coalesce(p_expires_at, payment_expires_at),
        updated_at = now()
    where id = order_row.id;
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

-- 5) Verify service-role write path only through explicit backend fields.
-- Do not grant browser clients access to payment_transactions writes.

commit;
