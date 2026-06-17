-- =========================================================
-- NiagaBio 15 - Order Proof + Anti-Spam Hardening
-- Jalankan setelah SQL 13.
-- Fokus:
-- 1) Public checkout tidak boleh membuat order tanpa bukti bayar.
-- 2) RPC order public hanya menerima QRIS manual / QRIS WhatsApp.
-- 3) Nonaktifkan fallback direct insert order yang longgar di database.
-- 4) Tambahkan anti-spam ringan untuk order duplikat.
-- =========================================================

-- Validasi final untuk semua insert/update orders.
-- Catatan: tombol WhatsApp tetap boleh dipakai untuk tanya penjual, tapi bukan jalur membuat order tanpa bukti bayar.
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

  new.payment_method := coalesce(nullif(trim(lower(new.payment_method)), ''), 'qris_manual');
  if new.payment_method not in ('qris_manual', 'qris_whatsapp') then
    raise exception 'Checkout hanya menerima QRIS manual' using errcode = '23514';
  end if;

  if coalesce(trim(new.proof_image_url), '') = '' then
    raise exception 'Bukti pembayaran wajib diupload' using errcode = '23514';
  end if;

  if not public.is_safe_public_image_url(new.proof_image_url, 'proofs', null) then
    raise exception 'Bukti bayar tidak aman' using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_order_public_fields_v31 on public.orders;
drop trigger if exists validate_order_public_fields_v12_final on public.orders;
drop trigger if exists validate_order_public_fields_v13_checkout_fix on public.orders;
drop trigger if exists validate_order_public_fields_v15_order_hardening on public.orders;
create trigger validate_order_public_fields_v15_order_hardening
before insert or update on public.orders
for each row execute function public.validate_order_public_fields();

-- RPC aman untuk checkout public.
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

  if not public.is_safe_public_image_url(clean_proof_url, 'proofs', null) then
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

  -- Anti-spam ringan: cegah order identik dari nomor yang sama dalam waktu sangat dekat.
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

  -- Anti-spam tambahan: batasi satu nomor membuat terlalu banyak order ke seller yang sama dalam 15 menit.
  select count(*)
  into recent_duplicate_count
  from public.orders o
  where o.seller_id = target_seller_id
    and o.buyer_phone = clean_buyer_phone
    and o.created_at > now() - interval '15 minutes';

  if recent_duplicate_count >= 5 then
    raise exception 'Terlalu banyak pesanan dari nomor ini. Coba lagi beberapa menit lagi.' using errcode = '42901';
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

-- Direct insert order tetap dibuat ketat sebagai belt-and-suspenders.
-- Frontend production tetap wajib memakai RPC create_public_order.
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
  and payment_method in ('qris_manual', 'qris_whatsapp')
  and coalesce(trim(proof_image_url), '') <> ''
  and public.is_safe_public_image_url(proof_image_url, 'proofs', null)
  and public.is_active_user(seller_id)
  and exists (
    select 1
    from public.products p
    where p.id = orders.product_id
      and p.user_id = orders.seller_id
      and p.is_active = true
  )
);

-- Storage public proof upload masih dipertahankan untuk kompatibilitas.
-- Tahap private bucket proof dibuat terpisah agar tidak memutus bukti bayar lama.
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

-- Quick verify after run:
select
  '15_order_proof_antispam_hardening_ok' as patch,
  p.prosecdef as create_public_order_security_definer,
  p.proconfig as create_public_order_config
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'create_public_order';
