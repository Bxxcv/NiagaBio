-- =========================================================
-- 34_reports_reset_view.sql
-- Tujuan: "Reset Tampilan Laporan" - non-destruktif. Cuma nyimpen titik waktu
-- reset; data order/request ASLI di database TIDAK dihapus/diubah sama sekali.
-- Laporan Platform nanti cuma menampilkan data setelah titik waktu ini.
-- Additive only.
-- =========================================================

alter table public.app_settings
  add column if not exists reports_reset_at timestamptz;
