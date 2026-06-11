-- =========================================================
-- NiagaBio v31 - Password Reset Requests Aman
-- Jalankan setelah 07_in_app_notifications.sql / 08_security_reaudit_final.sql.
-- Flow aman: user membuat request, admin mengirim link reset resmi Supabase.
-- Admin tidak membuat dan tidak mengetahui password user.
-- =========================================================

create extension if not exists "pgcrypto";

create table if not exists public.password_reset_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  email text not null,
  display_name text default '',
  username text default '',
  user_note text default '',
  admin_note text default '',
  status text not null default 'pending',
  reset_sent_count integer not null default 0,
  reviewed_by uuid references auth.users(id) on delete set null,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.password_reset_requests add column if not exists user_id uuid references auth.users(id) on delete set null;
alter table public.password_reset_requests add column if not exists email text;
alter table public.password_reset_requests add column if not exists display_name text default '';
alter table public.password_reset_requests add column if not exists username text default '';
alter table public.password_reset_requests add column if not exists user_note text default '';
alter table public.password_reset_requests add column if not exists admin_note text default '';
alter table public.password_reset_requests add column if not exists status text default 'pending';
alter table public.password_reset_requests add column if not exists reset_sent_count integer default 0;
alter table public.password_reset_requests add column if not exists reviewed_by uuid references auth.users(id) on delete set null;
alter table public.password_reset_requests add column if not exists sent_at timestamptz;
alter table public.password_reset_requests add column if not exists created_at timestamptz default now();
alter table public.password_reset_requests add column if not exists updated_at timestamptz default now();

update public.password_reset_requests set email = lower(trim(email)) where email is not null;
update public.password_reset_requests set status = 'pending' where status is null or status not in ('pending','sent','done','cancelled');
update public.password_reset_requests set reset_sent_count = 0 where reset_sent_count is null or reset_sent_count < 0;

alter table public.password_reset_requests alter column email set not null;
alter table public.password_reset_requests alter column status set not null;
alter table public.password_reset_requests alter column reset_sent_count set not null;
alter table public.password_reset_requests alter column created_at set not null;
alter table public.password_reset_requests alter column updated_at set not null;

create index if not exists password_reset_requests_email_idx on public.password_reset_requests(lower(email));
create index if not exists password_reset_requests_status_created_idx on public.password_reset_requests(status, created_at desc);
create index if not exists password_reset_requests_user_id_idx on public.password_reset_requests(user_id);

alter table public.password_reset_requests drop constraint if exists password_reset_requests_status_check;
alter table public.password_reset_requests
  add constraint password_reset_requests_status_check check (status in ('pending','sent','done','cancelled'));

alter table public.password_reset_requests drop constraint if exists password_reset_requests_email_basic_check;
alter table public.password_reset_requests
  add constraint password_reset_requests_email_basic_check check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$');

alter table public.password_reset_requests drop constraint if exists password_reset_requests_count_non_negative;
alter table public.password_reset_requests
  add constraint password_reset_requests_count_non_negative check (reset_sent_count >= 0);

create or replace function public.touch_password_reset_requests_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists touch_password_reset_requests_updated_at on public.password_reset_requests;
create trigger touch_password_reset_requests_updated_at
before update on public.password_reset_requests
for each row execute function public.touch_password_reset_requests_updated_at();

alter table public.password_reset_requests enable row level security;

drop policy if exists "password_reset_requests_select_admin_or_own" on public.password_reset_requests;
drop policy if exists "password_reset_requests_update_admin_only" on public.password_reset_requests;
drop policy if exists "password_reset_requests_delete_admin_only" on public.password_reset_requests;
drop policy if exists "password_reset_requests_no_direct_insert" on public.password_reset_requests;

create policy "password_reset_requests_select_admin_or_own"
on public.password_reset_requests for select
to authenticated
using (public.is_admin() or user_id = auth.uid());

