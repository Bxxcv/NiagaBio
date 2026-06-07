-- NiagaBio v12 hotfix: theme setter RPC
-- Jalankan file ini di Supabase SQL Editor kalau akun premium sudah terbaca
-- tapi theme tetap tidak berubah.

create or replace function public.set_profile_theme(new_theme text)
returns public.profiles
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  theme_id text := lower(trim(coalesce(new_theme, 'service')));
  current_profile public.profiles;
  premium_themes text[] := array['fashion','gadget','food','beauty','dark','luxury','neon','portfolio'];
  free_themes text[] := array['service','minimal'];
begin
  if auth.uid() is null then
    raise exception 'Login diperlukan untuk mengganti tema.' using errcode = '42501';
  end if;

  if not (theme_id = any(free_themes) or theme_id = any(premium_themes)) then
    raise exception 'Tema tidak valid.' using errcode = '22023';
  end if;

  select * into current_profile
  from public.profiles
  where user_id = auth.uid()
  limit 1;

  if current_profile.user_id is null then
    raise exception 'Profile tidak ditemukan.' using errcode = '02000';
  end if;

  if current_profile.status <> 'active' then
    raise exception 'Akun tidak aktif.' using errcode = '42501';
  end if;

  if theme_id = any(premium_themes)
     and current_profile.role <> 'admin'
     and public.effective_plan(auth.uid()) <> 'premium' then
    raise exception 'Tema ini khusus Premium.' using errcode = '42501';
  end if;

  update public.profiles
  set theme_name = theme_id,
      updated_at = now()
  where user_id = auth.uid()
  returning * into current_profile;

  return current_profile;
end;
$$;

revoke all on function public.set_profile_theme(text) from public;
grant execute on function public.set_profile_theme(text) to authenticated;

-- Cek cepat: pastikan profile demo benar-benar premium dan aktif.
select email, username, role, plan, status, plan_end_date, theme_name
from public.profiles
order by updated_at desc nulls last
limit 10;
