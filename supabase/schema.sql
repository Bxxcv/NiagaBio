-- NiagaBio Supabase Schema MVP
-- Jalankan di Supabase SQL Editor.
-- Setelah itu buat bucket public bernama: niagabio

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
  plan text default 'free' check (plan in ('free','premium')),
  role text default 'user' check (role in ('user','admin')),
  status text default 'active' check (status in ('active','blocked')),
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
  checkout_mode text default 'whatsapp' check (checkout_mode in ('whatsapp','qris_manual','qris_whatsapp')),
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
  payment_status text default 'pending' check (payment_status in ('pending','paid','cancelled')),
  proof_image_url text default '',
  created_at timestamptz default now(),
  paid_at timestamptz
);

alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.custom_links enable row level security;
alter table public.social_links enable row level security;
alter table public.gallery enable row level security;
alter table public.checkout_settings enable row level security;
alter table public.orders enable row level security;


create or replace function public.protect_profile_system_fields()
returns trigger language plpgsql security definer as $$
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

create or replace function public.is_admin()
returns boolean language sql stable as $$
  select exists(select 1 from public.profiles p where p.user_id = auth.uid() and p.role = 'admin');
$$;

-- Profiles
create policy "Public profiles are readable" on public.profiles for select using (status = 'active' or user_id = auth.uid() or public.is_admin());
create policy "Users insert own profile" on public.profiles for insert with check (user_id = auth.uid());
create policy "Users update own profile" on public.profiles for update using (user_id = auth.uid() or public.is_admin()) with check (user_id = auth.uid() or public.is_admin());

-- Products
create policy "Products readable" on public.products for select using (is_active = true or user_id = auth.uid() or public.is_admin());
create policy "Users insert own products" on public.products for insert with check (user_id = auth.uid());
create policy "Users update own products" on public.products for update using (user_id = auth.uid() or public.is_admin());
create policy "Users delete own products" on public.products for delete using (user_id = auth.uid() or public.is_admin());

-- Custom links
create policy "Links readable" on public.custom_links for select using (is_active = true or user_id = auth.uid() or public.is_admin());
create policy "Users insert own links" on public.custom_links for insert with check (user_id = auth.uid());
create policy "Users update own links" on public.custom_links for update using (user_id = auth.uid() or public.is_admin());
create policy "Users delete own links" on public.custom_links for delete using (user_id = auth.uid() or public.is_admin());

-- Social links
create policy "Social readable" on public.social_links for select using (true);
create policy "Users insert own social" on public.social_links for insert with check (user_id = auth.uid());
create policy "Users update own social" on public.social_links for update using (user_id = auth.uid() or public.is_admin());
create policy "Users delete own social" on public.social_links for delete using (user_id = auth.uid() or public.is_admin());

-- Gallery
create policy "Gallery readable" on public.gallery for select using (true);
create policy "Users insert own gallery" on public.gallery for insert with check (user_id = auth.uid());
create policy "Users update own gallery" on public.gallery for update using (user_id = auth.uid() or public.is_admin());
create policy "Users delete own gallery" on public.gallery for delete using (user_id = auth.uid() or public.is_admin());

-- Checkout settings
create policy "Checkout readable" on public.checkout_settings for select using (true);
create policy "Users insert own checkout" on public.checkout_settings for insert with check (user_id = auth.uid());
create policy "Users update own checkout" on public.checkout_settings for update using (user_id = auth.uid() or public.is_admin());

-- Orders: buyer can insert public order, seller/admin can read/update
create policy "Anyone can create order" on public.orders for insert with check (true);
create policy "Seller can read orders" on public.orders for select using (seller_id = auth.uid() or public.is_admin());
create policy "Seller can update orders" on public.orders for update using (seller_id = auth.uid() or public.is_admin());

-- Optional: jadikan email kamu admin setelah user register pertama kali.
-- update public.profiles set role='admin', plan='premium' where email='unrageunrage@gmail.com';