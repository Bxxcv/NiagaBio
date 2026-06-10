-- NiagaBio Supabase Schema - Production Foundation
-- Fokus: RLS aman, role admin aman, app settings, limit plan, order anti manipulasi.
-- Jalankan di Supabase SQL Editor.
-- Setelah sukses, buat bucket storage public bernama: niagabio.

create extension if not exists "pgcrypto";

-- =========================================================
-- TABLES
-- =========================================================

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade unique not null,
  email text,
  username text unique not null,
  display_name text not null,
  bio text default '',
  avatar_url text default '',
  whatsapp_number text default '',
  plan text default 'free' check (plan in ('free','premium')),
  role text default 'user' check (role in ('user','admin')),
  status text default 'active' check (status in ('active','blocked')),
  plan_end_date timestamptz,
  theme_name text default 'service',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  price numeric default 0,
  description text default '',
  image_url text default '',
  category text default '',
  is_active boolean default true,
  is_featured boolean default false,
  sort_order bigint default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.custom_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  title text not null,
  url text not null,
  icon text default 'bi-link-45deg',
  is_active boolean default true,
  sort_order bigint default 0,
  click_count bigint default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.social_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  platform text not null,
  url text not null,
  sort_order bigint default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.gallery (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  image_url text not null,
  caption text default '',
  sort_order bigint default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.checkout_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade unique not null,
  checkout_mode text default 'whatsapp' check (checkout_mode in ('whatsapp','qris_manual','qris_whatsapp')),
  whatsapp_number text default '',
  qris_enabled boolean default false,
  qris_image_url text default '',
  qris_name text default '',
  payment_note text default '',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid references auth.users(id) on delete cascade not null,
  buyer_name text not null,
  buyer_phone text not null,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null,
  quantity integer default 1,
  total_price numeric default 0,
  payment_method text default 'whatsapp' check (payment_method in ('whatsapp','qris_manual','qris_whatsapp')),
  payment_status text default 'pending' check (payment_status in ('pending','paid','cancelled')),
  proof_image_url text default '',
  created_at timestamptz default now(),
  paid_at timestamptz,
  updated_at timestamptz default now()
);

create table if not exists public.app_settings (
  id text primary key default 'global' check (id = 'global'),
  maintenance_mode boolean not null default false,
  maintenance_message text not null default 'Website sedang maintenance. Silakan coba lagi nanti.',
  allow_register boolean not null default true,
  premium_price integer not null default 80000 check (premium_price >= 0),
  admin_whatsapp text not null default '6281234567890',
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

-- =========================================================
-- SAFE MIGRATION / NORMALIZE EXISTING DATA
-- =========================================================

alter table public.profiles add column if not exists updated_at timestamptz default now();
alter table public.products add column if not exists updated_at timestamptz default now();
alter table public.custom_links add column if not exists updated_at timestamptz default now();
alter table public.social_links add column if not exists updated_at timestamptz default now();
alter table public.gallery add column if not exists updated_at timestamptz default now();
alter table public.checkout_settings add column if not exists updated_at timestamptz default now();
alter table public.orders add column if not exists updated_at timestamptz default now();

alter table public.orders add column if not exists proof_image_url text default '';
alter table public.orders add column if not exists paid_at timestamptz;

update public.profiles set plan = 'free' where plan is null or plan not in ('free','premium');
update public.profiles set role = 'user' where role is null or role not in ('user','admin');
update public.profiles set status = 'active' where status is null or status not in ('active','blocked');
update public.profiles set theme_name = 'service' where theme_name is null or theme_name = '';
update public.orders set payment_status = 'pending' where payment_status is null or payment_status not in ('pending','paid','cancelled');
update public.orders set paid_at = null where payment_status <> 'paid';
update public.orders set quantity = 1 where quantity is null or quantity < 1;
update public.orders set total_price = 0 where total_price is null or total_price < 0;

alter table public.profiles alter column plan set default 'free';
alter table public.profiles alter column role set default 'user';
alter table public.profiles alter column status set default 'active';
alter table public.profiles alter column plan set not null;
alter table public.profiles alter column role set not null;
alter table public.profiles alter column status set not null;
alter table public.orders alter column payment_status set default 'pending';
alter table public.orders alter column payment_status set not null;
alter table public.orders alter column quantity set default 1;
alter table public.orders alter column quantity set not null;
alter table public.orders alter column total_price set default 0;
alter table public.orders alter column total_price set not null;

insert into public.app_settings (id, maintenance_mode, maintenance_message, allow_register, premium_price, admin_whatsapp)
values ('global', false, 'Website sedang maintenance. Silakan coba lagi nanti.', true, 80000, '6281234567890')
on conflict (id) do nothing;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'orders_quantity_positive') then
    alter table public.orders add constraint orders_quantity_positive check (quantity > 0);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'orders_total_price_non_negative') then
    alter table public.orders add constraint orders_total_price_non_negative check (total_price >= 0);
  end if;
end $$;

-- =========================================================
-- INDEXES
-- =========================================================

