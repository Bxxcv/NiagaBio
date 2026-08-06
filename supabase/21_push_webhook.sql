-- =========================================================
-- NiagaBio 21 - Push Webhook Bridge (Supabase -> Vercel -> FCM)
-- Jalankan SEKALI setelah SQL 20 dan setelah PUSH_WEBHOOK_SECRET dibuat di Vercel.
--
-- SECURITY:
-- Secret disimpan di Supabase Vault, bukan ditanam di source function.
-- Ganti nilai PUSH_WEBHOOK_SECRET_DI_SINI dengan secret yang SAMA PERSIS
-- dengan Vercel Environment Variable: PUSH_WEBHOOK_SECRET
-- =========================================================

create extension if not exists pg_net;

-- Simpan secret di Vault. Jalankan blok ini sekali.
select vault.create_secret(
  '316d9f2c4b13ba8f2fd25e3d433dde23314ad2c9d01e4fff53a5504d2607ef8c',
  'niagabio_push_webhook_secret',
  'Secret untuk autentikasi webhook push NiagaBio ke Vercel /api/send-push'
);

create or replace function public.send_niagabio_push_webhook()
returns trigger
language plpgsql
security definer
set search_path = public, net, vault, pg_temp
as $$
declare
  webhook_secret text;
begin
  select decrypted_secret
  into webhook_secret
  from vault.decrypted_secrets
  where name = 'niagabio_push_webhook_secret'
  order by created_at desc
  limit 1;

  if webhook_secret is null or webhook_secret = '' then
    raise exception 'Supabase Vault secret niagabio_push_webhook_secret belum tersedia';
  end if;

  perform net.http_post(
    url := 'https://niaga-bio.vercel.app/api/send-push',
    body := jsonb_build_object(
      'type', 'INSERT',
      'table', 'notifications',
      'schema', 'public',
      'record', to_jsonb(NEW),
      'old_record', null
    ),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-push-webhook-secret', webhook_secret
    )
  );

  return NEW;
end;
$$;

revoke all on function public.send_niagabio_push_webhook() from public, anon, authenticated;

drop trigger if exists niagabio_push_notification_webhook on public.notifications;

create trigger niagabio_push_notification_webhook
after insert on public.notifications
for each row
when (NEW.type in ('order_new', 'order_status_updated', 'premium_approved', 'premium_rejected', 'premium_request_new'))
execute function public.send_niagabio_push_webhook();

select
  '21_push_webhook_setup_ok' as patch,
  to_regclass('public.notifications') is not null as notifications_exists,
  to_regclass('public.push_subscriptions') is not null as push_subscriptions_exists,
  exists (
    select 1
    from pg_trigger
    where tgname = 'niagabio_push_notification_webhook'
  ) as webhook_trigger_exists,
  exists (
    select 1
    from vault.decrypted_secrets
    where name = 'niagabio_push_webhook_secret'
  ) as vault_secret_exists;
