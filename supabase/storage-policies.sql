-- NiagaBio Storage Policies
-- Buat bucket public bernama niagabio dulu, lalu jalankan SQL ini.

drop policy if exists "NiagaBio public read" on storage.objects;
drop policy if exists "NiagaBio authenticated upload" on storage.objects;
drop policy if exists "NiagaBio authenticated update" on storage.objects;
drop policy if exists "NiagaBio authenticated delete" on storage.objects;

create policy "NiagaBio public read"
on storage.objects
for select
to public
using (bucket_id = 'niagabio');

create policy "NiagaBio authenticated upload"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'niagabio');

create policy "NiagaBio authenticated update"
on storage.objects
for update
to authenticated
using (bucket_id = 'niagabio')
with check (bucket_id = 'niagabio');

create policy "NiagaBio authenticated delete"
on storage.objects
for delete
to authenticated
using (bucket_id = 'niagabio');
