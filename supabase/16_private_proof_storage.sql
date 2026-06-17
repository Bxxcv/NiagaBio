-- =========================================================
-- NiagaBio 16 - Private Payment Proof Storage + Signed URL
-- Jalankan setelah SQL 15.
-- Fokus:
-- 1) Bukti checkout dan bukti upgrade baru masuk bucket private.
-- 2) Bukti lama di bucket public tetap bisa dibaca untuk kompatibilitas.
-- 3) Seller/admin melihat bukti private lewat signed URL dari frontend.
-- 4) Public bucket tetap untuk avatar, produk, gallery, QRIS, asset publik.
-- =========================================================

-- 1) Bucket private khusus bukti pembayaran.
insert into storage.buckets (id, name, public)
values ('niagabio-private', 'niagabio-private', false)
on conflict (id) do update set public = false;

-- Set batas ukuran dan MIME jika kolom tersedia di project Supabase.
do $$
begin
  update storage.buckets
  set
    file_size_limit = 3145728,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
  where id = 'niagabio-private';
exception
  when undefined_column then
    null;
end $$;

-- 2) Helper validasi referensi bukti.
-- Format private baru:
-- private:niagabio-private/proofs/{seller_uuid}/{file}.jpg
-- private:niagabio-private/premium-proofs/{user_uuid}/{file}.jpg
create or replace function public.is_safe_private_proof_ref(
  value text,
  expected_folder text,
  expected_owner uuid default null
)
returns boolean
language plpgsql
stable
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v text := lower(trim(coalesce(value, '')));
  folder text := lower(trim(coalesce(expected_folder, '')));
  owner_pattern text;
  uuid_pattern text := '[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}';
begin
  if v = '' or folder not in ('proofs', 'premium-proofs') then
    return false;
  end if;

  owner_pattern := case
    when expected_owner is null then uuid_pattern
    else expected_owner::text
  end;

  return v ~ ('^private:niagabio-private/' || folder || '/' || owner_pattern || '/[^/]+\.(jpg|jpeg|png|webp)$');
end;
$$;

create or replace function public.is_safe_proof_reference(
  value text,
  expected_folder text,
  expected_owner uuid default null
)
returns boolean
language plpgsql
stable
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v text := lower(trim(coalesce(value, '')));
  folder text := lower(trim(coalesce(expected_folder, '')));
begin
  if v = '' or folder not in ('proofs', 'premium-proofs') then
    return false;
  end if;

  -- Private format baru.
  if public.is_safe_private_proof_ref(v, folder, expected_owner) then
    return true;
  end if;

  -- Kompatibilitas bukti checkout lama di public bucket: proofs/file.jpg
  if folder = 'proofs' then
    return public.is_safe_public_image_url(v, 'proofs', null);
  end if;

  -- Kompatibilitas bukti premium lama di public bucket: premium-proofs/{uid}/file.jpg
  if folder = 'premium-proofs' and expected_owner is not null then
    return v ~ ('/storage/v1/object/public/niagabio/premium-proofs/' || expected_owner::text || '/.+\.(jpg|jpeg|png|webp)(\?.*)?$');
  end if;

  return false;
end;
$$;

grant execute on function public.is_safe_private_proof_ref(text, text, uuid) to anon, authenticated;
grant execute on function public.is_safe_proof_reference(text, text, uuid) to anon, authenticated;

-- 3) Update validasi orders supaya menerima private proof baru dan public proof lama.
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

  if not public.is_safe_proof_reference(new.proof_image_url, 'proofs', new.seller_id) then
    raise exception 'Bukti bayar tidak aman' using errcode = '23514';
  end if;

  return new;
end;
$$;

-- 4) Update RPC checkout public.
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

