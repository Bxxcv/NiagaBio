-- NiagaBio Stage 18 - Rate Limit + Audit Log Hardening
-- Jalankan setelah SQL 16 dan deploy Production Guard.
-- Fokus: audit log admin, tracking perubahan sensitif, dan validasi ulang order fallback.

create extension if not exists "pgcrypto";

-- =========================================================
-- ADMIN AUDIT LOG
-- =========================================================

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  target_table text,
  target_id text,
  target_user_id uuid references auth.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_logs_created_at_idx on public.audit_logs(created_at desc);
create index if not exists audit_logs_actor_idx on public.audit_logs(actor_user_id, created_at desc);
create index if not exists audit_logs_target_user_idx on public.audit_logs(target_user_id, created_at desc);
create index if not exists audit_logs_action_idx on public.audit_logs(action, created_at desc);

alter table public.audit_logs enable row level security;

revoke all on public.audit_logs from public;
grant select on public.audit_logs to authenticated;

drop policy if exists audit_logs_select_admin_only on public.audit_logs;
create policy audit_logs_select_admin_only
on public.audit_logs
for select
to authenticated
using (public.is_admin());

create or replace function public.write_audit_log(
  action_input text,
  target_table_input text default null,
  target_id_input text default null,
  target_user_id_input uuid default null,
  metadata_input jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  inserted_id uuid;
begin
  -- Audit log hanya untuk admin yang sedang login.
  -- Non-admin tidak boleh menulis log palsu, tapi function tidak raise agar trigger tidak merusak flow lama.
  if auth.uid() is null or not public.is_admin() then
    return null;
  end if;

  insert into public.audit_logs (
    actor_user_id,
    action,
    target_table,
    target_id,
    target_user_id,
    metadata
  ) values (
    auth.uid(),
    left(trim(coalesce(action_input, 'unknown')), 120),
    nullif(left(trim(coalesce(target_table_input, '')), 80), ''),
    nullif(left(trim(coalesce(target_id_input, '')), 120), ''),
    target_user_id_input,
    coalesce(metadata_input, '{}'::jsonb)
  )
  returning id into inserted_id;

  return inserted_id;
end;
$$;

revoke all on function public.write_audit_log(text, text, text, uuid, jsonb) from public;
grant execute on function public.write_audit_log(text, text, text, uuid, jsonb) to authenticated;

-- =========================================================
-- TRIGGER AUDIT: PROFILE SYSTEM FIELDS
-- =========================================================

create or replace function public.audit_profile_system_fields_change()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
begin
  if tg_op = 'UPDATE'
     and (
       old.role is distinct from new.role
       or old.plan is distinct from new.plan
       or old.status is distinct from new.status
       or old.plan_end_date is distinct from new.plan_end_date
     ) then
    perform public.write_audit_log(
      'profile_system_fields_update',
      'profiles',
      new.user_id::text,
      new.user_id,
      jsonb_build_object(
        'old', jsonb_build_object(
          'role', old.role,
          'plan', old.plan,
          'status', old.status,
          'plan_end_date', old.plan_end_date
        ),
        'new', jsonb_build_object(
          'role', new.role,
          'plan', new.plan,
          'status', new.status,
          'plan_end_date', new.plan_end_date
        )
      )
    );
  end if;

  return new;
end;
$$;

drop trigger if exists audit_profile_system_fields_change_trigger on public.profiles;
create trigger audit_profile_system_fields_change_trigger
after update on public.profiles
for each row
execute function public.audit_profile_system_fields_change();

-- =========================================================
-- TRIGGER AUDIT: PREMIUM REQUESTS
-- =========================================================

create or replace function public.audit_premium_request_change()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  target_user uuid;
  target_request_id text;
begin
  if tg_op = 'DELETE' then
    target_user := old.user_id;
    target_request_id := old.id::text;
  else
    target_user := new.user_id;
    target_request_id := new.id::text;
  end if;

  if tg_op = 'UPDATE'
     and (
       old.status is distinct from new.status
       or old.reviewed_by is distinct from new.reviewed_by
       or old.reviewed_at is distinct from new.reviewed_at
     ) then
    perform public.write_audit_log(
      'premium_request_update',
      'premium_requests',
      target_request_id,
      target_user,
      jsonb_build_object(
        'old_status', old.status,
        'new_status', new.status,
        'request_user_id', target_user
      )
    );
    return new;
  end if;

  if tg_op = 'DELETE' then
    perform public.write_audit_log(
      'premium_request_delete',
      'premium_requests',
      target_request_id,
      target_user,
      jsonb_build_object(
        'old_status', old.status,
        'request_user_id', target_user
      )
    );
    return old;
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists audit_premium_request_change_trigger on public.premium_requests;
create trigger audit_premium_request_change_trigger
after update or delete on public.premium_requests
for each row
execute function public.audit_premium_request_change();

-- =========================================================
-- TRIGGER AUDIT: PASSWORD RESET REQUESTS
-- =========================================================

create or replace function public.audit_password_reset_request_change()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  target_user uuid;
  target_request_id text;
begin
  if tg_op = 'DELETE' then
    target_user := old.user_id;
    target_request_id := old.id::text;
  else
    target_user := new.user_id;
    target_request_id := new.id::text;
  end if;

  if tg_op = 'UPDATE'
     and (
       old.status is distinct from new.status
       or old.reviewed_by is distinct from new.reviewed_by
       or old.reset_sent_count is distinct from new.reset_sent_count
     ) then
    perform public.write_audit_log(
      'password_reset_request_update',
      'password_reset_requests',
      target_request_id,
      target_user,
      jsonb_build_object(
        'old_status', old.status,
        'new_status', new.status,
        'reset_sent_count', new.reset_sent_count
      )
    );
    return new;
  end if;

  if tg_op = 'DELETE' then
    perform public.write_audit_log(
      'password_reset_request_delete',
      'password_reset_requests',
      target_request_id,
      target_user,
      jsonb_build_object('old_status', old.status)
    );
    return old;
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists audit_password_reset_request_change_trigger on public.password_reset_requests;
create trigger audit_password_reset_request_change_trigger
after update or delete on public.password_reset_requests
for each row
execute function public.audit_password_reset_request_change();

-- =========================================================
-- TRIGGER AUDIT: APP SETTINGS
-- =========================================================

create or replace function public.audit_app_settings_change()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    perform public.write_audit_log(
      'app_settings_insert',
      'app_settings',
      new.id,
      new.updated_by,
      jsonb_build_object('new', to_jsonb(new))
    );
    return new;
  end if;

  if tg_op = 'UPDATE' then
    perform public.write_audit_log(
      'app_settings_update',
      'app_settings',
      new.id,
      new.updated_by,
      jsonb_build_object(
        'old', to_jsonb(old),
        'new', to_jsonb(new)
      )
    );
    return new;
  end if;

  return new;
end;
$$;

drop trigger if exists audit_app_settings_change_trigger on public.app_settings;
create trigger audit_app_settings_change_trigger
after insert or update on public.app_settings
for each row
execute function public.audit_app_settings_change();

-- =========================================================
-- FINAL READ-ONLY CHECK RESULT
-- =========================================================

select
  '18_rate_limit_audit_log_hardening_ok' as patch,
  exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'audit_logs'
  ) as audit_logs_table_exists,
  (select count(*) from pg_policies where schemaname = 'public' and tablename = 'audit_logs') as audit_logs_policy_count,
  exists (
    select 1
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'profiles'
      and t.tgname = 'audit_profile_system_fields_change_trigger'
      and t.tgenabled = 'O'
  ) as profile_audit_trigger_enabled;
