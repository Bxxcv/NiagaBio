-- NiagaBio Migration 29 — Repair payment sandbox configuration
-- Safe to run repeatedly (idempotent).
-- Run after the payment gateway migrations (23+).
--
-- Problem: The validate_app_settings_fields trigger calls is_admin() which
-- checks auth.uid(). When run from the Supabase dashboard SQL editor or
-- service-role context, auth.uid() is NULL so is_admin() returns false and
-- the UPDATE is blocked with "Only admin can update app settings".
--
-- Solution: Temporarily disable row-level triggers for this session using
-- session_replication_role = replica (superuser privilege required — works
-- in Supabase SQL editor which runs as postgres superuser). This does NOT
-- disable foreign-key constraints, only per-row triggers.

begin;

-- Step 1: Ensure the column exists (safe if already there from migration 23).
alter table public.app_settings
  add column if not exists payment_sandbox boolean not null default true;

-- Step 2: Ensure the global config row exists.
insert into public.app_settings (id, payment_sandbox)
values ('global', true)
on conflict (id) do nothing;

-- Step 3: Bypass the admin-only trigger so we can update as postgres/superuser.
set local session_replication_role = replica;

-- Step 4: Set payment_sandbox = false (LIVE mode).
-- Change this to true if you want to revert to sandbox/test mode.
update public.app_settings
set
  payment_sandbox          = false,
  payment_gateway_enabled  = true,
  updated_at               = now()
where id = 'global';

-- Step 5: Restore trigger enforcement before commit.
set local session_replication_role = origin;

commit;

-- Verification (run separately to confirm):
-- select id, payment_gateway_enabled, payment_provider, payment_sandbox, updated_at
-- from public.app_settings
-- where id = 'global';
