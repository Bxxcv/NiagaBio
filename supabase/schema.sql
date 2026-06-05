-- NiagaBio Final Supabase Schema
-- Jalankan di Supabase SQL Editor.
-- Aman untuk run ulang: policy lama akan di-drop dulu.
-- Setelah schema sukses, buat Storage bucket public bernama: niagabio

create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade unique not null,
  email text,
  username text unique not null,
  display_name text not null,
  bio text default '',
  avatar_url text default '',
  whatsapp_number text default '',
  plan text default 'free',
  role text default 'user',
  status text default 'active',
  plan_end_date timestamptz,
  theme_name text default 'service',
  created_at timestamptz default now()
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
  created_at timestamptz default now()
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
  created_at timestamptz default now()
);

create table if not exists public.social_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  platform text not null,
  url text not null,
  sort_order bigint default 0,
  created_at timestamptz default now()
);

create table if not exists public.gallery (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  image_url text not null,
  caption text default '',
  sort_order bigint default 0,
  created_at timestamptz default now()
);

create table if not exists public.checkout_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade unique not null,
  checkout_mode text default 'whatsapp',
  whatsapp_number text default '',
  qris_enabled boolean default false,
  qris_image_url text default '',
  qris_name text default '',
  payment_note text default '',
  created_at timestamptz default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid references auth.users(id) on delete cascade not null,
  buyer_name text not null,
  buyer_phone text not null,
  product_id uuid,
  product_name text not null,
  quantity integer default 1,
  total_price numeric default 0,
  payment_method text default 'whatsapp',
  payment_status text default 'pending',
  proof_image_url text default '',
  created_at timestamptz default now(),
  paid_at timestamptz
);

create table if not exists public.upgrade_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  email text,
  display_name text,
  username text,
  whatsapp_number text,
  amount numeric default 80000,
  status text default 'pending',
  proof_image_url text default '',
  note text default '',
  created_at timestamptz default now(),
  reviewed_at timestamptz
);

create table if not exists public.site_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz default now()
);

-- Update project lama jika kolom/constraint belum sesuai
alter table public.profiles add column if not exists plan_end_date timestamptz;
alter table public.profiles add column if not exists theme_name text default 'service';
alter table public.profiles add column if not exists status text default 'active';
alter table public.profiles add column if not exists role text default 'user';
alter table public.profiles add column if not exists plan text default 'free';

do $$ begin
  alter table public.profiles drop constraint if exists profiles_plan_check;
  alter table public.profiles add constraint profiles_plan_check check (plan in ('free','premium'));
  alter table public.profiles drop constraint if exists profiles_role_check;
  alter table public.profiles add constraint profiles_role_check check (role in ('user','admin'));
  alter table public.profiles drop constraint if exists profiles_status_check;
  alter table public.profiles add constraint profiles_status_check check (status in ('active','blocked','deleted'));
  alter table public.checkout_settings drop constraint if exists checkout_settings_checkout_mode_check;
  alter table public.checkout_settings add constraint checkout_settings_checkout_mode_check check (checkout_mode in ('whatsapp','qris_manual','qris_whatsapp'));
  alter table public.orders drop constraint if exists orders_payment_status_check;
  alter table public.orders add constraint orders_payment_status_check check (payment_status in ('pending','paid','cancelled'));
  alter table public.upgrade_requests drop constraint if exists upgrade_requests_status_check;
  alter table public.upgrade_requests add constraint upgrade_requests_status_check check (status in ('pending','approved','rejected'));
exception when duplicate_object then null;
end $$;

insert into public.site_settings(key,value)
values ('maintenance', '{"enabled":false,"message":"NiagaBio sedang maintenance sebentar. Coba lagi nanti ya."}'::jsonb)
on conflict (key) do nothing;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.profiles p where p.user_id = auth.uid() and p.role = 'admin' and p.status = 'active');
$$;

create or replace function public.protect_profile_system_fields()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() = old.user_id and not public.is_admin() then
    new.plan := old.plan;
    new.role := old.role;
    new.status := old.status;
    new.plan_end_date := old.plan_end_date;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_profile_system_fields_trigger on public.profiles;
create trigger protect_profile_system_fields_trigger
before update on public.profiles
for each row execute function public.protect_profile_system_fields();

alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.custom_links enable row level security;
alter table public.social_links enable row level security;
alter table public.gallery enable row level security;
alter table public.checkout_settings enable row level security;
alter table public.orders enable row level security;
alter table public.upgrade_requests enable row level security;
alter table public.site_settings enable row level security;

