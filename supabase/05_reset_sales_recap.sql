-- =========================================================
-- NiagaBio v21 - Reset Rekap Penjualan Toko
-- Jalankan setelah schema utama untuk mengaktifkan tombol Reset Rekap di halaman /orders.
-- Function ini hanya menghapus order milik akun yang sedang login.
-- =========================================================

create or replace function public.reset_my_sales_recap()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_count integer := 0;
begin
  if auth.uid() is null then
    raise exception 'Login diperlukan' using errcode = '42501';
  end if;

  if not public.is_active_user(auth.uid()) and not public.is_admin() then
    raise exception 'Akun tidak aktif' using errcode = '42501';
  end if;

  delete from public.orders
  where seller_id = auth.uid();

  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

revoke all on function public.reset_my_sales_recap() from public;
grant execute on function public.reset_my_sales_recap() to authenticated;
