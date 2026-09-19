-- ============================================================
-- STAGE27 / Migration 39 — Fix waktu notifikasi seller
-- ============================================================
-- Temuan (dari feedback Rid + audit menyeluruh SEMUA trigger di orders,
-- pelajaran dari STAGE26 kemarin - jangan cuma cek trigger yang dicurigai):
--
-- 1) `notify_order_insert` (AFTER INSERT, sejak migration 22, sebelum
--    cart feature) nembak notifikasi "Pesanan baru" ke seller SETIAP kali
--    row orders dibuat - termasuk order qris_buatqris yang masih
--    payment_status='pending' (buyer baru mulai checkout, belum bayar
--    sama sekali). Makanya Rid lihat notifikasi masuk padahal "user belum
--    selesai".
-- 2) `notify_order_status_update` (AFTER UPDATE OF payment_status) punya
--    syarat `auth.uid() is not null` - webhook BuatQris jalan pakai
--    service_role (auth.uid() = null untuk service_role), jadi kondisi
--    ini justru MEMBLOKIR notifikasi saat pembayaran gateway sukses.
--    Selama ini seller kemungkinan besar TIDAK PERNAH dapat notifikasi
--    "pembayaran sukses" untuk order qris_buatqris - cuma dapat notif
--    "pesanan baru" (poin 1) yang sebenarnya masih pending.
--
-- FIX:
-- - notify_order_insert: skip untuk qris_buatqris (belum tentu akan
--   dibayar - tunggu sampai sukses). Tetap jalan untuk qris_manual/
--   qris_whatsapp (proof_image sudah wajib diisi di titik ini, itu
--   memang submission yang perlu direview seller).
-- - notify_order_status_update: hapus syarat `auth.uid() is not null`
--   supaya webhook (service_role, auth.uid()=null) juga memicu notifikasi.
--   Syarat `auth.uid() <> new.seller_id` tetap dipertahankan supaya
--   seller tidak dapat notifikasi dari aksinya sendiri (mis. klik
--   "Tandai Dibayar" di dashboard sendiri).
-- ============================================================

create or replace function public.notify_order_insert()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.payment_method = 'qris_buatqris' then
    return new; -- tunggu sampai payment_status='paid' (lihat notify_order_status_update)
  end if;

  perform public.create_notification(
    new.seller_id,
    'order_new',
    'Pesanan baru',
    coalesce(new.buyer_name, 'Pembeli')
      || ' memesan '
      || coalesce(new.product_name, 'produk')
      || ' senilai '
      || to_char(coalesce(new.total_price, 0), 'FM999G999G999G999'),
    'orders',
    jsonb_build_object(
      'order_id', new.id,
      'product_id', new.product_id,
      'total_price', new.total_price
    ),
    null
  );

  return new;
end;
$$;

create or replace function public.notify_order_status_update()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
begin
  if old.payment_status is distinct from new.payment_status
     and (auth.uid() is null or auth.uid() <> new.seller_id) then
    perform public.create_notification(
      new.seller_id,
      'order_status_updated',
      case when new.payment_status = 'paid' then 'Pembayaran diterima' else 'Status pesanan diperbarui' end,
      'Pesanan '
        || coalesce(new.product_name, 'produk')
        || ' berubah menjadi '
        || coalesce(new.payment_status, 'pending')
        || '.',
      'orders',
      jsonb_build_object(
        'order_id', new.id,
        'payment_status', new.payment_status
      ),
      auth.uid()
    );
  end if;

  return new;
end;
$$;
