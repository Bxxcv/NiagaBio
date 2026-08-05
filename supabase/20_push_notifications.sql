-- =========================================================
-- NiagaBio 20 - Mobile Push Notifications + Realtime
-- Jalankan setelah SQL 07 dan patch security terakhir.
--
-- Arsitektur:
-- 1) notifications = sumber event utama.
-- 2) Supabase Realtime = update instan saat seller membuka dashboard.
-- 3) push_subscriptions = token FCM per perangkat seller.
-- 4) Vercel /api/send-push = pengirim FCM server-side.
-- =========================================================

create extension if not exists pgcrypto;

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  device_token text not null unique,
  device_name text not null default '',
  user_agent text not null default '',
  is_active boolean not null default true,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists push_subscriptions_user_active_idx
  on public.push_subscriptions(user_id, is_active, updated_at desc);

create index if not exists push_subscriptions_active_idx
  on public.push_subscriptions(is_active, updated_at desc);

alter table public.push_subscriptions enable row level security;

revoke all on public.push_subscriptions from public, anon, authenticated;

drop policy if exists push_subscriptions_no_direct_client_access on public.push_subscriptions;

create or replace function public.register_push_subscription(
  device_token_input text,
  device_name_input text default '',
  user_agent_input text default ''
)
returns uuid
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  current_user_id uuid := auth.uid();
  result_id uuid;
  clean_token text := trim(coalesce(device_token_input, ''));
  clean_device text := left(trim(coalesce(device_name_input, '')), 80);
  clean_agent text := left(trim(coalesce(user_agent_input, '')), 400);
begin
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if length(clean_token) < 20 or length(clean_token) > 4096 then
    raise exception 'Invalid push token' using errcode = '22023';
  end if;

  insert into public.push_subscriptions (
    user_id,
    device_token,
    device_name,
    user_agent,
    is_active,
    last_seen_at,
    updated_at
  ) values (
    current_user_id,
    clean_token,
    clean_device,
    clean_agent,
    true,
    now(),
    now()
  )
  on conflict (device_token) do update
  set user_id = excluded.user_id,
      device_name = excluded.device_name,
      user_agent = excluded.user_agent,
      is_active = true,
      last_seen_at = now(),
      updated_at = now()
  returning id into result_id;

  return result_id;
end;
$$;

revoke all on function public.register_push_subscription(text, text, text) from public;
grant execute on function public.register_push_subscription(text, text, text) to authenticated;

create or replace function public.unregister_push_subscription(
  device_token_input text
)
returns boolean
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  update public.push_subscriptions
  set is_active = false,
      updated_at = now()
  where user_id = current_user_id
    and device_token = trim(coalesce(device_token_input, ''));

  return true;
end;
$$;

revoke all on function public.unregister_push_subscription(text) from public;
grant execute on function public.unregister_push_subscription(text) to authenticated;

-- Keep the notifications table in Realtime publication.
do $$
begin
  if to_regclass('public.notifications') is not null
     and not exists (
       select 1
       from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'notifications'
     ) then
    execute 'alter publication supabase_realtime add table public.notifications';
  end if;
exception
  when undefined_object then
    raise notice 'Publication supabase_realtime belum tersedia. Aktifkan Realtime untuk public.notifications di Dashboard Supabase.';
end;
$$;

select
  '20_push_notifications_setup_ok' as patch,
  to_regclass('public.push_subscriptions') is not null as push_subscriptions_exists,
  exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'register_push_subscription'
  ) as register_rpc_exists,
  exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'notifications'
  ) as notifications_in_realtime;
