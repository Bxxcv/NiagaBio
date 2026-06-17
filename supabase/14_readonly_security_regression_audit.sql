-- =========================================================
-- NiagaBio 14 - READ ONLY Security Regression Audit
-- Aman dijalankan di Supabase SQL Editor karena hanya SELECT.
-- TIDAK membuat/mengubah/drop table, policy, function, trigger, atau data.
--
-- Tujuan:
-- 1) Cek RLS yang benar-benar aktif di database Supabase.
-- 2) Cek policy yang terlalu longgar.
-- 3) Cek function SECURITY DEFINER dan grant execute.
-- 4) Cek trigger proteksi field penting.
-- 5) Cek storage bucket/policy upload gambar.
-- 6) Cek patch penting: get_public_profile dan create_public_order.
-- =========================================================

-- 01. Tabel penting: RLS harus enabled.
select
  '01_rls_tables' as audit_section,
  n.nspname as schema_name,
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as force_rls,
  case
    when c.relrowsecurity then 'OK: RLS enabled'
    else 'RISK: RLS disabled'
  end as verdict
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
  and c.relname in (
    'profiles', 'products', 'custom_links', 'social_links', 'gallery',
    'checkout_settings', 'orders', 'app_settings', 'premium_requests',
    'password_reset_requests', 'notifications'
  )
order by c.relname;

-- 02. Semua policy public schema.
select
  '02_public_policies' as audit_section,
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual as using_expression,
  with_check as with_check_expression
from pg_policies
where schemaname = 'public'
  and tablename in (
    'profiles', 'products', 'custom_links', 'social_links', 'gallery',
    'checkout_settings', 'orders', 'app_settings', 'premium_requests',
    'password_reset_requests', 'notifications'
  )
order by tablename, cmd, policyname;

-- 03. Policy yang perlu dicek manual karena bisa terlalu longgar.
select
  '03_policy_risk_flags' as audit_section,
  schemaname,
  tablename,
  policyname,
  roles,
  cmd,
  qual as using_expression,
  with_check as with_check_expression,
  case
    when 'anon' = any(roles) and tablename = 'profiles' and cmd = 'SELECT' then 'CHECK: anon select profiles sebaiknya tidak ada; public pakai RPC get_public_profile'
    when 'anon' = any(roles) and tablename = 'orders' and cmd = 'INSERT' then 'CHECK: anon insert orders boleh hanya jika pending + proof + product/seller valid'
    when coalesce(qual, '') ~* '^\s*true\s*$' or coalesce(with_check, '') ~* '^\s*true\s*$' then 'RISK: using/with_check true'
    when 'anon' = any(roles) and cmd in ('UPDATE','DELETE') then 'RISK: anon tidak boleh update/delete'
    when tablename = 'app_settings' and cmd in ('INSERT','UPDATE','DELETE') and 'anon' = any(roles) then 'RISK: app_settings write untuk anon'
    else 'REVIEW'
  end as verdict
from pg_policies
where schemaname = 'public'
  and (
    coalesce(qual, '') ~* '^\s*true\s*$'
    or coalesce(with_check, '') ~* '^\s*true\s*$'
    or 'anon' = any(roles)
    or tablename in ('profiles','orders','app_settings')
  )
order by tablename, cmd, policyname;

-- 04. Grants tabel untuk anon/authenticated. RLS tetap kontrol row, tapi privilege terlalu luas harus dicek.
select
  '04_table_grants' as audit_section,
  table_schema,
  table_name,
  grantee,
  privilege_type,
  is_grantable
from information_schema.role_table_grants
where table_schema in ('public', 'storage')
  and grantee in ('anon', 'authenticated')
  and table_name in (
    'profiles', 'products', 'custom_links', 'social_links', 'gallery',
    'checkout_settings', 'orders', 'app_settings', 'premium_requests',
    'password_reset_requests', 'notifications', 'objects', 'buckets'
  )
order by table_schema, table_name, grantee, privilege_type;

