-- NiagaBio Migration 29 — Repair payment sandbox configuration
-- Safe to run repeatedly.
-- Run after the payment gateway migrations (23+). This migration only repairs
-- the app_settings configuration needed by Admin Master and Vercel payment API.

begin;

-- Ensure the sandbox flag exists even if migration 23 was forgotten.
alter table public.app_settings
  add column if not exists payment_sandbox boolean not null default true;

-- Ensure the global row exists. Do not overwrite an existing value.
insert into public.app_settings (id, payment_sandbox)
values ('global', false)
on conflict (id) do nothing;

-- The Admin Master toggle was just disabled by the operator.
-- Set the current global state to LIVE now; it can be switched back to Sandbox
-- from Admin Master at any time.
update public.app_settings
set payment_sandbox = false,
    updated_at = now()
where id = 'global';

commit;

-- Verification:
-- select id, payment_gateway_enabled, payment_provider, payment_sandbox, updated_at
-- from public.app_settings
-- where id = 'global';
