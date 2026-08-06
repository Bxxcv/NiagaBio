-- =========================================================
-- NiagaBio FINAL Push Notifications Repair
--
-- Satu kali setup untuk production:
-- 1) In-app notifications + order notification trigger
-- 2) Supabase Realtime untuk dashboard aktif
-- 3) FCM device token table
-- 4) Supabase pg_net -> Vercel /api/send-push
-- 5) Idempotency log agar push tidak dikirim berulang
--
-- TIDAK MEMERLUKAN:
-- - PUSH_WEBHOOK_SECRET
-- - Supabase Vault
-- - konfigurasi Webhook Dashboard manual
--
-- Vercel tetap membutuhkan:
-- SUPABASE_URL
-- SUPABASE_SERVICE_ROLE_KEY
-- FCM_PROJECT_ID
-- FCM_CLIENT_EMAIL
-- FCM_PRIVATE_KEY
-- =========================================================

create extension if not exists pgcrypto;
create extension if not exists pg_net;

-- =========================================================
-- 1. IN-APP NOTIFICATIONS (idempotent)
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

create index if not exists notifications_user_created_idx
  on public.notifications(user_id, created_at desc);

create index if not exists notifications_user_unread_idx
  on public.notifications(user_id, is_read, created_at desc);

create index if not exists notifications_type_idx
  on public.notifications(type);

alter table public.notifications enable row level security;

-- =========================================================
-- 2. PUSH DEVICE TOKENS
-- =========================================================
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

-- =========================================================
-- 3. PUSH DELIVERY LOG / IDEMPOTENCY
-- =========================================================
create table if not exists public.push_delivery_log (
  notification_id uuid primary key references public.notifications(id) on delete cascade,
  status text not null default 'sending'
    check (status in ('sending', 'sent', 'failed', 'no_device')),
  delivered_to integer not null default 0 check (delivered_to >= 0),
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists push_delivery_log_status_idx
  on public.push_delivery_log(status, updated_at desc);

alter table public.push_delivery_log enable row level security;
revoke all on public.push_delivery_log from public, anon, authenticated;

-- =========================================================
-- 4. RPC REGISTER / UNREGISTER DEVICE
-- =========================================================
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

-- =========================================================
-- 5. NOTIFICATION CREATOR
-- =========================================================
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

-- =========================================================
-- 6. ORDER -> NOTIFICATION TRIGGER
-- =========================================================
create or replace function public.notify_order_insert()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.create_notification(
    new.seller_id,
    'order_new',
    'Pesanan baru',
    coalesce(new.buyer_name, 'Pembeli')
      || ' memesan '
      || coalesce(new.product_name, 'produk')
      || ' senilai '
      || to_char(coalesce(new.total_price, 0), 'FM999G999G999G999'),
    'orders',
    jsonb_build_object(
      'order_id', new.id,
      'product_id', new.product_id,
      'total_price', new.total_price
    ),
    null
  );

  return new;
end;
$$;

drop trigger if exists notify_order_insert_trigger on public.orders;
create trigger notify_order_insert_trigger
after insert on public.orders
for each row execute function public.notify_order_insert();

-- =========================================================
-- 7. ORDER STATUS -> NOTIFICATION TRIGGER
-- =========================================================
create or replace function public.notify_order_status_update()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
begin
  if old.payment_status is distinct from new.payment_status
     and auth.uid() is not null
     and auth.uid() <> new.seller_id then
    perform public.create_notification(
      new.seller_id,
      'order_status_updated',
      'Status pesanan diperbarui',
      'Pesanan '
        || coalesce(new.product_name, 'produk')
        || ' berubah menjadi '
        || coalesce(new.payment_status, 'pending')
        || '.',
      'orders',
      jsonb_build_object(
        'order_id', new.id,
        'payment_status', new.payment_status
      ),
      auth.uid()
    );
  end if;

  return new;
end;
$$;

drop trigger if exists notify_order_status_update_trigger on public.orders;
create trigger notify_order_status_update_trigger
after update of payment_status on public.orders
for each row execute function public.notify_order_status_update();

-- =========================================================
-- 8. REALTIME PUBLICATION
-- =========================================================
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

-- =========================================================
-- 9. REPLACE OLD SECRET-BASED WEBHOOK WITH SIMPLE ID-BASED WEBHOOK
-- =========================================================
-- Hapus trigger/function lama jika pernah dijalankan dari SQL 21.
drop trigger if exists niagabio_push_notification_webhook on public.notifications;
drop function if exists public.send_niagabio_push_webhook();

create or replace function public.send_niagabio_push_webhook()
returns trigger
language plpgsql
security definer
set search_path = public, net, pg_temp
as $$
begin
  perform net.http_post(
    url := 'https://niaga-bio.vercel.app/api/send-push',
    body := jsonb_build_object(
      'notification_id', new.id
    ),
    headers := jsonb_build_object(
      'Content-Type', 'application/json'
    )
  );

  return new;
end;
$$;

revoke all on function public.send_niagabio_push_webhook() from public, anon, authenticated;

drop trigger if exists niagabio_push_notification_webhook on public.notifications;
create trigger niagabio_push_notification_webhook
after insert on public.notifications
for each row
when (
  new.type in (
    'order_new',
    'order_status_updated',
    'premium_approved',
    'premium_rejected',
    'premium_request_new'
  )
)
execute function public.send_niagabio_push_webhook();

-- =========================================================
-- 10. FINAL VERIFICATION
-- =========================================================
select
  '22_push_notifications_final_ok' as patch,
  to_regclass('public.notifications') is not null as notifications_exists,
  to_regclass('public.push_subscriptions') is not null as push_subscriptions_exists,
  to_regclass('public.push_delivery_log') is not null as push_delivery_log_exists,
  exists (
    select 1 from pg_trigger
    where tgname = 'notify_order_insert_trigger'
  ) as order_notification_trigger_exists,
  exists (
    select 1 from pg_trigger
    where tgname = 'niagabio_push_notification_webhook'
  ) as push_webhook_trigger_exists,
  exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'notifications'
  ) as notifications_in_realtime;
