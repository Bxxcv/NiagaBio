-- ============================================================
-- STAGE23 / Migration 36 — Cart + Order Tracking + P0 Security Fix
-- ============================================================
-- Konteks: audit menemukan bug forgery payment_status (lihat
-- docs/patch-notes/STAGE23_CART_ORDER_TRACKING.md). Migration ini:
--   1) Nutup celah: seller bisa flip payment_status='paid' langsung
--      dari client untuk order qris_buatqris (bypass BuatQris).
--   2) Nambah order_group_id + order_status (fulfillment, terpisah
--      dari payment_status) supaya checkout multi-item (cart) bisa
--      jalan tanpa mengubah struktur 1-row-per-produk yang sudah ada.
--   3) RPC baru: create_public_order_batch (checkout cart),
--      update_order_status (seller ubah status pesanan),
--      get_order_group_tracking (buyer lacak pesanan tanpa akun).
--   4) apply_buatqris_payment_event: cascade settlement ke semua
--      order dalam 1 order_group_id, bukan cuma 1 row primary.
--
-- Aman dijalankan ulang (idempotent): pakai IF NOT EXISTS / DROP...
-- IF EXISTS sebelum ADD, sesuai konvensi migration sebelumnya.
-- ============================================================

-- ------------------------------------------------------------
-- 1) SKEMA: orders.order_group_id + orders.order_status
-- ------------------------------------------------------------
alter table public.orders
  add column if not exists order_group_id uuid,
  add column if not exists order_status text not null default 'pending';

-- Backfill baris lama: tiap order lama jadi grup isi 1 (dirinya sendiri).
update public.orders set order_group_id = id where order_group_id is null;

alter table public.orders alter column order_group_id set not null;
alter table public.orders alter column order_group_id set default gen_random_uuid();

alter table public.orders drop constraint if exists orders_order_status_check;
alter table public.orders add constraint orders_order_status_check
  check (order_status in ('pending','processing','ready','completed','cancelled'));

create index if not exists idx_orders_order_group_id on public.orders(order_group_id);
create index if not exists idx_orders_seller_order_status on public.orders(seller_id, order_status);

-- ------------------------------------------------------------
-- 2) TABEL BARU: order_status_history (riwayat perubahan status)
-- ------------------------------------------------------------
create table if not exists public.order_status_history (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders(id) on delete cascade not null,
  old_status text,
  new_status text not null,
  changed_by uuid references auth.users(id) on delete set null,
  changed_at timestamptz not null default now()
);

create index if not exists idx_order_status_history_order_id
  on public.order_status_history(order_id);

alter table public.order_status_history enable row level security;

drop policy if exists "order_status_history_select_seller_or_admin" on public.order_status_history;
create policy "order_status_history_select_seller_or_admin"
on public.order_status_history for select
to authenticated
using (
  exists (
    select 1 from public.orders o
    where o.id = order_status_history.order_id
      and (o.seller_id = auth.uid() or public.is_admin())
  )
);
-- Tidak ada insert/update/delete policy untuk anon/authenticated dengan
-- sengaja: baris history HANYA boleh masuk lewat update_order_status()
-- (security definer), bukan ditulis langsung dari client.

