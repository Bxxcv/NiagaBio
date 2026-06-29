-- =========================================================
-- NiagaBio 19 - Production Readiness Audit (READ ONLY)
-- =========================================================
-- Cara pakai:
-- 1. Buka Supabase Dashboard > SQL Editor.
-- 2. Paste seluruh file ini.
-- 3. Run.
-- 4. Semua baris "ok" sebaiknya bernilai true.
--
-- File ini TIDAK mengubah data, TIDAK membuat policy, dan TIDAK
-- menghapus apapun. Fokusnya hanya memastikan patch penting aktif.
-- =========================================================

-- 01. Ringkasan tabel penting, RLS, dan estimasi ukuran database.
select
  '01_tables_rls_size' as check_name,
  n.nspname as schema_name,
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  pg_size_pretty(pg_total_relation_size(c.oid)) as total_size
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
  and c.relname in (
    'profiles',
    'products',
    'custom_links',
    'social_links',
    'gallery',
    'checkout_settings',
    'orders',
    'app_settings',
    'premium_requests',
    'password_reset_requests',
    'notifications',
    'audit_logs'
  )
order by c.relname;

-- 02. Function security-definer penting.
select
  '02_functions_security' as check_name,
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as arguments,
  p.prosecdef as is_security_definer,
  p.proconfig as config,
  case
    when p.proname in (
      'is_admin',
      'create_public_order',
      'admin_update_profile_system_fields',
      'admin_review_premium_request',
      'admin_soft_delete_user',
      'is_safe_proof_reference',
      'is_safe_private_proof_ref'
    )
    then p.prosecdef = true
    else true
  end as ok
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'is_admin',
    'is_active_user',
    'effective_plan',
    'get_public_profile',
    'create_public_order',
    'admin_update_profile_system_fields',
    'admin_review_premium_request',
    'admin_soft_delete_user',
    'set_profile_theme',
    'reset_my_sales_recap',
    'is_safe_public_image_url',
    'is_safe_private_proof_ref',
    'is_safe_proof_reference',
    'request_password_reset',
    'admin_update_password_reset_request',
    'write_audit_log'
  )
order by p.proname, arguments;

-- 03. Hak execute function yang wajib ada.
with expected(function_name, identity_args, role_name) as (
  values
    ('create_public_order', 'target_seller_id uuid, target_product_id uuid, buyer_name_input text, buyer_phone_input text, quantity_input integer, proof_image_url_input text, payment_method_input text', 'anon'),
    ('create_public_order', 'target_seller_id uuid, target_product_id uuid, buyer_name_input text, buyer_phone_input text, quantity_input integer, proof_image_url_input text, payment_method_input text', 'authenticated'),
    ('admin_update_profile_system_fields', 'target_user_id uuid, new_role text, new_plan text, new_status text, new_plan_end_date timestamp with time zone', 'authenticated'),
    ('admin_review_premium_request', 'request_id uuid, action_status text, premium_days integer', 'authenticated')
),
matched as (
  select
    e.function_name,
    e.identity_args,
    e.role_name,
    p.oid
  from expected e
  left join pg_proc p
    on p.proname = e.function_name
   and pg_get_function_identity_arguments(p.oid) = e.identity_args
   and p.pronamespace = (
     select oid from pg_namespace where nspname = 'public'
   )
)
select
  '03_function_grants' as check_name,
  role_name || ' can execute ' || function_name as rule_name,
  oid is not null as function_exists,
  case
    when oid is null then false
    else has_function_privilege(role_name, oid, 'EXECUTE')
  end as ok
from matched
order by function_name, role_name;

-- 04. Policy penting di public schema.
select
  '04_public_policies' as check_name,
  schemaname,
  tablename,
  policyname,
  cmd,
  roles,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and tablename in (
    'profiles',
    'products',
    'custom_links',
    'social_links',
    'gallery',
    'checkout_settings',
    'orders',
    'app_settings',
    'premium_requests',
    'password_reset_requests',
    'notifications',
    'audit_logs'
  )
order by tablename, policyname;

-- 05. Checklist policy orders.
select
  '05_orders_policy_check' as check_name,
  exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'orders'
      and policyname = 'orders_insert_public_pending_only'
      and cmd = 'INSERT'
      and coalesce(with_check, '') ilike '%is_safe_proof_reference%'
      and coalesce(with_check, '') ilike '%is_active_user%'
  ) as insert_policy_requires_safe_proof,
  exists (
    select 1
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'orders'
      and t.tgname = 'validate_order_public_fields_v15_order_hardening'
      and t.tgenabled = 'O'
  ) as order_validation_trigger_enabled,
  exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'create_public_order'
      and p.prosecdef = true
      and array_to_string(p.proconfig, ',') ilike '%search_path%'
  ) as create_public_order_secure;

