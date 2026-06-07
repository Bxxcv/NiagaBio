-- =========================================================
-- NiagaBio v24 - Final Security Hardening
-- Jalankan SETELAH 01_schema_clean_run_this.sql sampai 05_reset_sales_recap.sql.
-- Fokus: storage scoped, upload file aman, admin self-protection, request premium aman.
-- =========================================================

-- 1) Pastikan status deleted tetap valid untuk soft-delete.
update public.profiles set status = 'active' where status is null;
alter table public.profiles drop constraint if exists profiles_status_check;
alter table public.profiles add constraint profiles_status_check check (status in ('active','blocked','deleted'));

-- 2) Admin tidak boleh mengubah role/plan/status akun sendiri lewat RPC/direct API.
create or replace function public.admin_update_profile_system_fields(
  target_user_id uuid,
  new_role text default null,
  new_plan text default null,
  new_status text default null,
  new_plan_end_date timestamptz default null
)
returns public.profiles
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  updated_profile public.profiles;
begin
  if not public.is_admin() then
    raise exception 'Only admin can update system fields' using errcode = '42501';
  end if;

  if target_user_id = auth.uid() then
    raise exception 'Admin cannot update own system fields' using errcode = '42501';
  end if;

  if new_role is not null and new_role not in ('user','admin') then
    raise exception 'Invalid role' using errcode = '22023';
  end if;

  if new_plan is not null and new_plan not in ('free','premium') then
    raise exception 'Invalid plan' using errcode = '22023';
  end if;

  if new_status is not null and new_status not in ('active','blocked','deleted') then
    raise exception 'Invalid status' using errcode = '22023';
  end if;

  update public.profiles
  set
    role = coalesce(new_role, role),
    plan = case when new_status = 'deleted' then 'free' else coalesce(new_plan, plan) end,
    status = coalesce(new_status, status),
    plan_end_date = case
      when new_status = 'deleted' then null
      when new_plan = 'free' then null
      when new_plan = 'premium' and new_plan_end_date is null then now() + interval '30 days'
      when new_plan_end_date is not null then new_plan_end_date
      else plan_end_date
    end,
    updated_at = now()
  where user_id = target_user_id
  returning * into updated_profile;

  if updated_profile.user_id is null then
    raise exception 'Profile not found' using errcode = '02000';
  end if;

  return updated_profile;
end;
$$;

revoke all on function public.admin_update_profile_system_fields(uuid, text, text, text, timestamptz) from public;
grant execute on function public.admin_update_profile_system_fields(uuid, text, text, text, timestamptz) to authenticated;

-- 3) Premium request hanya untuk user Free aktif, status awal pending, tidak spam pending.
create or replace function public.protect_premium_request_fields()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    if auth.uid() is null then
      raise exception 'Login diperlukan' using errcode = '42501';
    end if;

    if new.user_id <> auth.uid() then
      raise exception 'Request harus milik user login' using errcode = '42501';
    end if;

    if not public.is_active_user(auth.uid()) then
      raise exception 'Akun tidak aktif' using errcode = '42501';
    end if;

    if public.effective_plan(auth.uid()) <> 'free' then
      raise exception 'Akun Premium tidak perlu request upgrade baru' using errcode = '42501';
    end if;

    if exists (
      select 1 from public.premium_requests pr
      where pr.user_id = auth.uid()
        and pr.status = 'pending'
        and pr.id is distinct from new.id
    ) then
      raise exception 'Masih ada pengajuan pending' using errcode = '23505';
    end if;

    new.status := 'pending';
    new.reviewed_by := null;
    new.reviewed_at := null;
    new.email := coalesce(nullif(trim(new.email), ''), (select email from auth.users where id = auth.uid()));

    if length(trim(coalesce(new.shop_name, ''))) < 2 then
      raise exception 'Nama toko wajib diisi' using errcode = '23514';
    end if;

    if length(trim(coalesce(new.owner_name, ''))) < 2 then
      raise exception 'Nama pemilik wajib diisi' using errcode = '23514';
    end if;

    if lower(coalesce(new.proof_url, '')) !~ ('/storage/v1/object/public/niagabio/premium-proofs/' || auth.uid()::text || '/.+\.(jpg|jpeg|png|webp)(\?.*)?$') then
      raise exception 'Bukti transfer harus dari upload premium-proofs milik user' using errcode = '23514';
    end if;
  elsif tg_op = 'UPDATE' then
    if not public.is_admin() then
      raise exception 'Only admin can update premium requests' using errcode = '42501';
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists protect_premium_request_fields_trigger on public.premium_requests;
create trigger protect_premium_request_fields_trigger
before insert or update on public.premium_requests
for each row execute function public.protect_premium_request_fields();

