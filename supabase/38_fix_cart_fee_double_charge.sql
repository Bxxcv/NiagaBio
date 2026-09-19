-- ============================================================
-- STAGE26 / Migration 38 — Fix fee dobel di cart (root cause: trigger lama)
-- ============================================================
-- ROOT CAUSE (dikonfirmasi dari data live Rid): trigger BEFORE INSERT
-- `protect_orders_fields()` (sudah ada sejak migration 25/28, SEBELUM cart
-- feature dibuat) menimpa ulang platform_fee/withdrawal_reserve/buyer_total
-- di SETIAP baris orders yang di-insert, berdasarkan product_price*quantity
-- + full fee - TANPA tahu soal order_group_id/cart. Ini bikin logic
-- "fee cuma di item pertama" di create_public_order_batch (migration 36)
-- percuma: trigger langsung timpa ulang jadi fee PENUH di SEMUA item.
--
-- Trigger ini juga yang bikin manual "Tandai Dibayar" (qris_manual/
-- qris_whatsapp) kemungkinan sudah tidak jalan untuk seller biasa sejak
-- migration 25/28 - lihat catatan di bagian bawah file ini, BELUM saya
-- fix di migration ini (di luar scope bug yang dilaporkan, perlu
-- konfirmasi Rid dulu).
--
-- FIX di migration ini:
-- 1) protect_orders_fields(): saat INSERT, cek dulu apakah order_group_id
--    ini SUDAH punya row lain. Kalau sudah (berarti ini item ke-2/3/dst
--    dari 1 cart), fee = 0. Kalau belum (item pertama, ATAU order lama
--    single-item yang order_group_id-nya selalu fresh random), fee penuh
--    seperti sebelumnya - TIDAK ADA PERUBAHAN untuk flow single-item lama.
-- 2) protect_orders_fields(): tambah "trusted flag" (GUC transaction-local)
--    supaya create_public_order_batch bisa membetulkan buyer_total row
--    pertama jadi TOTAL SELURUH keranjang setelah semua item ke-insert
--    (di titik insert item pertama, total item ke-2/3/dst belum diketahui).
-- 3) create_public_order_batch(): disederhanakan besar - product lookup/
--    fee/total_price sekarang SEPENUHNYA diserahkan ke trigger di atas
--    (sumber kebenaran tunggal, tidak dihitung dobel di 2 tempat berbeda
--    seperti migration 36 kemarin). Fungsi ini sekarang cuma: validasi
--    buyer + anti-spam + insert baris minimal + betulkan buyer_total
--    primary di akhir.
-- ============================================================

create or replace function public.protect_orders_fields()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  product_owner uuid;
  product_title text;
  product_price numeric;
  product_active boolean;
  setting_platform_fee numeric := 1000;
  setting_withdrawal_reserve numeric := 2500;
  is_service boolean := coalesce(auth.role(), '') = 'service_role';
  is_trusted_batch boolean := coalesce(current_setting('nb.trusted_batch_settlement', true), '') = 'on';
  is_subsequent_in_group boolean;
