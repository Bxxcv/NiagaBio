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

create policy "niagabio_public_read"
on storage.objects for select
to anon, authenticated
using (bucket_id = 'niagabio');

create policy "niagabio_authenticated_upload"
on storage.objects for insert
to authenticated
with check (bucket_id = 'niagabio');

-- Buyer publik boleh upload bukti pembayaran ke folder proofs/.
-- Jangan taruh file rahasia lain di bucket public ini.
create policy "niagabio_public_proof_upload"
on storage.objects for insert
to anon
with check (bucket_id = 'niagabio' and (storage.foldername(name))[1] = 'proofs');

create policy "niagabio_authenticated_update_own"
on storage.objects for update
to authenticated
using (bucket_id = 'niagabio' and owner = auth.uid())
with check (bucket_id = 'niagabio' and owner = auth.uid());

create policy "niagabio_authenticated_delete_own"
on storage.objects for delete
to authenticated
using (bucket_id = 'niagabio' and owner = auth.uid());

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