-- Perketat policy premium request sesuai trigger.
drop policy if exists "premium_requests_insert_own_pending" on public.premium_requests;
create policy "premium_requests_insert_own_pending"
on public.premium_requests for insert
to authenticated
with check (
  user_id = auth.uid()
  and coalesce(status, 'pending') = 'pending'
  and public.is_active_user(auth.uid())
  and public.effective_plan(auth.uid()) = 'free'
  and length(trim(coalesce(shop_name, ''))) > 1
  and length(trim(coalesce(owner_name, ''))) > 1
  and lower(coalesce(proof_url, '')) ~ ('/storage/v1/object/public/niagabio/premium-proofs/' || auth.uid()::text || '/.+\.(jpg|jpeg|png|webp)(\?.*)?$')
);

-- 4) Storage bucket tetap public-read untuk gambar toko, tapi upload/update/delete wajib scoped.
insert into storage.buckets (id, name, public)
values ('niagabio', 'niagabio', true)
on conflict (id) do update set public = true;

drop policy if exists "niagabio_public_read" on storage.objects;
drop policy if exists "niagabio_authenticated_upload" on storage.objects;
drop policy if exists "niagabio_public_proof_upload" on storage.objects;
drop policy if exists "niagabio_authenticated_update_own" on storage.objects;
drop policy if exists "niagabio_authenticated_delete_own" on storage.objects;
drop policy if exists "niagabio_user_scoped_upload" on storage.objects;
drop policy if exists "niagabio_proof_upload_public" on storage.objects;
drop policy if exists "niagabio_user_scoped_update" on storage.objects;
drop policy if exists "niagabio_user_scoped_delete" on storage.objects;
drop policy if exists "niagabio_admin_delete_any" on storage.objects;

create policy "niagabio_public_read"
on storage.objects for select
to anon, authenticated
using (bucket_id = 'niagabio');

create policy "niagabio_user_scoped_upload"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'niagabio'
  and lower(storage.extension(name)) in ('jpg','jpeg','png','webp')
  and (
    (
      (storage.foldername(name))[1] in ('avatars','products','gallery','qris','premium-proofs')
      and (storage.foldername(name))[2] = auth.uid()::text
    )
    or (
      (storage.foldername(name))[1] = 'premium-qris'
      and (storage.foldername(name))[2] = auth.uid()::text
      and public.is_admin()
    )
    or (
      (storage.foldername(name))[1] = 'proofs'
      and (storage.foldername(name))[2] is null
    )
  )
);

-- Buyer yang tidak login boleh upload bukti order ke proofs/random.ext saja.
-- Karena bucket public, jangan pakai folder ini untuk data sangat sensitif.
create policy "niagabio_proof_upload_public"
on storage.objects for insert
to anon
with check (
  bucket_id = 'niagabio'
  and lower(storage.extension(name)) in ('jpg','jpeg','png','webp')
  and (storage.foldername(name))[1] = 'proofs'
  and (storage.foldername(name))[2] is null
);

create policy "niagabio_user_scoped_update"
on storage.objects for update
to authenticated
using (
  bucket_id = 'niagabio'
  and owner = auth.uid()
  and lower(storage.extension(name)) in ('jpg','jpeg','png','webp')
  and (
    (
      (storage.foldername(name))[1] in ('avatars','products','gallery','qris','premium-proofs')
      and (storage.foldername(name))[2] = auth.uid()::text
    )
    or (
      (storage.foldername(name))[1] = 'premium-qris'
      and (storage.foldername(name))[2] = auth.uid()::text
      and public.is_admin()
    )
  )
)
with check (
  bucket_id = 'niagabio'
  and owner = auth.uid()
  and lower(storage.extension(name)) in ('jpg','jpeg','png','webp')
  and (
    (
      (storage.foldername(name))[1] in ('avatars','products','gallery','qris','premium-proofs')
      and (storage.foldername(name))[2] = auth.uid()::text
    )
    or (
      (storage.foldername(name))[1] = 'premium-qris'
      and (storage.foldername(name))[2] = auth.uid()::text
      and public.is_admin()
    )
  )
);

create policy "niagabio_user_scoped_delete"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'niagabio'
  and owner = auth.uid()
  and (
    (
      (storage.foldername(name))[1] in ('avatars','products','gallery','qris','premium-proofs')
      and (storage.foldername(name))[2] = auth.uid()::text
    )
    or (
      (storage.foldername(name))[1] = 'premium-qris'
      and (storage.foldername(name))[2] = auth.uid()::text
      and public.is_admin()
    )
  )
);

create policy "niagabio_admin_delete_any"
on storage.objects for delete
to authenticated
using (bucket_id = 'niagabio' and public.is_admin());

-- 5) Register lock: app_settings.allow_register tetap dicek frontend.
-- Catatan: Supabase Auth signUp langsung dari API masih perlu dikontrol dari Dashboard Auth/Supabase Auth settings.
