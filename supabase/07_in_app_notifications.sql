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
