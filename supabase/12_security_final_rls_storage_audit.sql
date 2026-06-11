-- =========================================================
-- NiagaBio 12 - Security Final RLS + Storage Audit
-- Jalankan PALING TERAKHIR setelah 01 sampai 11.
-- Fokus:
-- 1) Public tidak boleh select * profiles.
-- 2) Public page pakai RPC get_public_profile() yang field-nya aman.
-- 3) Notification user hanya boleh ubah read state.
-- 4) Order public tetap pending, seller hanya boleh ubah status order sendiri.
-- 5) Storage path owner diperbaiki dan limit bucket gambar dipasang jika kolom tersedia.
-- =========================================================

-- ---------------------------------------------------------
-- 0) Storage bucket hardening: public read tetap perlu untuk gambar toko.
-- ---------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('niagabio', 'niagabio', true)
on conflict (id) do update set public = true;

do $$
begin
  -- Supabase versi baru punya kolom ini. Dibuat conditional supaya aman di project lama.
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'storage' and table_name = 'buckets' and column_name = 'file_size_limit'
  ) then
    execute 'update storage.buckets set file_size_limit = 3145728 where id = ''niagabio''';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'storage' and table_name = 'buckets' and column_name = 'allowed_mime_types'
  ) then
    execute 'update storage.buckets set allowed_mime_types = array[''image/jpeg'',''image/png'',''image/webp''] where id = ''niagabio''';
  end if;
end $$;

-- ---------------------------------------------------------
-- 1) Helper URL/gambar aman.
-- ---------------------------------------------------------
create or replace function public.is_safe_external_url(value text)
returns boolean
language sql
immutable
as $$
  select
    value is not null
    and length(trim(value)) between 1 and 500
    and lower(trim(value)) !~ '^(javascript|data|vbscript|file|blob):'
    and (
      lower(trim(value)) ~ '^(https?://)[^\s<>"'']+$'
      or lower(trim(value)) ~ '^mailto:[^\s<>"'']+@[^\s<>"'']+$'
      or lower(trim(value)) ~ '^tel:\+?[0-9][0-9\-\s()+]{4,24}$'
    );
$$;

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

  -- Asset bawaan aplikasi boleh. Upload user tetap hanya JPG/PNG/WEBP lewat storage.
  if v ~ '^/?assets/img/[a-z0-9._/-]+\.(jpg|jpeg|png|webp|svg)(\?.*)?$' then
    return true;
  end if;

  -- Data URL/base64 tidak boleh disimpan di DB production.
  if v ~ '^data:' then
    return false;
  end if;

  if v !~ '^https://' then
    return false;
  end if;

  -- External HTTPS image dibatasi ekstensi aman.
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

create or replace function public.is_safe_internal_link(value text)
returns boolean
language sql
immutable
as $$
  select coalesce(nullif(trim(value), ''), 'notifications') ~ '^(admin(#requests|#users|#settings|#reports)?|dashboard|profile|products|links|social|gallery|themes|checkout-settings|orders|upgrade|notifications|u(\?username=[a-z0-9-]{1,32})?)$';
$$;

-- ---------------------------------------------------------
-- 2) Public profile aman: anon tidak lagi select * profiles.
-- ---------------------------------------------------------
create or replace function public.get_public_profile(lookup_username text)
returns table (
  user_id uuid,
  username text,
  display_name text,
  bio text,
  avatar_url text,
  whatsapp_number text,
  theme_name text,
  is_premium boolean
)
language sql
stable
security definer
set search_path = public, auth, pg_temp
as $$
  select
    p.user_id,
    p.username,
    p.display_name,
    p.bio,
    p.avatar_url,
    p.whatsapp_number,
    case
      when public.effective_plan(p.user_id) = 'premium' then coalesce(nullif(p.theme_name, ''), 'service')
      when coalesce(p.theme_name, 'service') in ('service', 'minimal') then p.theme_name
      else 'service'
    end as theme_name,
    (public.effective_plan(p.user_id) = 'premium') as is_premium
  from public.profiles p
  where p.username = lower(regexp_replace(trim(coalesce(lookup_username, '')), '[^a-z0-9-]+', '-', 'g'))
    and p.status = 'active'
  limit 1;
$$;

revoke all on function public.get_public_profile(text) from public;
grant execute on function public.get_public_profile(text) to anon, authenticated;