create index if not exists profiles_user_id_idx on public.profiles(user_id);
create index if not exists profiles_username_idx on public.profiles(username);
create index if not exists profiles_role_status_idx on public.profiles(role, status);
create index if not exists products_user_id_idx on public.products(user_id);
create index if not exists custom_links_user_id_idx on public.custom_links(user_id);
create index if not exists social_links_user_id_idx on public.social_links(user_id);
create index if not exists gallery_user_id_idx on public.gallery(user_id);
create index if not exists checkout_settings_user_id_idx on public.checkout_settings(user_id);
create index if not exists orders_seller_id_created_at_idx on public.orders(seller_id, created_at desc);
create index if not exists orders_payment_status_idx on public.orders(payment_status);

-- =========================================================
-- FUNCTIONS
-- =========================================================

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, auth, pg_temp
as $$
  select coalesce((
    select true
    from public.profiles p
    where p.user_id = auth.uid()
      and p.role = 'admin'
      and p.status = 'active'
    limit 1
  ), false);
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

create or replace function public.is_active_user(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth, pg_temp
as $$
  select exists (
    select 1
    from public.profiles p
    where p.user_id = target_user_id
      and p.status = 'active'
  );
$$;

revoke all on function public.is_active_user(uuid) from public;
grant execute on function public.is_active_user(uuid) to anon, authenticated;

create or replace function public.effective_plan(target_user_id uuid)
returns text
language sql
stable
security definer
set search_path = public, auth, pg_temp
as $$
  select case
    when exists (
      select 1
      from public.profiles p
      where p.user_id = target_user_id
        and p.status = 'active'
        and p.plan = 'premium'
        and (p.plan_end_date is null or p.plan_end_date > now())
    ) then 'premium'
    else 'free'
  end;
$$;

revoke all on function public.effective_plan(uuid) from public;
grant execute on function public.effective_plan(uuid) to anon, authenticated;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.protect_profile_system_fields()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    if not public.is_admin() then
      new.role := 'user';
      new.plan := 'free';
      new.status := 'active';
      new.plan_end_date := null;
    end if;
  elsif tg_op = 'UPDATE' then
    if not public.is_admin() then
      new.role := old.role;
      new.plan := old.plan;
      new.status := old.status;
      new.plan_end_date := old.plan_end_date;
    end if;
  end if;

  if coalesce(new.plan, 'free') <> 'premium'
     and coalesce(new.theme_name, 'service') not in ('service', 'minimal') then
    new.theme_name := 'service';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.admin_update_profile_system_fields(
  target_user_id uuid,
  new_role text default null,
  new_plan text default null,
  new_status text default null,
  new_plan_end_date timestamptz default null
)
returns public.profiles
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  updated_profile public.profiles;
begin
  if not public.is_admin() then
    raise exception 'Only admin can update system fields' using errcode = '42501';
  end if;

  if new_role is not null and new_role not in ('user','admin') then
    raise exception 'Invalid role' using errcode = '22023';
  end if;

  if new_plan is not null and new_plan not in ('free','premium') then
    raise exception 'Invalid plan' using errcode = '22023';
  end if;

  if new_status is not null and new_status not in ('active','blocked') then
    raise exception 'Invalid status' using errcode = '22023';
  end if;

  update public.profiles
  set
    role = coalesce(new_role, role),
    plan = coalesce(new_plan, plan),
    status = coalesce(new_status, status),
    plan_end_date = case
      when new_plan = 'free' then null
      when new_plan = 'premium' and new_plan_end_date is null then now() + interval '30 days'
      when new_plan_end_date is not null then new_plan_end_date
      else plan_end_date
    end,
    updated_at = now()
  where user_id = target_user_id
  returning * into updated_profile;

  if updated_profile.user_id is null then
    raise exception 'Profile not found' using errcode = '02000';
  end if;

  return updated_profile;
end;
$$;

revoke all on function public.admin_update_profile_system_fields(uuid, text, text, text, timestamptz) from public;
grant execute on function public.admin_update_profile_system_fields(uuid, text, text, text, timestamptz) to authenticated;

create or replace function public.set_profile_theme(new_theme text)
returns public.profiles
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  theme_id text := lower(trim(coalesce(new_theme, 'service')));
  current_profile public.profiles;
  premium_themes text[] := array['fashion','gadget','food','beauty','dark','luxury','neon','portfolio'];
  free_themes text[] := array['service','minimal'];
begin
  if auth.uid() is null then
    raise exception 'Login diperlukan untuk mengganti tema.' using errcode = '42501';
  end if;

  if not (theme_id = any(free_themes) or theme_id = any(premium_themes)) then
    raise exception 'Tema tidak valid.' using errcode = '22023';
  end if;

  select * into current_profile
  from public.profiles
  where user_id = auth.uid()
  limit 1;

  if current_profile.user_id is null then
    raise exception 'Profile tidak ditemukan.' using errcode = '02000';
  end if;

  if current_profile.status <> 'active' then
    raise exception 'Akun tidak aktif.' using errcode = '42501';
  end if;

  if theme_id = any(premium_themes)
     and current_profile.role <> 'admin'
     and public.effective_plan(auth.uid()) <> 'premium' then
    raise exception 'Tema ini khusus Premium.' using errcode = '42501';
  end if;

  update public.profiles
  set theme_name = theme_id,
      updated_at = now()
  where user_id = auth.uid()
  returning * into current_profile;

  return current_profile;
end;
$$;

revoke all on function public.set_profile_theme(text) from public;
grant execute on function public.set_profile_theme(text) to authenticated;


create or replace function public.enforce_plan_limits()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  plan_name text;
  max_allowed integer;
  current_count integer;
  owner_id uuid;
begin
  owner_id := new.user_id;

  if public.is_admin() then
    new.updated_at := now();
    return new;
  end if;

  if owner_id <> auth.uid() then
    raise exception 'Invalid owner' using errcode = '42501';
  end if;

  if not public.is_active_user(owner_id) then
    raise exception 'User is blocked or inactive' using errcode = '42501';
  end if;

  plan_name := public.effective_plan(owner_id);

  if tg_table_name = 'products' then
    max_allowed := case when plan_name = 'premium' then 500 else 5 end;
    if tg_op = 'INSERT' or new.user_id is distinct from old.user_id then
      select count(*) into current_count from public.products where user_id = owner_id;
      if current_count >= max_allowed then
        raise exception 'Product limit reached for % plan', plan_name using errcode = '23514';
      end if;
    end if;
  elsif tg_table_name = 'custom_links' then
    max_allowed := case when plan_name = 'premium' then 100 else 5 end;
    if tg_op = 'INSERT' or new.user_id is distinct from old.user_id then
      select count(*) into current_count from public.custom_links where user_id = owner_id;
      if current_count >= max_allowed then
        raise exception 'Custom link limit reached for % plan', plan_name using errcode = '23514';
      end if;
    end if;
  elsif tg_table_name = 'social_links' then
    max_allowed := case when plan_name = 'premium' then 20 else 3 end;
    if tg_op = 'INSERT' or new.user_id is distinct from old.user_id then
      select count(*) into current_count from public.social_links where user_id = owner_id;
      if current_count >= max_allowed then
        raise exception 'Social link limit reached for % plan', plan_name using errcode = '23514';
      end if;
    end if;
  elsif tg_table_name = 'gallery' then
    max_allowed := case when plan_name = 'premium' then 50 else 0 end;
    if tg_op = 'INSERT' or new.user_id is distinct from old.user_id then
      select count(*) into current_count from public.gallery where user_id = owner_id;
      if current_count >= max_allowed then
        raise exception 'Gallery limit reached for % plan', plan_name using errcode = '23514';
      end if;
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.enforce_checkout_plan()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
begin
  if public.is_admin() then
    new.updated_at := now();
    return new;
  end if;

  if new.user_id <> auth.uid() then
    raise exception 'Invalid owner' using errcode = '42501';
  end if;

  if not public.is_active_user(new.user_id) then
    raise exception 'User is blocked or inactive' using errcode = '42501';
  end if;

  if public.effective_plan(new.user_id) <> 'premium' then
    new.checkout_mode := 'whatsapp';
    new.qris_enabled := false;
    new.qris_image_url := '';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

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

-- =========================================================
-- TRIGGERS
-- =========================================================

drop trigger if exists protect_profile_system_fields_trigger on public.profiles;
create trigger protect_profile_system_fields_trigger
before insert or update on public.profiles
for each row execute function public.protect_profile_system_fields();

drop trigger if exists enforce_products_plan_limits on public.products;
create trigger enforce_products_plan_limits
before insert or update on public.products
for each row execute function public.enforce_plan_limits();

drop trigger if exists enforce_custom_links_plan_limits on public.custom_links;
create trigger enforce_custom_links_plan_limits
before insert or update on public.custom_links
for each row execute function public.enforce_plan_limits();

drop trigger if exists enforce_social_links_plan_limits on public.social_links;
create trigger enforce_social_links_plan_limits
before insert or update on public.social_links
for each row execute function public.enforce_plan_limits();

drop trigger if exists enforce_gallery_plan_limits on public.gallery;
create trigger enforce_gallery_plan_limits
before insert or update on public.gallery
for each row execute function public.enforce_plan_limits();

drop trigger if exists enforce_checkout_plan_trigger on public.checkout_settings;
create trigger enforce_checkout_plan_trigger
before insert or update on public.checkout_settings
for each row execute function public.enforce_checkout_plan();

drop trigger if exists protect_orders_fields_trigger on public.orders;
create trigger protect_orders_fields_trigger
before insert or update on public.orders
for each row execute function public.protect_orders_fields();

drop trigger if exists touch_products_updated_at on public.products;
create trigger touch_products_updated_at before update on public.products
for each row execute function public.touch_updated_at();

drop trigger if exists touch_custom_links_updated_at on public.custom_links;
create trigger touch_custom_links_updated_at before update on public.custom_links
for each row execute function public.touch_updated_at();

drop trigger if exists touch_social_links_updated_at on public.social_links;
create trigger touch_social_links_updated_at before update on public.social_links
for each row execute function public.touch_updated_at();

drop trigger if exists touch_gallery_updated_at on public.gallery;
create trigger touch_gallery_updated_at before update on public.gallery
for each row execute function public.touch_updated_at();

drop trigger if exists touch_checkout_settings_updated_at on public.checkout_settings;
create trigger touch_checkout_settings_updated_at before update on public.checkout_settings
for each row execute function public.touch_updated_at();

drop trigger if exists touch_app_settings_updated_at on public.app_settings;
create trigger touch_app_settings_updated_at before update on public.app_settings
for each row execute function public.touch_updated_at();

-- =========================================================
-- RLS
-- =========================================================

alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.custom_links enable row level security;
alter table public.social_links enable row level security;
alter table public.gallery enable row level security;
alter table public.checkout_settings enable row level security;
alter table public.orders enable row level security;
alter table public.app_settings enable row level security;

-- Drop old policies agar schema aman dijalankan ulang.
do $$
declare
  pol record;
begin
  for pol in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in ('profiles','products','custom_links','social_links','gallery','checkout_settings','orders','app_settings')
  loop
    execute format('drop policy if exists %I on %I.%I', pol.policyname, pol.schemaname, pol.tablename);
  end loop;
end $$;

-- Profiles
create policy "profiles_select_safe"
on public.profiles for select
to anon, authenticated
using (status = 'active' or user_id = auth.uid() or public.is_admin());

create policy "profiles_insert_own_safe"
on public.profiles for insert
to authenticated
with check (
  user_id = auth.uid()
  and role = 'user'
  and plan = 'free'
  and status = 'active'
  and plan_end_date is null
);

create policy "profiles_update_own_or_admin_safe"
on public.profiles for update
to authenticated
using (user_id = auth.uid() or public.is_admin())
with check (user_id = auth.uid() or public.is_admin());

-- Products
create policy "products_select_safe"
on public.products for select
to anon, authenticated
using (
  (is_active = true and public.is_active_user(products.user_id))
  or user_id = auth.uid()
  or public.is_admin()
);

create policy "products_insert_own"
on public.products for insert
to authenticated
with check (user_id = auth.uid() and public.is_active_user(auth.uid()));

create policy "products_update_own_or_admin"
on public.products for update
to authenticated
using ((user_id = auth.uid() and public.is_active_user(auth.uid())) or public.is_admin())
with check ((user_id = auth.uid() and public.is_active_user(auth.uid())) or public.is_admin());

create policy "products_delete_own_or_admin"
on public.products for delete
to authenticated
using ((user_id = auth.uid() and public.is_active_user(auth.uid())) or public.is_admin());

-- Custom links
create policy "custom_links_select_safe"
on public.custom_links for select
to anon, authenticated
using (
  (is_active = true and public.is_active_user(custom_links.user_id))
  or user_id = auth.uid()
  or public.is_admin()
);

create policy "custom_links_insert_own"
on public.custom_links for insert
to authenticated
with check (user_id = auth.uid() and public.is_active_user(auth.uid()));

create policy "custom_links_update_own_or_admin"
on public.custom_links for update
to authenticated
using ((user_id = auth.uid() and public.is_active_user(auth.uid())) or public.is_admin())
with check ((user_id = auth.uid() and public.is_active_user(auth.uid())) or public.is_admin());

create policy "custom_links_delete_own_or_admin"
on public.custom_links for delete
to authenticated
using ((user_id = auth.uid() and public.is_active_user(auth.uid())) or public.is_admin());

-- Social links
create policy "social_links_select_safe"
on public.social_links for select
to anon, authenticated
using (public.is_active_user(social_links.user_id) or user_id = auth.uid() or public.is_admin());

create policy "social_links_insert_own"
on public.social_links for insert
to authenticated
with check (user_id = auth.uid() and public.is_active_user(auth.uid()));

create policy "social_links_update_own_or_admin"
on public.social_links for update
to authenticated
using ((user_id = auth.uid() and public.is_active_user(auth.uid())) or public.is_admin())
with check ((user_id = auth.uid() and public.is_active_user(auth.uid())) or public.is_admin());

create policy "social_links_delete_own_or_admin"
on public.social_links for delete
to authenticated
using ((user_id = auth.uid() and public.is_active_user(auth.uid())) or public.is_admin());

-- Gallery
create policy "gallery_select_safe"
on public.gallery for select
to anon, authenticated
using (public.is_active_user(gallery.user_id) or user_id = auth.uid() or public.is_admin());

create policy "gallery_insert_own"
on public.gallery for insert
to authenticated
with check (user_id = auth.uid() and public.is_active_user(auth.uid()));

create policy "gallery_update_own_or_admin"
on public.gallery for update
to authenticated
using ((user_id = auth.uid() and public.is_active_user(auth.uid())) or public.is_admin())
with check ((user_id = auth.uid() and public.is_active_user(auth.uid())) or public.is_admin());

create policy "gallery_delete_own_or_admin"
on public.gallery for delete
to authenticated
using ((user_id = auth.uid() and public.is_active_user(auth.uid())) or public.is_admin());

-- Checkout settings
create policy "checkout_settings_select_safe"
on public.checkout_settings for select
to anon, authenticated
using (public.is_active_user(checkout_settings.user_id) or user_id = auth.uid() or public.is_admin());

create policy "checkout_settings_insert_own"
on public.checkout_settings for insert
to authenticated
with check (user_id = auth.uid() and public.is_active_user(auth.uid()));

create policy "checkout_settings_update_own_or_admin"
on public.checkout_settings for update
to authenticated
using ((user_id = auth.uid() and public.is_active_user(auth.uid())) or public.is_admin())
with check ((user_id = auth.uid() and public.is_active_user(auth.uid())) or public.is_admin());

-- App settings: semua field di tabel ini public-safe. Jangan taruh secret/API key di sini.
create policy "app_settings_select_public"
on public.app_settings for select
to anon, authenticated
using (id = 'global');

create policy "app_settings_insert_admin_only"
on public.app_settings for insert
to authenticated
with check (public.is_admin() and id = 'global');

create policy "app_settings_update_admin_only"
on public.app_settings for update
to authenticated
using (public.is_admin())
with check (public.is_admin() and id = 'global');

create policy "app_settings_delete_admin_only"
on public.app_settings for delete
to authenticated
using (public.is_admin());

-- Orders
create policy "orders_insert_public_pending_only"
on public.orders for insert
to anon, authenticated
with check (
  product_id is not null
  and payment_status = 'pending'
  and paid_at is null
  and quantity > 0
  and total_price >= 0
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


-- =========================================================
-- STORAGE BUCKET + POLICIES
-- =========================================================
-- Bucket ini dipakai oleh frontend untuk avatar, produk, gallery, QRIS, dan bukti bayar.
-- Public read dibuka karena gambar produk/public page memang harus bisa tampil.

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

-- Buyer yang tidak login boleh upload bukti order ke proofs/random.ext saja.
-- Karena bucket public, jangan pakai folder ini untuk data sangat sensitif.
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

-- =========================================================
-- BOOTSTRAP ADMIN
-- =========================================================
-- Setelah schema sukses dan akun admin sudah dibuat di Authentication > Users,
-- jalankan file ini:
-- supabase/02_bootstrap_admin_after_signup.sql
--
-- Jangan pakai update biasa untuk bootstrap admin pertama, karena trigger pengunci
-- role/plan/status memang sengaja aktif untuk melindungi user biasa.

-- =========================================================
-- END OF NIAGABIO SCHEMA
-- Kalau di SQL Editor masih ada baris lain setelah ini seperti
-- "id uuid primary key default gen_random_uuid()," maka itu paste-an rusak.
-- Hapus semua baris setelah komentar END ini.
-- =========================================================
-- =========================================================
-- NiagaBio v13 patch
-- Premium request QRIS, admin soft delete, and admin product tools
-- Jalankan SETELAH 01_schema_clean_run_this.sql dan 03_fix_theme_setter.sql.
-- =========================================================

-- App settings tambahan untuk QRIS upgrade premium
alter table public.app_settings add column if not exists premium_qris_url text default '';
alter table public.app_settings add column if not exists premium_note text default 'Transfer sesuai nominal, lalu upload bukti pembayaran. Admin akan memproses upgrade setelah pembayaran valid.';

update public.app_settings
set premium_note = coalesce(nullif(premium_note, ''), 'Transfer sesuai nominal, lalu upload bukti pembayaran. Admin akan memproses upgrade setelah pembayaran valid.')
where id = 'global';

-- Status deleted untuk soft delete user dari Admin Master
update public.profiles set status = 'active' where status is null;
alter table public.profiles drop constraint if exists profiles_status_check;
alter table public.profiles add constraint profiles_status_check check (status in ('active','blocked','deleted'));

-- Tabel request upgrade premium dari user Free
create table if not exists public.premium_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  email text,
  shop_name text not null,
  owner_name text not null,
  proof_url text not null,
  note text default '',
  status text default 'pending' check (status in ('pending','approved','rejected')),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.premium_requests add column if not exists email text;
alter table public.premium_requests add column if not exists shop_name text default '';
alter table public.premium_requests add column if not exists owner_name text default '';
alter table public.premium_requests add column if not exists proof_url text default '';
alter table public.premium_requests add column if not exists note text default '';
alter table public.premium_requests add column if not exists reviewed_by uuid references auth.users(id) on delete set null;
alter table public.premium_requests add column if not exists reviewed_at timestamptz;
alter table public.premium_requests add column if not exists updated_at timestamptz default now();

create index if not exists premium_requests_user_id_idx on public.premium_requests(user_id);
create index if not exists premium_requests_status_created_idx on public.premium_requests(status, created_at desc);

-- Update RPC admin lama agar status deleted valid
create or replace function public.admin_update_profile_system_fields(
  target_user_id uuid,
  new_role text default null,
  new_plan text default null,
  new_status text default null,
  new_plan_end_date timestamptz default null
)
returns public.profiles
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  updated_profile public.profiles;
begin
  if not public.is_admin() then
    raise exception 'Only admin can update system fields' using errcode = '42501';
  end if;

  if new_role is not null and new_role not in ('user','admin') then
    raise exception 'Invalid role' using errcode = '22023';
  end if;

  if new_plan is not null and new_plan not in ('free','premium') then
    raise exception 'Invalid plan' using errcode = '22023';
  end if;

  if new_status is not null and new_status not in ('active','blocked','deleted') then
    raise exception 'Invalid status' using errcode = '22023';
  end if;

  update public.profiles
  set
    role = coalesce(new_role, role),
    plan = case when new_status = 'deleted' then 'free' else coalesce(new_plan, plan) end,
    status = coalesce(new_status, status),
    plan_end_date = case
      when new_status = 'deleted' then null
      when new_plan = 'free' then null
      when new_plan = 'premium' and new_plan_end_date is null then now() + interval '30 days'
      when new_plan_end_date is not null then new_plan_end_date
      else plan_end_date
    end,
    updated_at = now()
  where user_id = target_user_id
  returning * into updated_profile;

  if updated_profile.user_id is null then
    raise exception 'Profile not found' using errcode = '02000';
  end if;

  return updated_profile;
end;
$$;

revoke all on function public.admin_update_profile_system_fields(uuid, text, text, text, timestamptz) from public;
grant execute on function public.admin_update_profile_system_fields(uuid, text, text, text, timestamptz) to authenticated;

-- Admin approve/reject pengajuan premium
create or replace function public.admin_review_premium_request(
  request_id uuid,
  action_status text,
  premium_days integer default 30
)
returns public.premium_requests
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  target_request public.premium_requests;
  days integer := greatest(coalesce(premium_days, 30), 1);
begin
  if not public.is_admin() then
    raise exception 'Only admin can review premium requests' using errcode = '42501';
  end if;

  if action_status not in ('approved','rejected') then
    raise exception 'Invalid review status' using errcode = '22023';
  end if;

  select * into target_request
  from public.premium_requests
  where id = request_id
  for update;

  if target_request.id is null then
    raise exception 'Premium request not found' using errcode = '02000';
  end if;

  update public.premium_requests
  set status = action_status,
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      updated_at = now()
  where id = request_id
  returning * into target_request;

  if action_status = 'approved' then
    update public.profiles
    set plan = 'premium',
        status = 'active',
        plan_end_date = now() + (days || ' days')::interval,
        updated_at = now()
    where user_id = target_request.user_id;
  end if;

  return target_request;
end;
$$;

revoke all on function public.admin_review_premium_request(uuid, text, integer) from public;
grant execute on function public.admin_review_premium_request(uuid, text, integer) to authenticated;

-- Soft delete user dari Admin Master.
-- Catatan: frontend anon key tidak bisa menghapus auth.users. Ini menyembunyikan toko dan membersihkan data toko.
create or replace function public.admin_soft_delete_user(target_user_id uuid)
returns public.profiles
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  deleted_profile public.profiles;
begin
  if not public.is_admin() then
    raise exception 'Only admin can delete users' using errcode = '42501';
  end if;

  if target_user_id = auth.uid() then
    raise exception 'Admin cannot delete own account' using errcode = '42501';
  end if;

  delete from public.products where user_id = target_user_id;
  delete from public.custom_links where user_id = target_user_id;
  delete from public.social_links where user_id = target_user_id;
  delete from public.gallery where user_id = target_user_id;
  delete from public.checkout_settings where user_id = target_user_id;

  update public.premium_requests
  set status = case when status = 'pending' then 'rejected' else status end,
      reviewed_by = auth.uid(),
      reviewed_at = coalesce(reviewed_at, now()),
      updated_at = now()
  where user_id = target_user_id;

  update public.profiles
  set status = 'deleted',
      plan = 'free',
      plan_end_date = null,
      username = case
        when username like '%-deleted-%' then username
        else coalesce(username, 'user') || '-deleted-' || substr(target_user_id::text, 1, 8)
      end,
      updated_at = now()
  where user_id = target_user_id
  returning * into deleted_profile;

  if deleted_profile.user_id is null then
    raise exception 'Profile not found' using errcode = '02000';
  end if;

  return deleted_profile;
end;
$$;

revoke all on function public.admin_soft_delete_user(uuid) from public;
grant execute on function public.admin_soft_delete_user(uuid) to authenticated;

-- Trigger updated_at premium_requests
drop trigger if exists touch_premium_requests_updated_at on public.premium_requests;
create trigger touch_premium_requests_updated_at before update on public.premium_requests
for each row execute function public.touch_updated_at();

-- RLS premium_requests
alter table public.premium_requests enable row level security;

drop policy if exists "premium_requests_select_own_or_admin" on public.premium_requests;
drop policy if exists "premium_requests_insert_own_pending" on public.premium_requests;
drop policy if exists "premium_requests_update_admin_only" on public.premium_requests;
drop policy if exists "premium_requests_delete_admin_only" on public.premium_requests;

create policy "premium_requests_select_own_or_admin"
on public.premium_requests for select
using (user_id = auth.uid() or public.is_admin());

create policy "premium_requests_insert_own_pending"
on public.premium_requests for insert
with check (
  user_id = auth.uid()
  and coalesce(status, 'pending') = 'pending'
  and length(trim(coalesce(shop_name, ''))) > 0
  and length(trim(coalesce(owner_name, ''))) > 0
  and length(trim(coalesce(proof_url, ''))) > 0
);

create policy "premium_requests_update_admin_only"
on public.premium_requests for update
using (public.is_admin())
with check (public.is_admin());

create policy "premium_requests_delete_admin_only"
on public.premium_requests for delete
using (public.is_admin());

-- Pastikan anon/auth bisa akses sesuai RLS
grant select, insert, update, delete on public.premium_requests to authenticated;
grant select on public.premium_requests to anon;
-- =========================================================
-- NiagaBio v21 - Reset Rekap Penjualan Toko
-- Jalankan setelah schema utama untuk mengaktifkan tombol Reset Rekap di halaman /orders.
-- Function ini hanya menghapus order milik akun yang sedang login.
-- =========================================================

create or replace function public.reset_my_sales_recap()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_count integer := 0;
begin
  if auth.uid() is null then
    raise exception 'Login diperlukan' using errcode = '42501';
  end if;

  if not public.is_active_user(auth.uid()) and not public.is_admin() then
    raise exception 'Akun tidak aktif' using errcode = '42501';
  end if;

  delete from public.orders
  where seller_id = auth.uid();

  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

revoke all on function public.reset_my_sales_recap() from public;
grant execute on function public.reset_my_sales_recap() to authenticated;

-- =========================================================
-- NiagaBio v24 hardening embedded for fresh installs.
-- Standalone patch is also available at supabase/06_security_hardening.sql.
-- =========================================================
-- =========================================================
-- NiagaBio v24 - Final Security Hardening
-- Jalankan SETELAH 01_schema_clean_run_this.sql sampai 05_reset_sales_recap.sql.
-- Fokus: storage scoped, upload file aman, admin self-protection, request premium aman.
-- =========================================================

-- 1) Pastikan status deleted tetap valid untuk soft-delete.
update public.profiles set status = 'active' where status is null;
alter table public.profiles drop constraint if exists profiles_status_check;
alter table public.profiles add constraint profiles_status_check check (status in ('active','blocked','deleted'));

-- 2) Admin tidak boleh mengubah role/plan/status akun sendiri lewat RPC/direct API.
create or replace function public.admin_update_profile_system_fields(
  target_user_id uuid,
  new_role text default null,
  new_plan text default null,
  new_status text default null,
  new_plan_end_date timestamptz default null
)
returns public.profiles
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  updated_profile public.profiles;
begin
  if not public.is_admin() then
    raise exception 'Only admin can update system fields' using errcode = '42501';
  end if;

  if target_user_id = auth.uid() then
    raise exception 'Admin cannot update own system fields' using errcode = '42501';
  end if;

  if new_role is not null and new_role not in ('user','admin') then
    raise exception 'Invalid role' using errcode = '22023';
  end if;

  if new_plan is not null and new_plan not in ('free','premium') then
    raise exception 'Invalid plan' using errcode = '22023';
  end if;

  if new_status is not null and new_status not in ('active','blocked','deleted') then
    raise exception 'Invalid status' using errcode = '22023';
  end if;

  update public.profiles
  set
    role = coalesce(new_role, role),
    plan = case when new_status = 'deleted' then 'free' else coalesce(new_plan, plan) end,
    status = coalesce(new_status, status),
    plan_end_date = case
      when new_status = 'deleted' then null
      when new_plan = 'free' then null
      when new_plan = 'premium' and new_plan_end_date is null then now() + interval '30 days'
      when new_plan_end_date is not null then new_plan_end_date
      else plan_end_date
    end,
    updated_at = now()
  where user_id = target_user_id
  returning * into updated_profile;

  if updated_profile.user_id is null then
    raise exception 'Profile not found' using errcode = '02000';
  end if;

  return updated_profile;