-- ------------------------------------------------------------
-- 3) FIX P0: payment_status order qris_buatqris cuma boleh berubah
--    lewat webhook (service_role). Manual (qris_manual/qris_whatsapp)
--    TETAP boleh di-flip seller — itu memang alur konfirmasi manual.
--
--    ROOT CAUSE bug lama: RLS orders_update_seller_or_admin izinkan
--    seller update kolom apapun di order miliknya (termasuk
--    payment_status), dan seller_earning sudah keisi penuh saat
--    insert (create_public_order). Tombol "Selesai" di orders.js
--    (NB.save('orders', {id, payment_status:'paid'})) jadi bisa
--    forge payment gateway tanpa lewat BuatQris sama sekali.
-- ------------------------------------------------------------
create or replace function public.validate_order_public_fields()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
begin
  if new.payment_method not in ('whatsapp', 'qris_manual', 'qris_whatsapp', 'qris_buatqris') then
    raise exception 'Metode pembayaran tidak didukung' using errcode = '23514';
  end if;

  -- Manual methods require uploaded proof. Gateway orders settle via webhook.
  if new.payment_method in ('qris_manual', 'qris_whatsapp')
    and coalesce(new.proof_image_url, '') = '' then
    raise exception 'Bukti pembayaran wajib diunggah untuk QRIS manual' using errcode = '23514';
  end if;

  if TG_OP = 'UPDATE'
    and old.payment_method = 'qris_buatqris'
    and new.payment_status is distinct from old.payment_status
    and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Status pembayaran qris_buatqris hanya bisa diubah lewat webhook BuatQris' using errcode = '42501';
  end if;

  return new;
end;
$$;
-- Trigger `validate_order_public_fields_v26_order_methods` yang sudah ada
-- (migration 26) TIDAK perlu dibuat ulang — dia sudah memanggil fungsi ini
-- by name, jadi otomatis ikut logic baru begitu CREATE OR REPLACE di atas
-- dijalankan.

-- ------------------------------------------------------------
-- 4) RPC BARU: create_public_order_batch — checkout multi-item (cart)
--    Pola validasi & anti-spam disalin dari create_public_order
--    (migration 32) supaya konsisten, cuma dijalankan sekali per
--    checkout (bukan per item) dan platform_fee/withdrawal_reserve
--    cuma dikenakan di item pertama (keputusan Rid: 1x per checkout).
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
  setting_platform_fee numeric := 1000;
  setting_withdrawal_reserve numeric := 2500;
  v_group_id uuid := gen_random_uuid();
  v_item jsonb;
  v_product_id uuid;
  v_qty integer;
  v_product_owner uuid;
  v_product_title text;
  v_product_price numeric;
  v_product_active boolean;
  v_item_total numeric;
  v_items_grand_total numeric := 0;
  v_is_first boolean;
  v_valid_items jsonb := '[]'::jsonb;
  inserted_order public.orders;
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

  if not public.is_active_user(target_seller_id) then
    raise exception 'Seller sedang tidak aktif' using errcode = '42501';
  end if;

  -- Anti-spam sekali per checkout (bukan per item), window & ambang batas
  -- sama seperti create_public_order (2 menit / >0, 15 menit / >=5).
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

  select greatest(coalesce(platform_fee, 1000), 0), greatest(coalesce(withdrawal_reserve, 2500), 0)
  into setting_platform_fee, setting_withdrawal_reserve
  from public.app_settings
  where id = 'global';

  -- Pass 1: validasi tiap item + hitung grand total produk.
  for v_item in select * from jsonb_array_elements(items)
  loop
    v_product_id := (v_item->>'product_id')::uuid;
    v_qty := greatest(coalesce((v_item->>'quantity')::integer, 1), 1);
    if v_qty > 999 then
      raise exception 'Jumlah produk terlalu besar' using errcode = '23514';
    end if;

    select p.user_id, p.name, coalesce(p.price, 0), p.is_active
    into v_product_owner, v_product_title, v_product_price, v_product_active
    from public.products p
    where p.id = v_product_id;

    if v_product_owner is null then
      raise exception 'Produk tidak ditemukan' using errcode = '23503';
    end if;
    if v_product_owner <> target_seller_id or v_product_active is not true then
      raise exception 'Produk tidak valid untuk seller ini' using errcode = '23514';
    end if;

    v_item_total := v_product_price * v_qty;
    v_items_grand_total := v_items_grand_total + v_item_total;

    v_valid_items := v_valid_items || jsonb_build_object(
      'product_id', v_product_id,
      'product_name', v_product_title,
      'quantity', v_qty,
      'total_price', v_item_total
    );
  end loop;

  -- Pass 2: insert 1 row per item. Fee cuma di item pertama.
  v_is_first := true;
  for v_item in select * from jsonb_array_elements(v_valid_items)
  loop
    insert into public.orders (
      seller_id, buyer_name, buyer_phone, product_id, product_name, quantity,
      total_price, payment_method, payment_status, proof_image_url, paid_at,
      order_group_id, order_status,
      platform_fee, withdrawal_reserve, gateway_fee, buyer_total, seller_earning,
      platform_earning, payment_provider, created_at, updated_at
    ) values (
      target_seller_id, clean_buyer_name, clean_buyer_phone,
      (v_item->>'product_id')::uuid, v_item->>'product_name', (v_item->>'quantity')::integer,
      (v_item->>'total_price')::numeric, clean_method, 'pending', clean_proof_url, null,
      v_group_id, 'pending',
      case when v_is_first then setting_platform_fee else 0 end,
      case when v_is_first then setting_withdrawal_reserve else 0 end,
      0,
      case when v_is_first
        then v_items_grand_total + setting_platform_fee + setting_withdrawal_reserve
        else (v_item->>'total_price')::numeric
      end,
      (v_item->>'total_price')::numeric, 0,
      case when clean_method = 'qris_buatqris' then 'buatqris' else '' end,
      now(), now()
    ) returning * into inserted_order;

    v_is_first := false;
    return next inserted_order;
  end loop;

  return;
