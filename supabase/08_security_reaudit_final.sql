-- =========================================================
-- NiagaBio v31 - Security Re-Audit Final Patch
-- Jalankan SETELAH 01 sampai 07, atau setelah v24/v26 jika database sudah jalan.
-- Fokus: perbaiki policy storage delete, validasi URL/gambar di DB, validasi konten user,
-- dan cegah data berbahaya masuk lewat direct Supabase API.
-- =========================================================

-- Safe migration: pastikan kolom dari patch sebelumnya ada sebelum validasi v31.
alter table public.app_settings add column if not exists premium_qris_url text default '';
alter table public.app_settings add column if not exists premium_note text default 'Transfer sesuai nominal, lalu upload bukti pembayaran. Admin akan memproses upgrade setelah pembayaran valid.';
alter table public.profiles drop constraint if exists profiles_status_check;
alter table public.profiles add constraint profiles_status_check check (status in ('active','blocked','deleted'));

-- 1) Helper SQL: validasi URL external aman.
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

-- Helper: validasi URL gambar public yang aman.
create or replace function public.is_safe_public_image_url(value text, expected_folder text default null, expected_user uuid default null)
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

  -- Asset lokal bawaan aplikasi. Placeholder SVG bawaan boleh, upload SVG user tetap ditolak oleh storage/frontend.
  if v ~ '^/?assets/img/[a-z0-9._/-]+\.(jpg|jpeg|png|webp|svg)(\?.*)?$' then
    return true;
  end if;

  -- Data URL hanya untuk demo/local fallback; jangan simpan ke DB production.
  if v ~ '^data:' then
    return false;
  end if;

  if v !~ '^https://' then
    return false;
  end if;

  if v !~ '/storage/v1/object/public/niagabio/' then
    -- External HTTPS image dibatasi ekstensi aman. Ini menjaga fleksibilitas tanpa SVG/GIF.
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

-- 2) Storage: perbaiki ulang semua policy agar tidak ada syntax rusak/longgar.
insert into storage.buckets (id, name, public)
values ('niagabio', 'niagabio', true)
on conflict (id) do update set public = true;

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
  and lower(storage.extension(name)) in ('jpg','jpeg','png','webp')
  and (
    (
      (storage.foldername(name))[1] in ('avatars','products','gallery','qris','premium-proofs')
      and (storage.foldername(name))[2] = auth.uid()::text
      and (storage.foldername(name))[3] is not null
    )
    or (
      (storage.foldername(name))[1] = 'premium-qris'
      and (storage.foldername(name))[2] = auth.uid()::text
      and (storage.foldername(name))[3] is not null
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
  and lower(storage.extension(name)) in ('jpg','jpeg','png','webp')
  and (storage.foldername(name))[1] = 'proofs'
  and (storage.foldername(name))[2] is null
);

create policy "niagabio_user_scoped_update"
on storage.objects for update
to authenticated
using (
  bucket_id = 'niagabio'
  and owner = auth.uid()
  and lower(storage.extension(name)) in ('jpg','jpeg','png','webp')
  and (
    (
      (storage.foldername(name))[1] in ('avatars','products','gallery','qris','premium-proofs')
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
  and lower(storage.extension(name)) in ('jpg','jpeg','png','webp')
  and (
    (
      (storage.foldername(name))[1] in ('avatars','products','gallery','qris','premium-proofs')
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
      (storage.foldername(name))[1] in ('avatars','products','gallery','qris','premium-proofs')
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

-- 3) Validasi konten/URL/gambar dari direct API.
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

-- Pasang trigger validasi tambahan. Nama trigger dibuat khusus v31 agar mudah dilacak.
drop trigger if exists validate_profile_public_fields_v31 on public.profiles;
create trigger validate_profile_public_fields_v31
before insert or update on public.profiles
for each row execute function public.validate_profile_public_fields();

drop trigger if exists validate_product_fields_v31 on public.products;
create trigger validate_product_fields_v31
before insert or update on public.products
for each row execute function public.validate_product_fields();

drop trigger if exists validate_custom_link_fields_v31 on public.custom_links;
create trigger validate_custom_link_fields_v31
before insert or update on public.custom_links
for each row execute function public.validate_custom_link_fields();

drop trigger if exists validate_social_link_fields_v31 on public.social_links;
create trigger validate_social_link_fields_v31
before insert or update on public.social_links
for each row execute function public.validate_social_link_fields();

drop trigger if exists validate_gallery_fields_v31 on public.gallery;
create trigger validate_gallery_fields_v31
before insert or update on public.gallery
for each row execute function public.validate_gallery_fields();

drop trigger if exists validate_checkout_fields_v31 on public.checkout_settings;
create trigger validate_checkout_fields_v31
before insert or update on public.checkout_settings
for each row execute function public.validate_checkout_fields();

drop trigger if exists validate_order_public_fields_v31 on public.orders;
create trigger validate_order_public_fields_v31
before insert or update on public.orders
for each row execute function public.validate_order_public_fields();

drop trigger if exists validate_app_settings_fields_v31 on public.app_settings;
create trigger validate_app_settings_fields_v31
before insert or update on public.app_settings
for each row execute function public.validate_app_settings_fields();

-- Notifications bisa jadi belum ada kalau patch 07 belum dijalankan.
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'notifications') then
    execute 'drop trigger if exists validate_notification_fields_v31 on public.notifications';
    execute 'create trigger validate_notification_fields_v31 before insert or update on public.notifications for each row execute function public.validate_notification_fields()';
  end if;
end $$;

-- 4) Pastikan function penting tidak bisa dieksekusi anon/public sembarangan.
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

-- 5) Catatan: anon tetap boleh insert orders karena pembeli checkout public.
-- Keamanan order ditahan oleh RLS + trigger protect_orders_fields + validate_order_public_fields.
-- END OF v31 SECURITY RE-AUDIT PATCH
