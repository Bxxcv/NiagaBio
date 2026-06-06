-- NiagaBio Bootstrap Admin Pertama
-- Jalankan SETELAH kamu membuat user admin di Supabase Auth atau daftar dari website.
-- Ganti email di bawah kalau email admin kamu berbeda.

begin;

alter table public.profiles disable trigger protect_profile_system_fields_trigger;

insert into public.profiles (
  user_id,
  email,
  username,
  display_name,
  role,
  plan,
  status,
  plan_end_date,
  bio,
  avatar_url,
  whatsapp_number,
  theme_name
)
select
  u.id,
  u.email,
  'admin-' || substr(u.id::text, 1, 8),
  'Admin NiagaBio',
  'admin',
  'premium',
  'active',
  '2099-12-31T00:00:00Z'::timestamptz,
  '',
  'assets/img/logo.jpg',
  '',
  'service'
from auth.users u
where lower(u.email) = lower('unrageunrage@gmail.com')
on conflict (user_id) do update
set
  email = excluded.email,
  role = 'admin',
  plan = 'premium',
  status = 'active',
  plan_end_date = '2099-12-31T00:00:00Z'::timestamptz,
  updated_at = now();

alter table public.profiles enable trigger protect_profile_system_fields_trigger;

commit;

select
  u.email,
  p.user_id,
  p.role,
  p.plan,
  p.status,
  p.plan_end_date
from auth.users u
left join public.profiles p on p.user_id = u.id
where lower(u.email) = lower('unrageunrage@gmail.com');