drop policy if exists "profiles_select_safe" on public.profiles;
drop policy if exists "profiles_select_own_or_admin_final" on public.profiles;

create policy "profiles_select_own_or_admin_final"
on public.profiles for select
to authenticated
using (user_id = auth.uid() or public.is_admin());

-- ---------------------------------------------------------
-- 3) Validasi profile/content untuk cegah XSS/direct API abuse.
-- ---------------------------------------------------------
create or replace function public.validate_profile_public_fields()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
begin
  new.username := lower(regexp_replace(trim(coalesce(new.username, '')), '[^a-z0-9-]+', '-', 'g'));
  new.username := regexp_replace(new.username, '(^-+|-+$)', '', 'g');
  if length(new.username) < 3 or length(new.username) > 32 then
    raise exception 'Username harus 3-32 karakter' using errcode = '23514';
  end if;

  new.display_name := left(trim(coalesce(new.display_name, '')), 80);
  if length(new.display_name) < 2 then
    raise exception 'Nama toko wajib diisi' using errcode = '23514';
  end if;

  new.bio := left(coalesce(new.bio, ''), 500);
  new.whatsapp_number := regexp_replace(coalesce(new.whatsapp_number, ''), '[^0-9]', '', 'g');
  if new.whatsapp_number <> '' and length(new.whatsapp_number) not between 8 and 18 then
    raise exception 'Nomor WhatsApp tidak valid' using errcode = '23514';
  end if;

  if not public.is_safe_public_image_url(coalesce(new.avatar_url, ''), 'avatars', new.user_id)
     and coalesce(new.avatar_url, '') not in ('', 'assets/img/logo.jpg', '/assets/img/logo.jpg') then
    raise exception 'Avatar URL tidak aman' using errcode = '23514';
  end if;

  return new;
end;
$$;

create or replace function public.validate_product_fields()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
begin
  new.name := left(trim(coalesce(new.name, '')), 120);
  if length(new.name) < 2 then
    raise exception 'Nama produk wajib diisi' using errcode = '23514';
  end if;

  new.description := left(coalesce(new.description, ''), 1000);
  new.category := left(trim(coalesce(new.category, '')), 80);
  new.price := greatest(coalesce(new.price, 0), 0);
  if new.price > 1000000000 then
    raise exception 'Harga produk terlalu besar' using errcode = '23514';
  end if;

  if not public.is_safe_public_image_url(coalesce(new.image_url, ''), 'products', new.user_id)
     and coalesce(new.image_url, '') not in ('', 'assets/img/placeholder-product.svg', '/assets/img/placeholder-product.svg') then
    raise exception 'Gambar produk tidak aman' using errcode = '23514';
  end if;

  return new;
end;
$$;

create or replace function public.validate_custom_link_fields()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
begin
  new.title := left(trim(coalesce(new.title, '')), 80);
  if length(new.title) < 1 then
    raise exception 'Judul link wajib diisi' using errcode = '23514';
  end if;

  if not public.is_safe_external_url(new.url) then
    raise exception 'URL link tidak aman' using errcode = '23514';
  end if;

  if coalesce(new.icon, '') !~ '^bi-[a-z0-9-]+$' then
    new.icon := 'bi-link-45deg';
  end if;

  return new;
end;
$$;

create or replace function public.validate_social_link_fields()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
begin
  new.platform := lower(regexp_replace(trim(coalesce(new.platform, 'website')), '[^a-z0-9-]+', '', 'g'));
  if length(new.platform) < 2 or length(new.platform) > 30 then
    raise exception 'Platform tidak valid' using errcode = '23514';
  end if;

  if not public.is_safe_external_url(new.url) then
    raise exception 'URL social tidak aman' using errcode = '23514';
  end if;

  return new;
end;
$$;

create or replace function public.validate_gallery_fields()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
begin
  if not public.is_safe_public_image_url(new.image_url, 'gallery', new.user_id) then
    raise exception 'Gambar gallery tidak aman' using errcode = '23514';
  end if;

  new.caption := left(coalesce(new.caption, ''), 160);
  return new;
end;
$$;

