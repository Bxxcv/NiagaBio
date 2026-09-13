-- =========================================================
-- 33_maintenance_pages_scope.sql
-- Tujuan: dukung maintenance mode per-halaman (checklist di Admin Master),
--         bukan cuma on/off untuk seluruh situs.
-- Additive only, tidak menyentuh RLS/kolom lain.
-- =========================================================

alter table public.app_settings
  add column if not exists maintenance_pages jsonb not null default '[]'::jsonb;

-- Guard: pastikan selalu array, jangan sampai null/object nyasar.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'app_settings_maintenance_pages_is_array'
  ) then
    alter table public.app_settings
      add constraint app_settings_maintenance_pages_is_array
      check (jsonb_typeof(maintenance_pages) = 'array');
  end if;
end $$;