-- Drop policies so schema can be run repeatedly.
do $$ declare r record; begin
  for r in select schemaname, tablename, policyname from pg_policies where schemaname='public' and tablename in ('profiles','products','custom_links','social_links','gallery','checkout_settings','orders','upgrade_requests','site_settings') loop
    execute format('drop policy if exists %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

-- Profiles
create policy "Public profiles are readable" on public.profiles for select using (status = 'active' or user_id = auth.uid() or public.is_admin());
create policy "Users insert own profile" on public.profiles for insert with check (user_id = auth.uid());
create policy "Users update own profile" on public.profiles for update using (user_id = auth.uid() or public.is_admin()) with check (user_id = auth.uid() or public.is_admin());
create policy "Admins delete profiles" on public.profiles for delete using (public.is_admin());

-- Products
create policy "Products readable" on public.products for select using (is_active = true or user_id = auth.uid() or public.is_admin());
create policy "Users insert own products" on public.products for insert with check (user_id = auth.uid());
create policy "Users update own products" on public.products for update using (user_id = auth.uid() or public.is_admin()) with check (user_id = auth.uid() or public.is_admin());
create policy "Users delete own products" on public.products for delete using (user_id = auth.uid() or public.is_admin());

-- Custom links
create policy "Links readable" on public.custom_links for select using (is_active = true or user_id = auth.uid() or public.is_admin());
create policy "Users insert own links" on public.custom_links for insert with check (user_id = auth.uid());
create policy "Users update own links" on public.custom_links for update using (user_id = auth.uid() or public.is_admin()) with check (user_id = auth.uid() or public.is_admin());
create policy "Users delete own links" on public.custom_links for delete using (user_id = auth.uid() or public.is_admin());

-- Social links
create policy "Social readable" on public.social_links for select using (true);
create policy "Users insert own social" on public.social_links for insert with check (user_id = auth.uid());
create policy "Users update own social" on public.social_links for update using (user_id = auth.uid() or public.is_admin()) with check (user_id = auth.uid() or public.is_admin());
create policy "Users delete own social" on public.social_links for delete using (user_id = auth.uid() or public.is_admin());

-- Gallery
create policy "Gallery readable" on public.gallery for select using (true);
create policy "Users insert own gallery" on public.gallery for insert with check (user_id = auth.uid());
create policy "Users update own gallery" on public.gallery for update using (user_id = auth.uid() or public.is_admin()) with check (user_id = auth.uid() or public.is_admin());
create policy "Users delete own gallery" on public.gallery for delete using (user_id = auth.uid() or public.is_admin());

-- Checkout settings
create policy "Checkout readable" on public.checkout_settings for select using (true);
create policy "Users insert own checkout" on public.checkout_settings for insert with check (user_id = auth.uid());
create policy "Users update own checkout" on public.checkout_settings for update using (user_id = auth.uid() or public.is_admin()) with check (user_id = auth.uid() or public.is_admin());
create policy "Admins delete checkout" on public.checkout_settings for delete using (public.is_admin());

-- Orders: buyer can insert public order, seller/admin can read/update
create policy "Anyone can create order" on public.orders for insert with check (true);
create policy "Seller can read orders" on public.orders for select using (seller_id = auth.uid() or public.is_admin());
create policy "Seller can update orders" on public.orders for update using (seller_id = auth.uid() or public.is_admin()) with check (seller_id = auth.uid() or public.is_admin());
create policy "Admin can delete orders" on public.orders for delete using (public.is_admin());

-- Upgrade requests
create policy "Users create own upgrade request" on public.upgrade_requests for insert with check (user_id = auth.uid());
create policy "Users read own upgrade request" on public.upgrade_requests for select using (user_id = auth.uid() or public.is_admin());
create policy "Admins update upgrade request" on public.upgrade_requests for update using (public.is_admin()) with check (public.is_admin());
create policy "Admins delete upgrade request" on public.upgrade_requests for delete using (public.is_admin());

-- Site settings: public can read maintenance; admin can write.
create policy "Settings readable" on public.site_settings for select using (true);
create policy "Admins insert settings" on public.site_settings for insert with check (public.is_admin());
create policy "Admins update settings" on public.site_settings for update using (public.is_admin()) with check (public.is_admin());

-- Setelah daftar akun admin pertama kali, jalankan:
-- update public.profiles set role='admin', plan='premium', status='active', plan_end_date='2099-12-31' where email='unrageunrage@gmail.com';