create policy "password_reset_requests_update_admin_only"
on public.password_reset_requests for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "password_reset_requests_delete_admin_only"
on public.password_reset_requests for delete
to authenticated
using (public.is_admin());

-- Insert langsung dari frontend ditutup. User membuat request lewat RPC request_password_reset().
revoke insert on public.password_reset_requests from anon, authenticated;
grant select, update, delete on public.password_reset_requests to authenticated;

create or replace function public.request_password_reset(
  requester_email text,
  requester_note text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  normalized_email text := lower(trim(coalesce(requester_email, '')));
  clean_note text := left(trim(coalesce(requester_note, '')), 300);
  matched_profile public.profiles;
  existing_request public.password_reset_requests;
  inserted_request public.password_reset_requests;
  admin_profile public.profiles;
begin
  if normalized_email = '' or normalized_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Email tidak valid' using errcode = '22023';
  end if;

  select p.* into matched_profile
  from public.profiles p
  where lower(coalesce(p.email, '')) = normalized_email
    and coalesce(p.status, 'active') <> 'deleted'
  order by p.created_at desc nulls last
  limit 1;

  -- Anti spam ringan: email yang sama tidak membuat banyak pending request dalam 10 menit.
  select r.* into existing_request
  from public.password_reset_requests r
  where lower(r.email) = normalized_email
    and r.status = 'pending'
    and r.created_at > now() - interval '10 minutes'
  order by r.created_at desc
  limit 1;

  if existing_request.id is not null then
    return jsonb_build_object('success', true, 'request_id', existing_request.id, 'deduped', true);
  end if;

  insert into public.password_reset_requests (
    user_id,
    email,
    display_name,
    username,
    user_note,
    status
  ) values (
    matched_profile.user_id,
    normalized_email,
    coalesce(matched_profile.display_name, ''),
    coalesce(matched_profile.username, ''),
    clean_note,
    'pending'
  ) returning * into inserted_request;

  if to_regprocedure('public.create_notification(uuid,text,text,text,text,jsonb,uuid)') is not null then
    for admin_profile in
      select * from public.profiles
      where role = 'admin'
        and coalesce(status, 'active') = 'active'
    loop
      perform public.create_notification(
        admin_profile.user_id,
        'password_reset_request_new',
        'Request lupa password',
        normalized_email || ' meminta bantuan reset password.',
        'admin#requests',
        jsonb_build_object(
          'request_id', inserted_request.id,
          'request_email', normalized_email,
          'request_user_id', inserted_request.user_id
        ),
        inserted_request.user_id
      );
    end loop;
  end if;

  return jsonb_build_object('success', true, 'request_id', inserted_request.id, 'deduped', false);
end;
$$;

revoke all on function public.request_password_reset(text, text) from public;
grant execute on function public.request_password_reset(text, text) to anon, authenticated;

create or replace function public.admin_update_password_reset_request(
  request_id uuid,
  new_status text default 'sent'
)
returns public.password_reset_requests
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  clean_status text := lower(trim(coalesce(new_status, 'sent')));
  updated_request public.password_reset_requests;
begin
  if not public.is_admin() then
    raise exception 'Only admin can update password reset requests' using errcode = '42501';
  end if;

  if clean_status not in ('pending','sent','done','cancelled') then
    raise exception 'Status request tidak valid' using errcode = '22023';
  end if;

  update public.password_reset_requests
  set status = clean_status,
      reviewed_by = auth.uid(),
      sent_at = case when clean_status = 'sent' then now() else sent_at end,
      reset_sent_count = case when clean_status = 'sent' then reset_sent_count + 1 else reset_sent_count end,
      updated_at = now()
  where id = request_id
  returning * into updated_request;

  if updated_request.id is null then
    raise exception 'Request lupa password tidak ditemukan' using errcode = '02000';
  end if;

  return updated_request;
end;
$$;

revoke all on function public.admin_update_password_reset_request(uuid, text) from public;
grant execute on function public.admin_update_password_reset_request(uuid, text) to authenticated;
