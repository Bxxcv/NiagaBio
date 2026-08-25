-- NiagaBio Payment Security Hardening P25
-- Run AFTER 24_buatqris_payment_gateway.sql.
-- Goal: browser sellers/admins must not be able to forge payment settlement or financial fields.

begin;

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
    -- Browser users may update only ordinary order-operational fields that the
    -- existing UI legitimately edits. Payment/settlement fields are immutable
    -- to non-admin, non-service callers.
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

-- Explicitly retain the existing public INSERT contract: public clients do not
-- directly insert qris_buatqris rows; they use create_public_order() instead.
-- That RPC is already SECURITY DEFINER and validates payment_method server-side.

comment on function public.protect_orders_fields() is
'P25 hardening: non-admin/non-service callers cannot mutate order payment/settlement fields; service_role is the settlement path.';

commit;
