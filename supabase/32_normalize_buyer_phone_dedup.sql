-- 32_normalize_buyer_phone_dedup.sql
-- P1 fix: dedup guard di create_public_order() bisa dilewati kalau buyer
-- ganti format awalan nomor HP (mis. "081234567890" vs "6281234567890" vs
-- "+6281234567890" — semua nomor yang sama, tapi dianggap berbeda oleh
-- dedup guard lama karena cuma di-strip karakter non-digit).
--
-- Perubahan ini SENGAJA dibuat minimal: definisi function persis migration
-- 24 (24_buatqris_payment_gateway.sql), HANYA menambahkan satu variabel
-- dedup_phone_key untuk perbandingan dedup. Nilai yang DISIMPAN ke kolom
-- orders.buyer_phone TIDAK berubah (tetap clean_buyer_phone apa adanya,
-- sama seperti migration 24). Tidak ada perubahan tabel/kolom/RLS.

create or replace function public.create_public_order(
  target_seller_id uuid,
  target_product_id uuid,
  buyer_name_input text,
  buyer_phone_input text,
  quantity_input integer default 1,
  proof_image_url_input text default '',
  payment_method_input text default 'qris_manual'
)
returns public.orders
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  product_owner uuid;
  product_title text;
  product_price numeric;
  product_active boolean;
  clean_buyer_name text;
  clean_buyer_phone text;
  dedup_phone_key text;
  clean_method text;
  clean_proof_url text;
  clean_quantity integer;
  recent_duplicate_count integer;
  setting_platform_fee numeric := 1000;
  setting_withdrawal_reserve numeric := 2500;
  inserted_order public.orders;
