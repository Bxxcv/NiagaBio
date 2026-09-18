-- ============================================================
-- STAGE25 / Migration 37 — Riwayat pesanan buyer by nomor WhatsApp
-- ============================================================
-- Konteks: Rid minta halaman riwayat order ala Shopee - buyer buka satu
-- halaman, masukin nomor WA, langsung lihat SEMUA pesanan (lintas toko),
-- bukan cuma 1 order_group_id yang harus disimpan linknya.
--
-- CATATAN TRADE-OFF KEAMANAN (baca sebelum apply): lookup ini HANYA
-- pakai nomor WhatsApp sebagai kunci - tidak ada order_group_id/token
-- rahasia lagi seperti get_order_group_tracking. Artinya siapapun yang
-- tahu nomor WA seseorang bisa lihat RINGKASAN riwayat order nomor itu
-- (nama toko, tanggal, produk, total, status - TIDAK termasuk data
-- finansial seller). Ini trade-off yang inherent dari keputusan "buyer
-- tanpa akun" - tidak ada cara lain untuk buyer akses riwayatnya sendiri
-- tanpa suatu bentuk identifier yang bisa diingat (dan nomor WA memang
-- sudah jadi identifier utama sejak awal checkout). Kalau Rid mau
-- proteksi lebih (mis. OTP WA sebelum buka riwayat), itu enhancement
-- terpisah - belum di-scope di sini.
-- ============================================================

create or replace function public.get_orders_by_phone(p_buyer_phone text)
returns table (
  order_group_id uuid,
  seller_display_name text,
  seller_username text,
  item_count integer,
  items_summary text,
  total_amount numeric,
  order_status text,
  payment_status text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  clean_phone text := regexp_replace(coalesce(p_buyer_phone, ''), '[^0-9]', '', 'g');
  phone_key text;
begin
  if length(clean_phone) < 8 then
    raise exception 'Nomor WhatsApp wajib diisi' using errcode = '23514';
  end if;

  phone_key := case
    when left(clean_phone, 2) = '62' and length(clean_phone) between 10 and 15
      then '0' || substr(clean_phone, 3)
    else clean_phone
  end;

  return query
  with matched as (
    select o.*,
      case o.order_status
        when 'pending' then 0
        when 'processing' then 1
        when 'ready' then 2
        when 'completed' then 3
        else -1
      end as step
    from public.orders o
    where (
      case
        when left(regexp_replace(coalesce(o.buyer_phone,''),'[^0-9]','','g'),2)='62'
             and length(regexp_replace(coalesce(o.buyer_phone,''),'[^0-9]','','g')) between 10 and 15
        then '0' || substr(regexp_replace(coalesce(o.buyer_phone,''),'[^0-9]','','g'),3)
        else regexp_replace(coalesce(o.buyer_phone,''),'[^0-9]','','g')
      end
    ) = phone_key
  )
  select
    m.order_group_id,
    p.display_name,
    p.username,
    count(*)::integer,
    string_agg(m.product_name || ' x' || m.quantity, ', ' order by m.created_at),
    sum(m.total_price) + max(m.platform_fee) + max(m.withdrawal_reserve),
    case
      when bool_and(m.step = -1) then 'cancelled'
      else (array['pending', 'processing', 'ready', 'completed'])[min(m.step) filter (where m.step <> -1) + 1]
    end,
    max(m.payment_status),
    min(m.created_at)
  from matched m
  join public.profiles p on p.user_id = m.seller_id
  group by m.order_group_id, p.display_name, p.username
  order by min(m.created_at) desc
  limit 50;
end;
$$;

revoke all on function public.get_orders_by_phone(text) from public;
grant execute on function public.get_orders_by_phone(text) to anon, authenticated;