-- 5) Direct insert tetap dikunci. Frontend production tetap wajib lewat RPC.
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
  and public.is_safe_proof_reference(proof_image_url, 'proofs', seller_id)
  and public.is_active_user(seller_id)
  and exists (
    select 1
    from public.products p
    where p.id = orders.product_id
      and p.user_id = orders.seller_id
      and p.is_active = true
  )
);

-- 6) Update validasi premium request supaya menerima private proof baru dan public proof lama.
create or replace function public.protect_premium_request_fields()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    if auth.uid() is null then
      raise exception 'Login diperlukan' using errcode = '42501';
    end if;

    if new.user_id <> auth.uid() then
      raise exception 'Request harus milik user login' using errcode = '42501';
    end if;

    if not public.is_active_user(auth.uid()) then
      raise exception 'Akun tidak aktif' using errcode = '42501';
    end if;

    if public.effective_plan(auth.uid()) <> 'free' then
      raise exception 'Akun Premium tidak perlu request upgrade baru' using errcode = '42501';
    end if;

    if exists (
      select 1 from public.premium_requests pr
      where pr.user_id = auth.uid()
        and pr.status = 'pending'
        and pr.id is distinct from new.id
    ) then
      raise exception 'Masih ada pengajuan pending' using errcode = '23505';
    end if;

    new.status := 'pending';
    new.reviewed_by := null;
    new.reviewed_at := null;
    new.email := coalesce(nullif(trim(new.email), ''), (select email from auth.users where id = auth.uid()));

    if length(trim(coalesce(new.shop_name, ''))) < 2 then
      raise exception 'Nama toko wajib diisi' using errcode = '23514';
    end if;

    if length(trim(coalesce(new.owner_name, ''))) < 2 then
      raise exception 'Nama pemilik wajib diisi' using errcode = '23514';
    end if;

    if not public.is_safe_proof_reference(new.proof_url, 'premium-proofs', auth.uid()) then
      raise exception 'Bukti transfer harus dari upload premium-proofs milik user' using errcode = '23514';
    end if;
  elsif tg_op = 'UPDATE' then
    if not public.is_admin() then
      raise exception 'Only admin can update premium requests' using errcode = '42501';
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists protect_premium_request_fields_trigger on public.premium_requests;
create trigger protect_premium_request_fields_trigger
before insert or update on public.premium_requests
for each row execute function public.protect_premium_request_fields();

drop policy if exists "premium_requests_insert_own_pending" on public.premium_requests;
create policy "premium_requests_insert_own_pending"
on public.premium_requests for insert
to authenticated
with check (
  user_id = auth.uid()
  and coalesce(status, 'pending') = 'pending'
  and public.is_active_user(auth.uid())
  and public.effective_plan(auth.uid()) = 'free'
  and length(trim(coalesce(shop_name, ''))) > 1
  and length(trim(coalesce(owner_name, ''))) > 1
  and public.is_safe_proof_reference(proof_url, 'premium-proofs', auth.uid())
);

-- 7) Public bucket tetap public-read, tapi upload bukti bayar baru tidak lagi ke bucket public.
drop policy if exists "niagabio_authenticated_upload" on storage.objects;
drop policy if exists "niagabio_public_proof_upload" on storage.objects;
drop policy if exists "niagabio_proof_upload_public" on storage.objects;
drop policy if exists "niagabio_user_scoped_upload" on storage.objects;
drop policy if exists "niagabio_user_scoped_update" on storage.objects;
drop policy if exists "niagabio_user_scoped_delete" on storage.objects;
drop policy if exists "niagabio_authenticated_update_own" on storage.objects;
drop policy if exists "niagabio_authenticated_delete_own" on storage.objects;

create policy "niagabio_user_scoped_upload"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'niagabio'
  and lower(storage.extension(name)) in ('jpg', 'jpeg', 'png', 'webp')
  and (
    (
      (storage.foldername(name))[1] in ('avatars', 'products', 'gallery', 'qris')
      and (storage.foldername(name))[2] = auth.uid()::text
    )
    or (
      (storage.foldername(name))[1] = 'premium-qris'
      and (storage.foldername(name))[2] = auth.uid()::text
      and public.is_admin()
    )
  )
);

