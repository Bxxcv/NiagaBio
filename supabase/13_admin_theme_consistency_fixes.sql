
-- =========================================================
-- NiagaBio 13 - Admin + Theme consistency fixes
-- Jalankan setelah 12_security_final_rls_storage_audit.sql
-- =========================================================

-- Simpan nominal pada saat request Premium disetujui agar laporan tidak berubah
-- hanya karena harga Premium sekarang berubah.
alter table public.premium_requests
  add column if not exists approved_amount numeric(14,2);

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
  current_price numeric(14,2);
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

  select coalesce(premium_price, 0) into current_price
  from public.app_settings
  limit 1;

  update public.premium_requests
  set status = action_status,
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      approved_amount = case
        when action_status = 'approved' then greatest(current_price, 0)
        else approved_amount
      end,
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

-- Public resolver selalu mengambil theme_name terbaru dari profiles dan tetap
-- membatasi theme non-Premium untuk akun Free.
create or replace function public.get_public_profile(lookup_username text)
returns table (
  user_id uuid,
  username text,
  display_name text,
  bio text,
  avatar_url text,
  whatsapp_number text,
  theme_name text,
  is_premium boolean
)
language sql
stable
security definer
set search_path = public, auth, pg_temp
as $$
  select
    p.user_id,
    p.username,
    p.display_name,
    p.bio,
    p.avatar_url,
    p.whatsapp_number,
    case
      when public.effective_plan(p.user_id) = 'premium'
        then coalesce(nullif(trim(p.theme_name), ''), 'service')
      when coalesce(trim(p.theme_name), 'service') in ('service', 'minimal')
        then trim(p.theme_name)
      else 'service'
    end as theme_name,
    (public.effective_plan(p.user_id) = 'premium') as is_premium
  from public.profiles p
  where p.username = lower(regexp_replace(trim(coalesce(lookup_username, '')), '[^a-z0-9-]+', '-', 'g'))
    and p.status = 'active'
  limit 1;
$$;

revoke all on function public.get_public_profile(text) from public;
grant execute on function public.get_public_profile(text) to anon, authenticated;