begin
  if tg_op = 'INSERT' then
    if new.product_id is null then
      raise exception 'product_id is required' using errcode = '23502';
    end if;

    select p.user_id, p.name, coalesce(p.price, 0), p.is_active
      into product_owner, product_title, product_price, product_active
    from public.products p
    where p.id = new.product_id;

    if product_owner is null then
      raise exception 'Product not found' using errcode = '23503';
    end if;
    if product_owner <> new.seller_id or product_active is not true then
      raise exception 'Invalid product for seller' using errcode = '23514';
    end if;
    if not public.is_active_user(new.seller_id) then
      raise exception 'Seller is blocked or inactive' using errcode = '42501';
    end if;
    if coalesce(new.quantity, 0) < 1 then
      raise exception 'Quantity must be greater than zero' using errcode = '23514';
    end if;

    select greatest(coalesce(platform_fee, 1000), 0), greatest(coalesce(withdrawal_reserve, 2500), 0)
      into setting_platform_fee, setting_withdrawal_reserve
    from public.app_settings
    where id = 'global';

    -- STAGE26: fee cuma dikenakan di item PERTAMA per order_group_id.
    -- Order single-item lama (order_group_id selalu fresh random dari
    -- default kolom) selalu masuk cabang "belum ada row lain" -> fee
    -- penuh seperti sebelumnya, tidak ada perubahan perilaku untuk mereka.
    select exists(
      select 1 from public.orders o where o.order_group_id = new.order_group_id
    ) into is_subsequent_in_group;

    new.product_name := product_title;
    new.total_price := product_price * new.quantity;
    if is_subsequent_in_group then
      new.platform_fee := 0;
      new.withdrawal_reserve := 0;
    else
      new.platform_fee := setting_platform_fee;
      new.withdrawal_reserve := setting_withdrawal_reserve;
    end if;
    new.gateway_fee := 0;
    new.buyer_total := new.total_price + new.platform_fee + new.withdrawal_reserve;
    new.seller_earning := new.total_price;
    new.platform_earning := 0;
    new.payment_provider := case when new.payment_method = 'qris_buatqris' then 'buatqris' else '' end;
    new.provider_transaction_id := '';
    new.provider_status := '';
    new.payment_expires_at := null;
    new.payment_status := 'pending';
    new.paid_at := null;
    new.is_test := false;
    new.created_at := coalesce(new.created_at, now());
  elsif tg_op = 'UPDATE' then
    -- STAGE26: tambah is_trusted_batch sebagai bypass ketiga, KHUSUS supaya
    -- create_public_order_batch bisa membetulkan buyer_total row primary
    -- (satu-satunya kolom yang benar-benar diubahnya lewat jalur ini).
    -- Flag ini transaction-local (set_config ..., true) dan cuma pernah
    -- di-set oleh fungsi kita sendiri - buyer/seller tidak bisa
    -- menyalakannya dari client manapun.
    if not public.is_admin() and not is_service and not is_trusted_batch then
      new.id := old.id;
      new.seller_id := old.seller_id;
      new.buyer_name := old.buyer_name;
      new.buyer_phone := old.buyer_phone;
      new.product_id := old.product_id;
      new.product_name := old.product_name;
      new.quantity := old.quantity;
      new.total_price := old.total_price;
      new.payment_method := old.payment_method;
      new.payment_status := old.payment_status;
      new.proof_image_url := old.proof_image_url;
      new.paid_at := old.paid_at;
      new.platform_fee := old.platform_fee;
      new.withdrawal_reserve := old.withdrawal_reserve;
      new.gateway_fee := old.gateway_fee;
      new.buyer_total := old.buyer_total;
      new.seller_earning := old.seller_earning;
      new.platform_earning := old.platform_earning;
      new.payment_provider := old.payment_provider;
      new.provider_transaction_id := old.provider_transaction_id;
      new.provider_status := old.provider_status;
      new.payment_expires_at := old.payment_expires_at;
      new.is_test := old.is_test;
      new.created_at := old.created_at;
    end if;

    if new.payment_status = 'paid' and new.paid_at is null then
      new.paid_at := now();
    elsif new.payment_status <> 'paid' then
      new.paid_at := null;
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

-- ------------------------------------------------------------
-- create_public_order_batch — disederhanakan: product lookup & perhitungan
-- fee/total_price sekarang 100% tanggung jawab trigger di atas (satu
-- sumber kebenaran). Fungsi ini cuma validasi level-buyer + anti-spam +
-- insert baris minimal + betulkan buyer_total primary di akhir.
-- ------------------------------------------------------------
create or replace function public.create_public_order_batch(
  target_seller_id uuid,
  items jsonb,
  buyer_name_input text,
  buyer_phone_input text,
  proof_image_url_input text default '',
  payment_method_input text default 'qris_buatqris'
)
returns setof public.orders
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  clean_buyer_name text;
  clean_buyer_phone text;
  dedup_phone_key text;
  clean_method text;
  clean_proof_url text;
  recent_duplicate_count integer;
  v_group_id uuid := gen_random_uuid();
  v_item jsonb;
  v_product_id uuid;
  v_qty integer;
  v_new_id uuid;
  v_item_total numeric;
  v_primary_id uuid;
  v_group_total numeric := 0;
  v_order_ids uuid[] := '{}';