end;
$$;

revoke all on function public.admin_update_profile_system_fields(uuid, text, text, text, timestamptz) from public;
grant execute on function public.admin_update_profile_system_fields(uuid, text, text, text, timestamptz) to authenticated;

-- 3) Premium request hanya untuk user Free aktif, status awal pending, tidak spam pending.
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

    if lower(coalesce(new.proof_url, '')) !~ ('/storage/v1/object/public/niagabio/premium-proofs/' || auth.uid()::text || '/.+\.(jpg|jpeg|png|webp)(\?.*)?$') then
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

-- Perketat policy premium request sesuai trigger.
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
  and lower(coalesce(proof_url, '')) ~ ('/storage/v1/object/public/niagabio/premium-proofs/' || auth.uid()::text || '/.+\.(jpg|jpeg|png|webp)(\?.*)?$')
);

-- 4) Storage bucket tetap public-read untuk gambar toko, tapi upload/update/delete wajib scoped.
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

-- Buyer yang tidak login boleh upload bukti order ke proofs/random.ext saja.
-- Karena bucket public, jangan pakai folder ini untuk data sangat sensitif.
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

-- 5) Register lock: app_settings.allow_register tetap dicek frontend.
-- Catatan: Supabase Auth signUp langsung dari API masih perlu dikontrol dari Dashboard Auth/Supabase Auth settings.