end;
$$;

revoke all on function public.create_public_order_batch(uuid, jsonb, text, text, text, text) from public;
grant execute on function public.create_public_order_batch(uuid, jsonb, text, text, text, text) to anon, authenticated;

-- ------------------------------------------------------------
-- 5) RPC BARU: update_order_status — seller/admin ubah status
--    fulfillment (terpisah dari payment_status). Insert history.
-- ------------------------------------------------------------
create or replace function public.update_order_status(
  p_order_id uuid,
  p_new_status text
)
returns public.orders
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  order_row public.orders;
  clean_status text := lower(trim(coalesce(p_new_status, '')));
begin
  if clean_status not in ('pending','processing','ready','completed','cancelled') then
    raise exception 'Status pesanan tidak valid' using errcode = '23514';
  end if;

  select * into order_row from public.orders where id = p_order_id for update;
  if order_row.id is null then
    raise exception 'Order tidak ditemukan' using errcode = 'P0002';
  end if;

  if order_row.seller_id <> auth.uid() and not public.is_admin() then
    raise exception 'Tidak diizinkan mengubah order ini' using errcode = '42501';
  end if;

  if order_row.order_status = clean_status then
    return order_row;
  end if;

  if order_row.order_status in ('completed','cancelled') then
    raise exception 'Order sudah final (selesai/dibatalkan), status tidak bisa diubah lagi' using errcode = '42501';
  end if;

  insert into public.order_status_history (order_id, old_status, new_status, changed_by)
  values (order_row.id, order_row.order_status, clean_status, auth.uid());

  update public.orders
  set order_status = clean_status, updated_at = now()
  where id = order_row.id
  returning * into order_row;

  return order_row;
end;
$$;

revoke all on function public.update_order_status(uuid, text) from public;
grant execute on function public.update_order_status(uuid, text) to authenticated;

-- ------------------------------------------------------------
-- 6) RPC BARU: get_order_group_tracking — buyer lacak pesanan
--    tanpa akun (order_group_id + no. HP sebagai verifikasi ringan).
--    SENGAJA tidak mengembalikan seller_earning/platform_earning/
--    gateway_fee — itu data internal seller/platform, bukan buyer.
-- ------------------------------------------------------------
create or replace function public.get_order_group_tracking(
  p_order_group_id uuid,
  p_buyer_phone text
)
returns table (
  order_id uuid,
  product_name text,
  quantity integer,
  total_price numeric,
  platform_fee numeric,
  withdrawal_reserve numeric,
  payment_status text,
  order_status text,
  payment_method text,
  created_at timestamptz,
  seller_display_name text,
  seller_username text
)
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  clean_phone text := regexp_replace(coalesce(p_buyer_phone, ''), '[^0-9]', '', 'g');
  phone_key text;
  match_count integer;
