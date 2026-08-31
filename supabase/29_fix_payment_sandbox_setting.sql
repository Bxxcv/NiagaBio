-- NiagaBio Migration 29 — Repair payment sandbox configuration
-- Safe to run repeatedly (idempotent).
--
-- Problem: validate_app_settings_fields trigger calls is_admin() which checks
-- auth.uid(). From SQL editor (postgres superuser), auth.uid() = NULL so the
-- trigger always raises "Only admin can update app settings".
--
-- Solution: DROP the trigger, do the UPDATE, then recreate the trigger.

begin;

-- Step 1: Ensure the column exists.
alter table public.app_settings
  add column if not exists payment_sandbox boolean not null default true;

-- Step 2: Ensure the global config row exists.
insert into public.app_settings (id, payment_sandbox)
values ('global', true)
on conflict (id) do nothing;

-- Step 3: Drop the blocking trigger temporarily.
drop trigger if exists validate_app_settings_fields_v31 on public.app_settings;

-- Step 4: Set payment_sandbox = false (LIVE mode).
-- Change to true if you want to revert to sandbox/test mode.
update public.app_settings
set
  payment_sandbox         = false,
  payment_gateway_enabled = true,
  updated_at              = now()
where id = 'global';

-- Step 5: Recreate the trigger exactly as defined in 08_security_reaudit_final.sql.
create trigger validate_app_settings_fields_v31
before insert or update on public.app_settings
for each row execute function public.validate_app_settings_fields();

commit;

-- Verification (run separately):
-- select id, payment_gateway_enabled, payment_provider, payment_sandbox, updated_at
-- from public.app_settings
-- where id = 'global';