-- =========================================================
-- NiagaBio v26 - In-App Notifications
-- Jalankan sekali setelah deploy v26.
-- =========================================================

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  actor_user_id uuid references auth.users(id) on delete set null,
  type text not null default 'info',
  title text not null default 'Notifikasi',
  message text not null default '',
  link_url text not null default 'notifications',
  metadata jsonb not null default '{}'::jsonb,
  is_read boolean not null default false,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_created_idx on public.notifications(user_id, created_at desc);
create index if not exists notifications_user_unread_idx on public.notifications(user_id, is_read, created_at desc);
create index if not exists notifications_type_idx on public.notifications(type);

alter table public.notifications enable row level security;

drop policy if exists "notifications_select_own_or_admin" on public.notifications;
drop policy if exists "notifications_update_own_read_state" on public.notifications;
drop policy if exists "notifications_delete_own_or_admin" on public.notifications;
drop policy if exists "notifications_insert_service_only" on public.notifications;

create policy "notifications_select_own_or_admin"
on public.notifications for select
to authenticated
using (user_id = auth.uid() or public.is_admin());

create policy "notifications_update_own_read_state"
on public.notifications for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "notifications_delete_own_or_admin"
on public.notifications for delete
to authenticated
using (user_id = auth.uid() or public.is_admin());