begin
  if p_order_group_id is null or clean_phone = '' then
    raise exception 'Order ID dan nomor WhatsApp wajib diisi' using errcode = '23514';
  end if;

  phone_key := case
    when left(clean_phone, 2) = '62' and length(clean_phone) between 10 and 15
      then '0' || substr(clean_phone, 3)
    else clean_phone
  end;

  select count(*) into match_count
  from public.orders o
  where o.order_group_id = p_order_group_id
    and (
      case
        when left(regexp_replace(coalesce(o.buyer_phone,''),'[^0-9]','','g'),2)='62'
             and length(regexp_replace(coalesce(o.buyer_phone,''),'[^0-9]','','g')) between 10 and 15
        then '0' || substr(regexp_replace(coalesce(o.buyer_phone,''),'[^0-9]','','g'),3)
        else regexp_replace(coalesce(o.buyer_phone,''),'[^0-9]','','g')
      end
    ) = phone_key;

  if match_count = 0 then
    raise exception 'Order tidak ditemukan atau nomor WhatsApp tidak cocok' using errcode = 'P0002';
  end if;

  return query
  select o.id, o.product_name, o.quantity, o.total_price, o.platform_fee,
         o.withdrawal_reserve, o.payment_status, o.order_status, o.payment_method,
         o.created_at, p.display_name, p.username
  from public.orders o
  join public.profiles p on p.user_id = o.seller_id
  where o.order_group_id = p_order_group_id
  order by o.created_at asc;
end;
$$;

revoke all on function public.get_order_group_tracking(uuid, text) from public;
grant execute on function public.get_order_group_tracking(uuid, text) to anon, authenticated;