begin
  clean_buyer_name := left(trim(coalesce(buyer_name_input, '')), 80);
  if length(clean_buyer_name) < 2 then
    raise exception 'Nama pembeli wajib diisi' using errcode = '23514';
  end if;

  clean_buyer_phone := regexp_replace(coalesce(buyer_phone_input, ''), '[^0-9]', '', 'g');
  if length(clean_buyer_phone) not between 8 and 18 then
    raise exception 'Nomor pembeli tidak valid' using errcode = '23514';
  end if;

  -- P1 fix: normalisasi HANYA untuk perbandingan dedup di bawah.
  -- Awalan Indonesia '62' (mis. dari format +62/62xxx) disamakan jadi '0'
  -- supaya "6281234567890" dan "081234567890" dianggap nomor yang sama
  -- oleh guard anti-spam. clean_buyer_phone (nilai yang DISIMPAN) tidak
  -- ikut berubah.
  dedup_phone_key := case
    when left(clean_buyer_phone, 2) = '62' and length(clean_buyer_phone) between 10 and 15
      then '0' || substr(clean_buyer_phone, 3)
    else clean_buyer_phone
  end;

  clean_quantity := greatest(coalesce(quantity_input, 1), 1);
  if clean_quantity > 999 then
    raise exception 'Jumlah produk terlalu besar' using errcode = '23514';
  end if;

  clean_method := coalesce(nullif(trim(lower(payment_method_input)), ''), 'qris_buatqris');
  if clean_method not in ('qris_buatqris', 'qris_manual', 'qris_whatsapp') then
    raise exception 'Metode pembayaran tidak valid' using errcode = '23514';
  end if;

  clean_proof_url := trim(coalesce(proof_image_url_input, ''));
  if clean_method <> 'qris_buatqris' then
    if clean_proof_url = '' then
      raise exception 'Bukti pembayaran wajib diupload sebelum kirim pesanan.' using errcode = '23514';
    end if;
    if not public.is_safe_proof_reference(clean_proof_url, 'proofs', target_seller_id) then
      raise exception 'Bukti bayar tidak aman' using errcode = '23514';
    end if;
  else
    clean_proof_url := '';
  end if;

  select p.user_id, p.name, coalesce(p.price, 0), p.is_active
  into product_owner, product_title, product_price, product_active
  from public.products p
  where p.id = target_product_id;

  if product_owner is null then
    raise exception 'Produk tidak ditemukan' using errcode = '23503';
  end if;
  if product_owner <> target_seller_id or product_active is not true then
    raise exception 'Produk tidak valid untuk seller ini' using errcode = '23514';
  end if;
  if not public.is_active_user(target_seller_id) then
    raise exception 'Seller sedang tidak aktif' using errcode = '42501';
  end if;

  -- P1 fix: dua query di bawah pakai dedup_phone_key (bukan clean_buyer_phone)
  -- untuk perbandingan. Window waktu dan ambang batas TIDAK berubah dari
  -- migration 24 (2 menit / >0, dan 15 menit / >=5) — cuma cara
  -- membandingkan nomornya yang berubah.
  select count(*) into recent_duplicate_count
  from public.orders o
  where o.seller_id = target_seller_id
    and o.product_id = target_product_id
    and (
      case
        when left(regexp_replace(coalesce(o.buyer_phone, ''), '[^0-9]', '', 'g'), 2) = '62'
             and length(regexp_replace(coalesce(o.buyer_phone, ''), '[^0-9]', '', 'g')) between 10 and 15
        then '0' || substr(regexp_replace(coalesce(o.buyer_phone, ''), '[^0-9]', '', 'g'), 3)
        else regexp_replace(coalesce(o.buyer_phone, ''), '[^0-9]', '', 'g')
      end
    ) = dedup_phone_key
    and o.created_at > now() - interval '2 minutes';
  if recent_duplicate_count > 0 then
    raise exception 'Pesanan serupa baru saja dikirim. Tunggu sebentar sebelum mencoba lagi.' using errcode = '42901';
  end if;

  select count(*) into recent_duplicate_count
  from public.orders o
  where o.seller_id = target_seller_id
    and (
      case
        when left(regexp_replace(coalesce(o.buyer_phone, ''), '[^0-9]', '', 'g'), 2) = '62'
             and length(regexp_replace(coalesce(o.buyer_phone, ''), '[^0-9]', '', 'g')) between 10 and 15
        then '0' || substr(regexp_replace(coalesce(o.buyer_phone, ''), '[^0-9]', '', 'g'), 3)
        else regexp_replace(coalesce(o.buyer_phone, ''), '[^0-9]', '', 'g')
      end
    ) = dedup_phone_key
    and o.created_at > now() - interval '15 minutes';
  if recent_duplicate_count >= 5 then
    raise exception 'Terlalu banyak pesanan dari nomor ini. Coba lagi beberapa menit lagi.' using errcode = '42901';
  end if;

  select greatest(coalesce(platform_fee, 1000), 0), greatest(coalesce(withdrawal_reserve, 2500), 0)
  into setting_platform_fee, setting_withdrawal_reserve
  from public.app_settings
  where id = 'global';

  insert into public.orders (
    seller_id, buyer_name, buyer_phone, product_id, product_name, quantity,
    total_price, payment_method, payment_status, proof_image_url, paid_at,
    platform_fee, withdrawal_reserve, gateway_fee, buyer_total, seller_earning,
    platform_earning, payment_provider, created_at, updated_at
  ) values (
    target_seller_id, clean_buyer_name, clean_buyer_phone, target_product_id, product_title, clean_quantity,
    product_price * clean_quantity, clean_method, 'pending', clean_proof_url, null,
    setting_platform_fee, setting_withdrawal_reserve, 0,
    (product_price * clean_quantity) + setting_platform_fee + setting_withdrawal_reserve,
    product_price * clean_quantity, 0,
    case when clean_method = 'qris_buatqris' then 'buatqris' else '' end,
    now(), now()
  ) returning * into inserted_order;

  return inserted_order;
end;
$$;

revoke all on function public.create_public_order(uuid, uuid, text, text, integer, text, text) from public;
grant execute on function public.create_public_order(uuid, uuid, text, text, integer, text, text) to anon, authenticated;