grant select, update, delete on public.notifications to authenticated;
revoke insert on public.notifications from anon, authenticated;

create or replace function public.create_notification(
  target_user_id uuid,
  notif_type text,
  notif_title text,
  notif_message text,
  notif_link text default 'notifications',
  notif_metadata jsonb default '{}'::jsonb,
  actor_id uuid default null
)
returns public.notifications
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  inserted public.notifications;
begin
  if target_user_id is null then
    raise exception 'target_user_id is required' using errcode = '23502';
  end if;

  insert into public.notifications (
    user_id,
    actor_user_id,
    type,
    title,
    message,
    link_url,
    metadata
  ) values (
    target_user_id,
    actor_id,
    left(coalesce(nullif(trim(notif_type), ''), 'info'), 60),
    left(coalesce(nullif(trim(notif_title), ''), 'Notifikasi'), 120),
    left(coalesce(notif_message, ''), 500),
    left(coalesce(nullif(trim(notif_link), ''), 'notifications'), 180),
    coalesce(notif_metadata, '{}'::jsonb)
  ) returning * into inserted;

  return inserted;
end;
$$;

revoke all on function public.create_notification(uuid, text, text, text, text, jsonb, uuid) from public;

create or replace function public.notify_order_insert()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
begin
  perform public.create_notification(
    new.seller_id,
    'order_new',
    'Pesanan baru',
    coalesce(new.buyer_name, 'Pembeli') || ' memesan ' || coalesce(new.product_name, 'produk') || ' senilai Rp' || to_char(coalesce(new.total_price, 0), 'FM999G999G999G999'),
    'orders',
    jsonb_build_object('order_id', new.id, 'product_id', new.product_id, 'total_price', new.total_price),
    null
  );
  return new;
