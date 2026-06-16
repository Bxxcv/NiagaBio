-- =========================================================
-- NiagaBio 13 - Checkout Order Flow Fix
-- Jalankan setelah SQL 01 sampai 12.
-- Fokus:
-- 1) Fix checkout public yang kena RLS saat insert orders.
-- 2) Bukti pembayaran QRIS wajib ada sebelum order dibuat.
-- 3) Order public dibuat lewat RPC security definer yang tetap validasi produk/seller.
-- =========================================================

-- Helper URL gambar aman. Dibuat ulang supaya patch ini tetap aman jika SQL 12 belum lengkap.
create or replace function public.is_safe_public_image_url(
  value text,
  expected_folder text default null,
  expected_user uuid default null
)
returns boolean
language plpgsql
immutable
as $$
declare
  v text := lower(trim(coalesce(value, '')));
  uid_text text := coalesce(expected_user::text, '');
begin
  if v = '' then
    return true;
  end if;

  if v ~ '^/?assets/img/[a-z0-9._/-]+\.(jpg|jpeg|png|webp|svg)(\?.*)?$' then
    return true;
  end if;

  if v ~ '^data:' then
    return false;
  end if;

  if v !~ '^https://' then
    return false;
  end if;

  if v !~ '/storage/v1/object/public/niagabio/' then
    return v ~ '\.(jpg|jpeg|png|webp)(\?.*)?$';
  end if;

  if expected_folder is null then
    return v ~ '/storage/v1/object/public/niagabio/(avatars|products|gallery|qris|premium-proofs|premium-qris|proofs)/.+\.(jpg|jpeg|png|webp)(\?.*)?$';
  end if;

  if expected_folder = 'proofs' then
    return v ~ '/storage/v1/object/public/niagabio/proofs/[^/]+\.(jpg|jpeg|png|webp)(\?.*)?$';
  end if;

  if expected_folder = 'premium-qris' then
    return v ~ '/storage/v1/object/public/niagabio/premium-qris/[0-9a-f-]+/[^/]+\.(jpg|jpeg|png|webp)(\?.*)?$';
  end if;

  if uid_text = '' then
    return false;
  end if;

  return v ~ ('/storage/v1/object/public/niagabio/' || expected_folder || '/' || uid_text || '/[^/]+\.(jpg|jpeg|png|webp)(\?.*)?$');
end;
$$;

-- Validasi order public. Bukti bayar wajib untuk QRIS manual / QRIS WhatsApp saat insert.
create or replace function public.validate_order_public_fields()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
begin
  new.buyer_name := left(trim(coalesce(new.buyer_name, '')), 80);
  if length(new.buyer_name) < 2 then
    raise exception 'Nama pembeli wajib diisi' using errcode = '23514';
  end if;

  new.buyer_phone := regexp_replace(coalesce(new.buyer_phone, ''), '[^0-9]', '', 'g');
  if length(new.buyer_phone) not between 8 and 18 then
    raise exception 'Nomor pembeli tidak valid' using errcode = '23514';
  end if;

  new.payment_method := coalesce(nullif(trim(new.payment_method), ''), 'qris_manual');
  if new.payment_method not in ('whatsapp', 'qris_manual', 'qris_whatsapp') then
    raise exception 'Metode pembayaran tidak valid' using errcode = '23514';
  end if;

  if tg_op = 'INSERT'
     and new.payment_method in ('qris_manual', 'qris_whatsapp')
     and coalesce(trim(new.proof_image_url), '') = '' then
    raise exception 'Bukti pembayaran wajib diupload' using errcode = '23514';
  end if;

  if coalesce(new.proof_image_url, '') <> ''
     and not public.is_safe_public_image_url(new.proof_image_url, 'proofs', null) then
    raise exception 'Bukti bayar tidak aman' using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_order_public_fields_v31 on public.orders;
drop trigger if exists validate_order_public_fields_v12_final on public.orders;
drop trigger if exists validate_order_public_fields_v13_checkout_fix on public.orders;
create trigger validate_order_public_fields_v13_checkout_fix
before insert or update on public.orders
for each row execute function public.validate_order_public_fields();

-- RPC aman untuk checkout public.
-- Kenapa RPC: pembeli public/anon perlu membuat order, tapi total, nama produk, dan status tetap dihitung/dipaksa database.
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
  if clean_method not in ('whatsapp', 'qris_manual', 'qris_whatsapp') then
    raise exception 'Metode pembayaran tidak valid' using errcode = '23514';
  end if;

  clean_proof_url := trim(coalesce(proof_image_url_input, ''));
  if clean_method in ('qris_manual', 'qris_whatsapp') and clean_proof_url = '' then
    raise exception 'Bukti pembayaran wajib diupload' using errcode = '23514';
  end if;

  if clean_proof_url <> '' and not public.is_safe_public_image_url(clean_proof_url, 'proofs', null) then
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
    now(),
    now()
  )
  returning * into inserted_order;

  return inserted_order;
end;
$$;

revoke all on function public.create_public_order(uuid, uuid, text, text, integer, text, text) from public;
grant execute on function public.create_public_order(uuid, uuid, text, text, integer, text, text) to anon, authenticated;

-- Direct insert tetap dibuka sebagai fallback, tapi lebih ketat.
-- Frontend baru akan memakai RPC create_public_order.
drop policy if exists "orders_insert_public_pending_only" on public.orders;
create policy "orders_insert_public_pending_only"
on public.orders for insert
to anon, authenticated
with check (
  product_id is not null
  and payment_status = 'pending'
  and paid_at is null
  and quantity > 0
  and total_price >= 0
  and payment_method in ('whatsapp', 'qris_manual', 'qris_whatsapp')
  and (
    payment_method = 'whatsapp'
    or coalesce(trim(proof_image_url), '') <> ''
  )
  and (
    coalesce(trim(proof_image_url), '') = ''
    or public.is_safe_public_image_url(proof_image_url, 'proofs', null)
  )
  and public.is_active_user(seller_id)
  and exists (
    select 1
    from public.products p
    where p.id = orders.product_id
      and p.user_id = orders.seller_id
      and p.is_active = true
  )
);

-- Pastikan role frontend punya privilege dasar. RLS tetap mengontrol akses row.
grant insert on public.orders to anon, authenticated;
grant select, update on public.orders to authenticated;

-- Storage bukti bayar public checkout: proofs/file.jpg tanpa folder uid.
insert into storage.buckets (id, name, public)
values ('niagabio', 'niagabio', true)
on conflict (id) do update set public = true;

drop policy if exists "niagabio_proof_upload_public" on storage.objects;
create policy "niagabio_proof_upload_public"
on storage.objects for insert
to anon, authenticated
with check (
  bucket_id = 'niagabio'
  and lower(storage.extension(name)) in ('jpg', 'jpeg', 'png', 'webp')
  and (storage.foldername(name))[1] = 'proofs'
  and (storage.foldername(name))[2] is null
);