create policy "niagabio_user_scoped_update"
on storage.objects for update
to authenticated
using (
  bucket_id = 'niagabio'
  and owner = auth.uid()
  and lower(storage.extension(name)) in ('jpg', 'jpeg', 'png', 'webp')
  and (
    (
      (storage.foldername(name))[1] in ('avatars', 'products', 'gallery', 'qris')
      and (storage.foldername(name))[2] = auth.uid()::text
    )
    or (
      (storage.foldername(name))[1] = 'premium-qris'
      and (storage.foldername(name))[2] = auth.uid()::text
      and public.is_admin()
    )
  )
)
with check (
  bucket_id = 'niagabio'
  and owner = auth.uid()
  and lower(storage.extension(name)) in ('jpg', 'jpeg', 'png', 'webp')
  and (
    (
      (storage.foldername(name))[1] in ('avatars', 'products', 'gallery', 'qris')
      and (storage.foldername(name))[2] = auth.uid()::text
    )
    or (
      (storage.foldername(name))[1] = 'premium-qris'
      and (storage.foldername(name))[2] = auth.uid()::text
      and public.is_admin()
    )
  )
);

create policy "niagabio_user_scoped_delete"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'niagabio'
  and owner = auth.uid()
  and (
    (
      (storage.foldername(name))[1] in ('avatars', 'products', 'gallery', 'qris')
      and (storage.foldername(name))[2] = auth.uid()::text
    )
    or (
      (storage.foldername(name))[1] = 'premium-qris'
      and (storage.foldername(name))[2] = auth.uid()::text
      and public.is_admin()
    )
  )
);

-- 8) Private bucket policies.
drop policy if exists "niagabio_private_proof_upload_public" on storage.objects;
drop policy if exists "niagabio_private_premium_proof_upload_own" on storage.objects;
drop policy if exists "niagabio_private_proof_select_owner_or_admin" on storage.objects;
drop policy if exists "niagabio_private_proof_delete_owner_or_admin" on storage.objects;

create policy "niagabio_private_proof_upload_public"
on storage.objects for insert
to anon, authenticated
with check (
  bucket_id = 'niagabio-private'
  and lower(storage.extension(name)) in ('jpg', 'jpeg', 'png', 'webp')
  and (storage.foldername(name))[1] = 'proofs'
  and (storage.foldername(name))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  and (storage.foldername(name))[3] is null
);

create policy "niagabio_private_premium_proof_upload_own"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'niagabio-private'
  and lower(storage.extension(name)) in ('jpg', 'jpeg', 'png', 'webp')
  and (storage.foldername(name))[1] = 'premium-proofs'
  and (storage.foldername(name))[2] = auth.uid()::text
  and (storage.foldername(name))[3] is null
);

create policy "niagabio_private_proof_select_owner_or_admin"
on storage.objects for select
to authenticated
using (
  bucket_id = 'niagabio-private'
  and lower(storage.extension(name)) in ('jpg', 'jpeg', 'png', 'webp')
  and (
    public.is_admin()
    or (
      (storage.foldername(name))[1] in ('proofs', 'premium-proofs')
      and (storage.foldername(name))[2] = auth.uid()::text
    )
  )
);

create policy "niagabio_private_proof_delete_owner_or_admin"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'niagabio-private'
  and (
    public.is_admin()
    or (
      (storage.foldername(name))[1] in ('proofs', 'premium-proofs')
      and (storage.foldername(name))[2] = auth.uid()::text
    )
  )
);

-- Quick verify after run.
select
  '16_private_proof_storage_ok' as patch,
  (select public from storage.buckets where id = 'niagabio-private') as private_bucket_public,
  (select count(*) from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname like 'niagabio_private_%') as private_storage_policy_count;