-- ------------------------------------------------------------
-- 7) apply_buatqris_payment_event — cascade settlement ke seluruh
--    order_group_id (bukan cuma 1 row primary). Signature SAMA
--    PERSIS dengan migration 28 (dipanggil api/payment/webhook.js
--    & api/payment/status.js) — jangan diubah.
-- ------------------------------------------------------------
create or replace function public.apply_buatqris_payment_event(
  p_transaction_id text,
  p_status text,
  p_amount numeric default 0,
  p_total_amount numeric default 0,
  p_credit_amount numeric default 0,
  p_admin_fee numeric default 0,
  p_qris_method text default '',
  p_paid_at timestamptz default null,
  p_expires_at timestamptz default null,
  p_delivery_id text default '',
  p_event_type text default '',
  p_is_test boolean default false
)
returns public.payment_transactions
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  tx public.payment_transactions;
  clean_status text := lower(trim(coalesce(p_status, 'pending')));
  order_row public.orders;
  effective_is_test boolean;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Service role required' using errcode = '42501';
  end if;

  if clean_status not in ('pending','success','expired','failed','cancelled') then
    raise exception 'Invalid provider status' using errcode = '22023';
  end if;

  select * into tx
  from public.payment_transactions
  where provider = 'buatqris'
    and provider_transaction_id = trim(p_transaction_id)
  for update;

  if tx.id is null then
    raise exception 'Payment transaction not found' using errcode = 'P0002';
  end if;

  effective_is_test := coalesce(tx.is_test, false) or coalesce(p_is_test, false);

  update public.payment_transactions
  set status = clean_status,
      provider_total_amount = greatest(coalesce(p_total_amount, 0), 0),
      gateway_fee = greatest(coalesce(p_admin_fee, 0), 0),
      provider_credit_amount = greatest(coalesce(p_credit_amount, 0), 0),
      qris_method = left(coalesce(p_qris_method, ''), 50),
      expires_at = coalesce(p_expires_at, expires_at),
      paid_at = case when clean_status = 'success' then coalesce(p_paid_at, now()) else paid_at end,
      last_webhook_delivery_id = left(coalesce(p_delivery_id, ''), 120),
      last_event_type = left(coalesce(p_event_type, ''), 80),
      is_test = effective_is_test,
      updated_at = now()
  where id = tx.id
  returning * into tx;

  select * into order_row from public.orders where id = tx.order_id for update;
  if order_row.id is null then
    raise exception 'Order not found for payment transaction' using errcode = 'P0002';
  end if;

  -- Already settled: keep idempotent, do not recompute earnings.
  if order_row.payment_status = 'paid' and clean_status <> 'success' then
    update public.orders set is_test = effective_is_test where id = order_row.id;
    return tx;
  end if;

  if clean_status = 'success' then
    if order_row.payment_status = 'paid' then
      -- Duplicate success webhook: refresh provider refs only, cascade ke grup.
      update public.orders
      set provider_status = 'success',
          provider_transaction_id = tx.provider_transaction_id,
          payment_provider = 'buatqris',
          is_test = effective_is_test,
          updated_at = now()
      where order_group_id = order_row.order_group_id;
    else
      -- Settle SEMUA order row dalam 1 order_group_id (hasil cart
      -- checkout), bukan cuma row primary yang dipegang payment_transactions.
      -- Tiap row pakai total_price/platform_fee miliknya sendiri (sudah
      -- diisi benar saat insert oleh create_public_order_batch), jadi
      -- seller_earning & platform_earning per-row otomatis tetap benar.
      update public.orders
      set payment_status = 'paid',
          paid_at = coalesce(p_paid_at, now()),
          provider_status = 'success',
          seller_earning = total_price,
          platform_earning = platform_fee,
          payment_provider = 'buatqris',
          provider_transaction_id = tx.provider_transaction_id,
          is_test = effective_is_test,
          updated_at = now()
      where order_group_id = order_row.order_group_id
        and payment_status <> 'paid';

      -- Field yang cuma relevan di level transaksi (bukan per-item) tetap
      -- cuma disimpan di row primary yang benar-benar terhubung ke QR ini.
      update public.orders
      set gateway_fee = greatest(coalesce(p_admin_fee, 0), 0),
          buyer_total = greatest(coalesce(p_total_amount, buyer_total), buyer_total),
          payment_expires_at = coalesce(p_expires_at, payment_expires_at)
      where id = order_row.id;
    end if;
  elsif clean_status in ('expired','failed','cancelled') then
    update public.orders
    set payment_status = 'cancelled',
        paid_at = null,
        provider_status = clean_status,
        payment_provider = 'buatqris',
        provider_transaction_id = tx.provider_transaction_id,
        payment_expires_at = coalesce(p_expires_at, payment_expires_at),
        is_test = effective_is_test,
        updated_at = now()
    where order_group_id = order_row.order_group_id and payment_status <> 'paid';
  else
    update public.orders
    set provider_status = 'pending',
        payment_provider = 'buatqris',
        provider_transaction_id = tx.provider_transaction_id,
        payment_expires_at = coalesce(p_expires_at, payment_expires_at),
        is_test = effective_is_test,
        updated_at = now()
    where order_group_id = order_row.order_group_id and payment_status = 'pending';
  end if;

  return tx;
end;
$$;

revoke all on function public.apply_buatqris_payment_event(text,text,numeric,numeric,numeric,numeric,text,timestamptz,timestamptz,text,text,boolean) from public, anon, authenticated;
grant execute on function public.apply_buatqris_payment_event(text,text,numeric,numeric,numeric,numeric,text,timestamptz,timestamptz,text,text,boolean) to service_role;