-- 05. Function SECURITY DEFINER penting + search_path.
select
  '05_security_definer_functions' as audit_section,
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as args,
  case when p.prosecdef then 'SECURITY DEFINER' else 'SECURITY INVOKER' end as security_mode,
  p.provolatile as volatility,
  coalesce(array_to_string(p.proconfig, ', '), '') as function_config,
  case
    when p.prosecdef and coalesce(array_to_string(p.proconfig, ', '), '') !~ 'search_path=' then 'RISK: security definer tanpa explicit search_path'
    else 'OK/REVIEW'
  end as verdict
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'is_admin', 'is_active_user', 'effective_plan',
    'get_public_profile', 'create_public_order',
    'admin_update_profile_system_fields', 'admin_review_premium_request',
    'admin_soft_delete_user', 'reset_my_sales_recap', 'set_profile_theme',
    'request_password_reset', 'admin_update_password_reset_request',
    'is_safe_public_image_url', 'is_safe_external_url'
  )
order by p.proname, args;

-- 06. Grant execute function untuk anon/authenticated.
select
  '06_function_execute_grants' as audit_section,
  routine_schema,
  routine_name,
  grantee,
  privilege_type
from information_schema.routine_privileges
where routine_schema = 'public'
  and grantee in ('anon', 'authenticated', 'public')
  and routine_name in (
    'is_admin', 'is_active_user', 'effective_plan',
    'get_public_profile', 'create_public_order',
    'admin_update_profile_system_fields', 'admin_review_premium_request',
    'admin_soft_delete_user', 'reset_my_sales_recap', 'set_profile_theme',
    'request_password_reset', 'admin_update_password_reset_request'
  )
order by routine_name, grantee;

-- 07. Trigger proteksi field penting.
select
  '07_triggers' as audit_section,
  event_object_schema as schema_name,
  event_object_table as table_name,
  trigger_name,
  action_timing,
  event_manipulation,
  action_statement
from information_schema.triggers
where event_object_schema = 'public'
  and event_object_table in (
    'profiles', 'products', 'custom_links', 'social_links', 'gallery',
    'checkout_settings', 'orders', 'app_settings', 'notifications'
  )
order by event_object_table, trigger_name, event_manipulation;

-- 08. Patch penting harus ada.
select
  '08_required_functions_exist' as audit_section,
  required.function_name,
  case when p.oid is not null then 'OK: ada' else 'MISSING: belum ada' end as verdict
from (
  values
    ('get_public_profile'),
    ('create_public_order'),
    ('is_safe_public_image_url'),
    ('admin_update_profile_system_fields'),
    ('request_password_reset')
) as required(function_name)
left join pg_proc p
  on p.proname = required.function_name
left join pg_namespace n
  on n.oid = p.pronamespace and n.nspname = 'public'
order by required.function_name;

-- 09. Storage bucket niagabio config. to_jsonb aman walau kolom Supabase beda versi.
select
  '09_storage_bucket' as audit_section,
  b.id,
  b.name,
  b.public,
  to_jsonb(b)->>'file_size_limit' as file_size_limit,
  to_jsonb(b)->>'allowed_mime_types' as allowed_mime_types,
  case
    when b.id is null then 'MISSING: bucket niagabio belum ada'
    when b.public is not true then 'RISK: bucket tidak public, gambar toko bisa tidak tampil'
    else 'OK/REVIEW: bucket ada'
  end as verdict
from storage.buckets b
where b.id = 'niagabio';

-- 10. Storage policies aktif.
select
  '10_storage_policies' as audit_section,
  schemaname,
  tablename,
  policyname,
  roles,
  cmd,
  qual as using_expression,
  with_check as with_check_expression
from pg_policies
where schemaname = 'storage'
  and tablename in ('objects', 'buckets')
order by tablename, cmd, policyname;