begin
  if items is null or jsonb_typeof(items) <> 'array' or jsonb_array_length(items) < 1 then
    raise exception 'Keranjang kosong' using errcode = '23514';
  end if;
  if jsonb_array_length(items) > 30 then
    raise exception 'Maksimal 30 item per checkout' using errcode = '23514';
  end if;

  clean_buyer_name := left(trim(coalesce(buyer_name_input, '')), 80);
  if length(clean_buyer_name) < 2 then
    raise exception 'Nama pembeli wajib diisi' using errcode = '23514';
  end if;

  clean_buyer_phone := regexp_replace(coalesce(buyer_phone_input, ''), '[^0-9]', '', 'g');
  if length(clean_buyer_phone) not between 8 and 18 then
    raise exception 'Nomor pembeli tidak valid' using errcode = '23514';
  end if;

  dedup_phone_key := case
    when left(clean_buyer_phone, 2) = '62' and length(clean_buyer_phone) between 10 and 15
      then '0' || substr(clean_buyer_phone, 3)
    else clean_buyer_phone
  end;

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

  -- Anti-spam sekali per checkout (bukan per item).
  select count(*) into recent_duplicate_count
  from public.orders o
  where o.seller_id = target_seller_id
    and (
      case
        when left(regexp_replace(coalesce(o.buyer_phone,''),'[^0-9]','','g'),2)='62'
             and length(regexp_replace(coalesce(o.buyer_phone,''),'[^0-9]','','g')) between 10 and 15
        then '0' || substr(regexp_replace(coalesce(o.buyer_phone,''),'[^0-9]','','g'),3)
        else regexp_replace(coalesce(o.buyer_phone,''),'[^0-9]','','g')
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
        when left(regexp_replace(coalesce(o.buyer_phone,''),'[^0-9]','','g'),2)='62'
             and length(regexp_replace(coalesce(o.buyer_phone,''),'[^0-9]','','g')) between 10 and 15
        then '0' || substr(regexp_replace(coalesce(o.buyer_phone,''),'[^0-9]','','g'),3)
        else regexp_replace(coalesce(o.buyer_phone,''),'[^0-9]','','g')
      end
    ) = dedup_phone_key
    and o.created_at > now() - interval '15 minutes';
  if recent_duplicate_count >= 5 then
    raise exception 'Terlalu banyak pesanan dari nomor ini. Coba lagi beberapa menit lagi.' using errcode = '42901';
  end if;

  -- Insert 1 row minimal per item. protect_orders_fields() (trigger di
  -- atas) yang isi product_name/total_price/platform_fee/
  -- withdrawal_reserve/buyer_total/seller_earning otomatis per baris.
  for v_item in select * from jsonb_array_elements(items)
  loop
    v_product_id := (v_item->>'product_id')::uuid;
    v_qty := greatest(coalesce((v_item->>'quantity')::integer, 1), 1);
    if v_qty > 999 then
      raise exception 'Jumlah produk terlalu besar' using errcode = '23514';
    end if;

    insert into public.orders (
      seller_id, buyer_name, buyer_phone, product_id, quantity,
      payment_method, proof_image_url, order_group_id
    ) values (
      target_seller_id, clean_buyer_name, clean_buyer_phone,
      v_product_id, v_qty, clean_method, clean_proof_url, v_group_id
    ) returning id, total_price into v_new_id, v_item_total;

    if v_primary_id is null then
      v_primary_id := v_new_id;
    end if;
    v_group_total := v_group_total + coalesce(v_item_total, 0);
    v_order_ids := array_append(v_order_ids, v_new_id);
  end loop;

  -- Betulkan buyer_total row primary jadi TOTAL SELURUH keranjang (di
  -- titik insert item pertama, total item ke-2/3/dst belum diketahui).
  -- Butuh trusted flag supaya lolos dari protect_orders_fields() yang
  -- mengunci kolom ini untuk caller non-admin/non-service.
  perform set_config('nb.trusted_batch_settlement', 'on', true);
  update public.orders o
  set buyer_total = v_group_total + o.platform_fee + o.withdrawal_reserve
  where o.id = v_primary_id;
  perform set_config('nb.trusted_batch_settlement', '', true);

  return query
  select * from public.orders where id = any(v_order_ids) order by created_at asc;
end;
$$;

revoke all on function public.create_public_order_batch(uuid, jsonb, text, text, text, text) from public;
grant execute on function public.create_public_order_batch(uuid, jsonb, text, text, text, text) to anon, authenticated;

-- ============================================================
-- CATATAN TERPISAH (BELUM DI-FIX, perlu konfirmasi Rid):
-- Trigger protect_orders_fields() cabang UPDATE mengunci payment_status
-- (dan field finansial lain) untuk caller yang BUKAN admin/service_role -
-- ini sudah ada sejak migration 25/28, SEBELUM cart feature. Efeknya:
-- tombol "Tandai Dibayar"/"Batal" di seller/orders.js untuk order manual
-- (qris_manual/qris_whatsapp) kemungkinan besar SUDAH TIDAK BERFUNGSI
-- untuk seller biasa (bukan admin) - update-nya "berhasil" tanpa error,
-- tapi nilainya diam-diam dikembalikan ke nilai lama oleh trigger ini.
-- Ini BUKAN sesuatu yang saya perkenalkan - sudah ada sebelum saya audit.
-- Saya belum fix di migration ini karena di luar scope bug yang
-- dilaporkan (nominal cart) dan butuh keputusan Rid: apakah manual mark-
-- paid ini mau diaktifkan lagi untuk seller biasa (lewat RPC baru yang
-- eksplisit), atau memang sudah maunya admin-only sejak migration 28.
-- ============================================================
