-- =========================================================
-- NiagaBio - Fix Storage RLS upload QRIS / product / gallery
-- Jalankan file ini di Supabase SQL Editor kalau upload QRIS muncul:
-- "new row violates row-level security policy"
--
-- Penyebab:
-- policy lama mengecek (storage.foldername(name))[3] is not null.
-- Untuk path qris/<user_id>/<file>.jpg, foldername biasanya hanya:
-- ['qris', '<user_id>'], jadi check itu gagal.
-- =========================================================

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