end;
$$;

create or replace function public.notify_order_status_update()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
begin
  if old.payment_status is distinct from new.payment_status and auth.uid() is not null and auth.uid() <> new.seller_id then
    perform public.create_notification(
      new.seller_id,
      'order_status_updated',
      'Status pesanan diperbarui',
      'Pesanan ' || coalesce(new.product_name, 'produk') || ' berubah menjadi ' || coalesce(new.payment_status, 'pending') || '.',
      'orders',
      jsonb_build_object('order_id', new.id, 'payment_status', new.payment_status),
      auth.uid()
    );
  end if;
  return new;
end;
$$;

drop trigger if exists notify_order_insert_trigger on public.orders;
create trigger notify_order_insert_trigger
after insert on public.orders
for each row execute function public.notify_order_insert();

drop trigger if exists notify_order_status_update_trigger on public.orders;
create trigger notify_order_status_update_trigger
after update of payment_status on public.orders
for each row execute function public.notify_order_status_update();

create or replace function public.notify_premium_request_insert()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  admin_profile record;
begin
  for admin_profile in
    select user_id
    from public.profiles
    where role = 'admin'
      and status = 'active'
  loop
    perform public.create_notification(
      admin_profile.user_id,
      'premium_request_new',
      'Request Premium baru',
      coalesce(new.shop_name, 'User') || ' mengirim pengajuan upgrade Premium.',
      'admin#requests',
      jsonb_build_object('request_id', new.id, 'request_user_id', new.user_id),
      new.user_id
    );
  end loop;
  return new;