create or replace function public.validate_checkout_fields()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
begin
  new.whatsapp_number := regexp_replace(coalesce(new.whatsapp_number, ''), '[^0-9]', '', 'g');
  if new.whatsapp_number <> '' and length(new.whatsapp_number) not between 8 and 18 then
    raise exception 'Nomor WhatsApp checkout tidak valid' using errcode = '23514';
  end if;

  new.qris_name := left(trim(coalesce(new.qris_name, '')), 80);
  new.payment_note := left(coalesce(new.payment_note, ''), 500);

  if coalesce(new.qris_image_url, '') <> '' and not public.is_safe_public_image_url(new.qris_image_url, 'qris', new.user_id) then
    raise exception 'QRIS toko harus dari folder qris milik user' using errcode = '23514';
  end if;

  return new;
end;
$$;

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

  if coalesce(new.proof_image_url, '') <> '' and not public.is_safe_public_image_url(new.proof_image_url, 'proofs', null) then
    raise exception 'Bukti bayar tidak aman' using errcode = '23514';
  end if;

  return new;
end;
$$;

create or replace function public.validate_app_settings_fields()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
begin
  if not public.is_admin() then
    raise exception 'Only admin can update app settings' using errcode = '42501';
  end if;

  new.maintenance_message := left(coalesce(new.maintenance_message, ''), 300);
  new.premium_note := left(coalesce(new.premium_note, ''), 600);
  new.admin_whatsapp := regexp_replace(coalesce(new.admin_whatsapp, ''), '[^0-9]', '', 'g');
  if length(new.admin_whatsapp) not between 8 and 18 then
    raise exception 'Nomor admin tidak valid' using errcode = '23514';
  end if;

  if coalesce(new.premium_qris_url, '') <> '' and not public.is_safe_public_image_url(new.premium_qris_url, 'premium-qris', null) then
    raise exception 'QRIS Premium harus dari folder premium-qris admin' using errcode = '23514';
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------
-- 4) Notification: user cuma boleh ubah is_read/read_at.
-- ---------------------------------------------------------
create or replace function public.validate_notification_fields()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
begin
  new.type := left(regexp_replace(coalesce(new.type, 'info'), '[^a-z0-9_-]+', '', 'g'), 60);
  new.title := left(coalesce(nullif(trim(new.title), ''), 'Notifikasi'), 120);
  new.message := left(coalesce(new.message, ''), 500);
  if not public.is_safe_internal_link(new.link_url) then
    new.link_url := 'notifications';
  end if;
  return new;
end;
$$;

create or replace function public.protect_notification_read_state()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
begin
  if tg_op = 'UPDATE' and not public.is_admin() then
    new.id := old.id;
    new.user_id := old.user_id;
    new.actor_user_id := old.actor_user_id;
    new.type := old.type;
    new.title := old.title;
    new.message := old.message;
    new.link_url := old.link_url;
    new.metadata := old.metadata;
    new.created_at := old.created_at;

    if new.is_read is distinct from old.is_read then
      if new.is_read is true then
        new.read_at := coalesce(new.read_at, now());
      else
        new.read_at := null;
      end if;
    else
      new.read_at := old.read_at;
    end if;
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------
-- 5) Orders: buyer/public cuma pending; seller cuma ubah status sendiri.
-- ---------------------------------------------------------
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

    new.product_name := product_title;
    new.total_price := product_price * new.quantity;
    new.payment_status := 'pending';
    new.paid_at := null;
    new.created_at := coalesce(new.created_at, now());
  elsif tg_op = 'UPDATE' then
    if new.payment_status not in ('pending', 'paid', 'cancelled') then
      raise exception 'Status pesanan tidak valid' using errcode = '23514';
    end if;

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
      new.created_at := old.created_at;

      if old.payment_status <> 'pending' and new.payment_status is distinct from old.payment_status then
        raise exception 'Status pesanan final tidak bisa diubah oleh seller' using errcode = '42501';
      end if;

      if old.payment_status = 'pending' and new.payment_status not in ('pending', 'paid', 'cancelled') then
        raise exception 'Transisi status pesanan tidak valid' using errcode = '23514';
      end if;
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

-- RLS orders final.
drop policy if exists "orders_insert_public_pending_only" on public.orders;
drop policy if exists "orders_select_seller_or_admin" on public.orders;
drop policy if exists "orders_update_seller_or_admin" on public.orders;
drop policy if exists "orders_delete_admin_only" on public.orders;