-- 06. Bucket storage dan policy storage.
select
  '06_storage_buckets' as check_name,
  id,
  name,
  public as is_public,
  file_size_limit,
  allowed_mime_types
from storage.buckets
where id in ('niagabio', 'niagabio-private')
order by id;

select
  '07_storage_policy_check' as check_name,
  exists (
    select 1
    from storage.buckets
    where id = 'niagabio-private'
      and public = false
  ) as private_bucket_is_private,
  exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'niagabio_private_proof_upload_public'
      and cmd = 'INSERT'
      and coalesce(with_check, '') ilike '%niagabio-private%'
      and coalesce(with_check, '') ilike '%proofs%'
  ) as anon_checkout_proof_upload_policy_exists,
  exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'niagabio_private_proof_select_owner_or_admin'
      and cmd = 'SELECT'
      and coalesce(qual, '') ilike '%is_admin%'
  ) as private_proof_read_is_owner_or_admin,
  not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname in (
        'niagabio_public_proof_upload',
        'niagabio_proof_upload_public'
      )
  ) as old_public_proof_upload_policy_removed;

-- 08. Index penting untuk scaling 1000 seller.
select
  '08_indexes' as check_name,
  tablename,
  indexname,
  indexdef
from pg_indexes
where schemaname = 'public'
  and tablename in (
    'profiles',
    'products',
    'custom_links',
    'social_links',
    'gallery',
    'checkout_settings',
    'orders',
    'notifications',
    'premium_requests',
    'password_reset_requests',
    'audit_logs'
  )
order by tablename, indexname;

-- 09. Data growth snapshot.
-- n_live_tup adalah estimasi dari Postgres stats, cukup untuk audit cepat.
select
  '09_row_counts' as check_name,
  expected.table_name,
  coalesce(s.n_live_tup, 0)::bigint as estimated_row_count,
  to_regclass('public.' || expected.table_name) is not null as table_exists
from (
  values
    ('profiles'),
    ('products'),
    ('custom_links'),
    ('social_links'),
    ('gallery'),
    ('checkout_settings'),
    ('orders'),
    ('premium_requests'),
    ('password_reset_requests'),
    ('notifications'),
    ('audit_logs')
) as expected(table_name)
left join pg_stat_user_tables s
  on s.schemaname = 'public'
 and s.relname = expected.table_name
order by expected.table_name;

-- 10. Estimasi storage object count dan size.
select
  '10_storage_usage' as check_name,
  bucket_id,
  split_part(name, '/', 1) as top_folder,
  count(*)::bigint as object_count,
  pg_size_pretty(
    coalesce(
      sum(nullif(metadata ->> 'size', '')::numeric),
      0
    )::bigint
  ) as approx_size
from storage.objects
where bucket_id in ('niagabio', 'niagabio-private')
group by bucket_id, split_part(name, '/', 1)
order by bucket_id, top_folder;

-- 11. Red flags cepat.
select
  '11_red_flags' as check_name,
  'profiles without username' as issue,
  count(*)::bigint as count
from public.profiles
where username is null or trim(username) = ''
union all
select
  '11_red_flags',
  'orders without proof reference',
  count(*)::bigint
from public.orders
where coalesce(trim(proof_image_url), '') = ''
union all
select
  '11_red_flags',
  'orders with non-qris method',
  count(*)::bigint
from public.orders
where payment_method not in ('qris_manual', 'qris_whatsapp')
union all
select
  '11_red_flags',
  'private bucket is public',
  count(*)::bigint
from storage.buckets
where id = 'niagabio-private'
  and public = true
union all
select
  '11_red_flags',
  'active public proof upload old policy still exists',
  count(*)::bigint
from pg_policies
where schemaname = 'storage'
  and tablename = 'objects'
  and policyname in ('niagabio_public_proof_upload', 'niagabio_proof_upload_public')
order by issue;

-- 12. Kesimpulan cepat.
select
  '12_summary' as check_name,
  (
    exists (select 1 from storage.buckets where id = 'niagabio-private' and public = false)
    and exists (
      select 1
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.proname = 'create_public_order'
        and p.prosecdef = true
    )
    and exists (
      select 1
      from pg_policies
      where schemaname = 'public'
        and tablename = 'orders'
        and policyname = 'orders_insert_public_pending_only'
        and coalesce(with_check, '') ilike '%is_safe_proof_reference%'
    )
    and exists (
      select 1
      from pg_policies
      where schemaname = 'storage'
        and tablename = 'objects'
        and policyname = 'niagabio_private_proof_select_owner_or_admin'
    )
  ) as core_security_ready,
  'Jika core_security_ready = true dan red_flags count = 0 untuk isu kritikal, patch 15/16/18 kemungkinan sudah aktif.' as note;
