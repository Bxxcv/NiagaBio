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