create policy "orders_insert_public_pending_only"
on public.orders for insert
to anon, authenticated
with check (
  product_id is not null
  and payment_status = 'pending'
  and paid_at is null
  and quantity > 0
  and public.is_active_user(seller_id)
  and exists (
    select 1
    from public.products p
    where p.id = orders.product_id
      and p.user_id = orders.seller_id
      and p.is_active = true
  )
);

create policy "orders_select_seller_or_admin"
on public.orders for select
to authenticated
using (seller_id = auth.uid() or public.is_admin());

create policy "orders_update_seller_or_admin"
on public.orders for update
to authenticated
using ((seller_id = auth.uid() and public.is_active_user(auth.uid())) or public.is_admin())
with check ((seller_id = auth.uid() and public.is_active_user(auth.uid())) or public.is_admin());

create policy "orders_delete_admin_only"
on public.orders for delete
to authenticated
using (public.is_admin());

-- ---------------------------------------------------------
-- 6) Storage policies final. Path yang dipakai frontend:
-- avatars/{uid}/file, products/{uid}/file, gallery/{uid}/file,
-- qris/{uid}/file, premium-proofs/{uid}/file, premium-qris/{admin_uid}/file,
-- proofs/file untuk checkout public.
-- ---------------------------------------------------------
drop policy if exists "niagabio_public_read" on storage.objects;
drop policy if exists "niagabio_authenticated_upload" on storage.objects;
drop policy if exists "niagabio_public_proof_upload" on storage.objects;
drop policy if exists "niagabio_authenticated_update_own" on storage.objects;
drop policy if exists "niagabio_authenticated_delete_own" on storage.objects;
drop policy if exists "niagabio_user_scoped_upload" on storage.objects;
drop policy if exists "niagabio_proof_upload_public" on storage.objects;
drop policy if exists "niagabio_user_scoped_update" on storage.objects;
drop policy if exists "niagabio_user_scoped_delete" on storage.objects;
drop policy if exists "niagabio_admin_delete_any" on storage.objects;

create policy "niagabio_public_read"
on storage.objects for select
to anon, authenticated
using (bucket_id = 'niagabio');

create policy "niagabio_user_scoped_upload"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'niagabio'
  and lower(storage.extension(name)) in ('jpg', 'jpeg', 'png', 'webp')
  and (
    (
      (storage.foldername(name))[1] in ('avatars', 'products', 'gallery', 'qris', 'premium-proofs')
      and (storage.foldername(name))[2] = auth.uid()::text
    )
    or (
      (storage.foldername(name))[1] = 'premium-qris'
      and (storage.foldername(name))[2] = auth.uid()::text
      and public.is_admin()
    )
    or (
      (storage.foldername(name))[1] = 'proofs'
      and (storage.foldername(name))[2] is null
    )
  )
);

create policy "niagabio_proof_upload_public"
on storage.objects for insert
to anon
with check (
  bucket_id = 'niagabio'
  and lower(storage.extension(name)) in ('jpg', 'jpeg', 'png', 'webp')
  and (storage.foldername(name))[1] = 'proofs'
  and (storage.foldername(name))[2] is null
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
      (storage.foldername(name))[1] in ('avatars', 'products', 'gallery', 'qris', 'premium-proofs')
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
      (storage.foldername(name))[1] in ('avatars', 'products', 'gallery', 'qris', 'premium-proofs')
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
      (storage.foldername(name))[1] in ('avatars', 'products', 'gallery', 'qris', 'premium-proofs')
      and (storage.foldername(name))[2] = auth.uid()::text
    )
    or (
      (storage.foldername(name))[1] = 'premium-qris'
      and (storage.foldername(name))[2] = auth.uid()::text
      and public.is_admin()
    )
  )
);

create policy "niagabio_admin_delete_any"
on storage.objects for delete
to authenticated
using (bucket_id = 'niagabio' and public.is_admin());

-- ---------------------------------------------------------
-- 7) Pasang/refresh trigger final.
-- ---------------------------------------------------------
drop trigger if exists validate_profile_public_fields_v31 on public.profiles;
drop trigger if exists validate_profile_public_fields_v12_final on public.profiles;
create trigger validate_profile_public_fields_v12_final
before insert or update on public.profiles
for each row execute function public.validate_profile_public_fields();

drop trigger if exists validate_product_fields_v31 on public.products;
drop trigger if exists validate_product_fields_v12_final on public.products;
create trigger validate_product_fields_v12_final
before insert or update on public.products
for each row execute function public.validate_product_fields();