-- 11. Storage policy risk flags.
select
  '11_storage_policy_risk_flags' as audit_section,
  schemaname,
  tablename,
  policyname,
  roles,
  cmd,
  qual as using_expression,
  with_check as with_check_expression,
  case
    when tablename = 'objects' and cmd = 'SELECT' and 'anon' = any(roles) then 'OK/REVIEW: public read memang perlu untuk gambar toko'
    when tablename = 'objects' and cmd = 'INSERT' and 'anon' = any(roles) and coalesce(with_check, '') !~ 'proofs' then 'RISK: anon upload selain proofs'
    when tablename = 'objects' and cmd in ('UPDATE','DELETE') and 'anon' = any(roles) then 'RISK: anon update/delete storage'
    when coalesce(qual, '') ~* '^\s*true\s*$' or coalesce(with_check, '') ~* '^\s*true\s*$' then 'RISK: storage policy true'
    else 'REVIEW'
  end as verdict
from pg_policies
where schemaname = 'storage'
  and tablename = 'objects'
order by cmd, policyname;

-- 12. Ringkasan object di bucket; cek apakah ada svg/html/js/php yang lolos.
select
  '12_storage_object_extensions' as audit_section,
  lower(coalesce(nullif(split_part(name, '.', array_length(string_to_array(name, '.'), 1)), ''), '(no_ext)')) as extension,
  count(*) as total_objects
from storage.objects
where bucket_id = 'niagabio'
group by 1, 2
order by total_objects desc, extension;

-- 13. Folder storage yang sedang dipakai.
select
  '13_storage_folders' as audit_section,
  (storage.foldername(name))[1] as first_folder,
  count(*) as total_objects
from storage.objects
where bucket_id = 'niagabio'
group by 1, 2
order by total_objects desc, first_folder;

-- 14. Cek data profile yang berpotensi bermasalah.
select
  '14_profile_data_flags' as audit_section,
  user_id,
  username,
  role,
  plan,
  status,
  plan_end_date,
  case
    when role not in ('user','admin') then 'RISK: role invalid'
    when plan not in ('free','premium') then 'RISK: plan invalid'
    when status not in ('active','blocked','deleted') then 'RISK: status invalid'
    when username is null or username !~ '^[a-z0-9-]{3,32}$' then 'RISK: username invalid'
    when plan = 'free' and plan_end_date is not null then 'CHECK: free user punya plan_end_date'
    else 'OK/REVIEW'
  end as verdict
from public.profiles
where role not in ('user','admin')
   or plan not in ('free','premium')
   or status not in ('active','blocked','deleted')
   or username is null
   or username !~ '^[a-z0-9-]{3,32}$'
   or (plan = 'free' and plan_end_date is not null)
order by created_at desc nulls last
limit 100;

-- 15. Cek order yang tidak sesuai aturan final.
select
  '15_order_data_flags' as audit_section,
  id,
  seller_id,
  product_id,
  buyer_name,
  payment_method,
  payment_status,
  proof_image_url,
  total_price,
  quantity,
  created_at,
  case
    when payment_status not in ('pending','paid','cancelled') then 'RISK: status invalid'
    when quantity < 1 then 'RISK: quantity invalid'
    when total_price < 0 then 'RISK: total invalid'
    when payment_method in ('qris_manual','qris_whatsapp') and coalesce(trim(proof_image_url), '') = '' then 'RISK: QRIS order tanpa bukti bayar'
    else 'OK/REVIEW'
  end as verdict
from public.orders
where payment_status not in ('pending','paid','cancelled')
   or quantity < 1
   or total_price < 0
   or (payment_method in ('qris_manual','qris_whatsapp') and coalesce(trim(proof_image_url), '') = '')
order by created_at desc nulls last
limit 100;

-- 16. Quick health counts.
select
  '16_health_counts' as audit_section,
  (select count(*) from public.profiles) as profiles_count,
  (select count(*) from public.products) as products_count,
  (select count(*) from public.orders) as orders_count,
  (select count(*) from public.premium_requests) as premium_requests_count,
  (select count(*) from public.password_reset_requests) as password_reset_requests_count,
  (select count(*) from storage.objects where bucket_id = 'niagabio') as niagabio_storage_objects_count;