end;
$$;

drop trigger if exists notify_premium_request_insert_trigger on public.premium_requests;
create trigger notify_premium_request_insert_trigger
after insert on public.premium_requests
for each row execute function public.notify_premium_request_insert();

create or replace function public.admin_review_premium_request(
  request_id uuid,
  action_status text,
  premium_days integer default 30
)
returns public.premium_requests
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  target_request public.premium_requests;
  days integer := greatest(coalesce(premium_days, 30), 1);
begin
  if not public.is_admin() then
    raise exception 'Only admin can review premium requests' using errcode = '42501';
  end if;

  if action_status not in ('approved','rejected') then
    raise exception 'Invalid review status' using errcode = '22023';
  end if;

  select * into target_request
  from public.premium_requests
  where id = request_id
  for update;

  if target_request.id is null then
    raise exception 'Premium request not found' using errcode = '02000';
  end if;

  update public.premium_requests
  set status = action_status,
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      updated_at = now()
  where id = request_id
  returning * into target_request;

  if action_status = 'approved' then
    update public.profiles
    set plan = 'premium',
        status = 'active',
        plan_end_date = now() + (days || ' days')::interval,
        updated_at = now()
    where user_id = target_request.user_id;

    perform public.create_notification(
      target_request.user_id,
      'premium_approved',
      'Upgrade Premium disetujui',
      'Akun kamu sudah Premium. Fitur tema, gallery, dan QRIS sudah aktif.',
      'dashboard',
      jsonb_build_object('request_id', target_request.id, 'premium_days', days),
      auth.uid()
    );
  else
    perform public.create_notification(
      target_request.user_id,
      'premium_rejected',
      'Upgrade Premium ditolak',
      'Pengajuan Premium kamu ditolak. Cek kembali bukti pembayaran atau hubungi admin.',
      'upgrade',
      jsonb_build_object('request_id', target_request.id),
      auth.uid()
    );
  end if;

  return target_request;
end;
$$;

revoke all on function public.admin_review_premium_request(uuid, text, integer) from public;
grant execute on function public.admin_review_premium_request(uuid, text, integer) to authenticated;

-- END v26 notification patch

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