drop trigger if exists validate_custom_link_fields_v31 on public.custom_links;
drop trigger if exists validate_custom_link_fields_v12_final on public.custom_links;
create trigger validate_custom_link_fields_v12_final
before insert or update on public.custom_links
for each row execute function public.validate_custom_link_fields();

drop trigger if exists validate_social_link_fields_v31 on public.social_links;
drop trigger if exists validate_social_link_fields_v12_final on public.social_links;
create trigger validate_social_link_fields_v12_final
before insert or update on public.social_links
for each row execute function public.validate_social_link_fields();

drop trigger if exists validate_gallery_fields_v31 on public.gallery;
drop trigger if exists validate_gallery_fields_v12_final on public.gallery;
create trigger validate_gallery_fields_v12_final
before insert or update on public.gallery
for each row execute function public.validate_gallery_fields();

drop trigger if exists validate_checkout_fields_v31 on public.checkout_settings;
drop trigger if exists validate_checkout_fields_v12_final on public.checkout_settings;
create trigger validate_checkout_fields_v12_final
before insert or update on public.checkout_settings
for each row execute function public.validate_checkout_fields();

drop trigger if exists validate_order_public_fields_v31 on public.orders;
drop trigger if exists validate_order_public_fields_v12_final on public.orders;
create trigger validate_order_public_fields_v12_final
before insert or update on public.orders
for each row execute function public.validate_order_public_fields();

drop trigger if exists validate_app_settings_fields_v31 on public.app_settings;
drop trigger if exists validate_app_settings_fields_v12_final on public.app_settings;
create trigger validate_app_settings_fields_v12_final
before insert or update on public.app_settings
for each row execute function public.validate_app_settings_fields();

do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'notifications') then
    execute 'drop trigger if exists validate_notification_fields_v31 on public.notifications';
    execute 'drop trigger if exists validate_notification_fields_v12_final on public.notifications';
    execute 'drop trigger if exists protect_notification_read_state_v12_final on public.notifications';
    execute 'create trigger protect_notification_read_state_v12_final before update on public.notifications for each row execute function public.protect_notification_read_state()';
    execute 'create trigger validate_notification_fields_v12_final before insert or update on public.notifications for each row execute function public.validate_notification_fields()';
  end if;
end $$;

-- ---------------------------------------------------------
-- 8) RLS notification final jika tabel ada.
-- ---------------------------------------------------------
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'notifications') then
    execute 'alter table public.notifications enable row level security';
    execute 'drop policy if exists "notifications_select_own_or_admin" on public.notifications';
    execute 'drop policy if exists "notifications_update_own_read_state" on public.notifications';
    execute 'drop policy if exists "notifications_delete_own_or_admin" on public.notifications';
    execute 'drop policy if exists "notifications_insert_service_only" on public.notifications';

    execute 'create policy "notifications_select_own_or_admin" on public.notifications for select to authenticated using (user_id = auth.uid() or public.is_admin())';
    execute 'create policy "notifications_update_own_read_state" on public.notifications for update to authenticated using (user_id = auth.uid() or public.is_admin()) with check (user_id = auth.uid() or public.is_admin())';
    execute 'create policy "notifications_delete_own_or_admin" on public.notifications for delete to authenticated using (user_id = auth.uid() or public.is_admin())';

    execute 'grant select, update, delete on public.notifications to authenticated';
    execute 'revoke insert on public.notifications from anon, authenticated';
  end if;
end $$;

-- ---------------------------------------------------------
-- 9) Pastikan function admin tidak untuk anon/public.
-- ---------------------------------------------------------
revoke all on function public.admin_update_profile_system_fields(uuid, text, text, text, timestamptz) from public;
revoke all on function public.admin_review_premium_request(uuid, text, integer) from public;
revoke all on function public.admin_soft_delete_user(uuid) from public;
revoke all on function public.reset_my_sales_recap() from public;
revoke all on function public.set_profile_theme(text) from public;

grant execute on function public.admin_update_profile_system_fields(uuid, text, text, text, timestamptz) to authenticated;
grant execute on function public.admin_review_premium_request(uuid, text, integer) to authenticated;
grant execute on function public.admin_soft_delete_user(uuid) to authenticated;
grant execute on function public.reset_my_sales_recap() to authenticated;
grant execute on function public.set_profile_theme(text) to authenticated;

-- END SECURITY FINAL 12
