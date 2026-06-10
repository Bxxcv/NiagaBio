-- =========================================================
-- NiagaBio - Fix upload image validation side effect
-- Jalankan SETELAH 08_security_reaudit_final.sql dan 09_fix_storage_qris_upload_rls.sql.
--
-- Masalah yang diperbaiki:
-- - Upload QRIS/produk/gallery/avatar berhasil ke Storage, tapi save DB gagal dengan:
--   "Avatar URL tidak aman"
-- - Penyebab: validator avatar/profile terlalu kaku dan ikut memvalidasi ulang avatar lama
--   saat halaman lain menyimpan profile/checkout.
-- =========================================================

-- Validator URL gambar dibuat lebih kompatibel dengan URL Supabase public terbaru,
-- encoded slash (%2F), dan file lama dari versi project sebelumnya.
create or replace function public.is_safe_public_image_url(
  value text,
  expected_folder text default null,
  expected_user uuid default null
)
returns boolean
language plpgsql
stable
as $$
declare
  v text := lower(trim(coalesce(value, '')));
  folder text := lower(trim(coalesce(expected_folder, '')));
  uid_text text := lower(coalesce(expected_user::text, ''));
begin
  if v = '' then
    return true;
  end if;

  -- Tolak protocol berbahaya.
  if v ~ '^(javascript|data|vbscript|file|blob):' then
    return false;
  end if;

  -- Asset lokal bawaan aplikasi.
  if v ~ '^/?assets/img/[a-z0-9._/-]+\.(jpg|jpeg|png|webp|svg)(\?.*)?$' then
    return true;
  end if;

  if v !~ '^https://' then
    return false;
  end if;

  -- Supabase kadang menampilkan slash terenkripsi pada path.
  v := replace(v, '%2f', '/');

  -- External HTTPS image masih boleh selama ekstensi aman.
  if v !~ '/storage/v1/object/public/niagabio/' then
    return v ~ '\.(jpg|jpeg|png|webp)(\?.*)?$';
  end if;

  -- Tanpa folder khusus: boleh semua folder upload resmi NiagaBio.
  if folder = '' then
    return v ~ '/storage/v1/object/public/niagabio/(avatars|products|gallery|qris|premium-proofs|premium-qris|proofs)/.+\.(jpg|jpeg|png|webp)(\?.*)?$';
  end if;

  -- Bukti bayar checkout publik: path memang proofs/<file> tanpa user_id.
  if folder = 'proofs' then
    return v ~ '/storage/v1/object/public/niagabio/proofs/[^/]+\.(jpg|jpeg|png|webp)(\?.*)?$';
  end if;

  -- QRIS premium admin: path premium-qris/<admin_user_id>/<file>.
  if folder = 'premium-qris' then
    if uid_text = '' then
      return v ~ '/storage/v1/object/public/niagabio/premium-qris/[0-9a-f-]+/[^/]+\.(jpg|jpeg|png|webp)(\?.*)?$';
    end if;
    return v ~ ('/storage/v1/object/public/niagabio/premium-qris/' || uid_text || '/[^/]+\.(jpg|jpeg|png|webp)(\?.*)?$');
  end if;

  -- Folder yang wajib user-scoped.
  if folder in ('qris', 'premium-proofs') then
    if uid_text = '' then
      return false;
    end if;
    return v ~ ('/storage/v1/object/public/niagabio/' || folder || '/' || uid_text || '/[^/]+\.(jpg|jpeg|png|webp)(\?.*)?$');
  end if;

  -- Avatar/produk/gallery: terima path baru user-scoped dan path legacy lama.
  if folder in ('avatars', 'products', 'gallery') then
    if uid_text <> '' and v ~ ('/storage/v1/object/public/niagabio/' || folder || '/' || uid_text || '/[^/]+\.(jpg|jpeg|png|webp)(\?.*)?$') then
      return true;
    end if;

    -- Legacy path dari versi lama: folder/<file>.
    return v ~ ('/storage/v1/object/public/niagabio/' || folder || '/[^/]+\.(jpg|jpeg|png|webp)(\?.*)?$');
  end if;

  return false;
end;
$$;

-- Jangan validasi ulang avatar lama saat profile di-update dari halaman lain.
create or replace function public.validate_profile_public_fields()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
begin
  new.username := lower(regexp_replace(trim(coalesce(new.username, '')), '[^a-z0-9-]+', '-', 'g'));
  new.username := regexp_replace(new.username, '(^-+|-+$)', '', 'g');
  if length(new.username) < 3 or length(new.username) > 32 then
    raise exception 'Username harus 3-32 karakter' using errcode = '23514';
  end if;

  new.display_name := left(trim(coalesce(new.display_name, '')), 80);
  if length(new.display_name) < 2 then
    raise exception 'Nama toko wajib diisi' using errcode = '23514';
  end if;

  new.bio := left(coalesce(new.bio, ''), 500);
  new.whatsapp_number := regexp_replace(coalesce(new.whatsapp_number, ''), '[^0-9]', '', 'g');
  if new.whatsapp_number <> '' and length(new.whatsapp_number) not between 8 and 18 then
    raise exception 'Nomor WhatsApp tidak valid' using errcode = '23514';
  end if;

  if (TG_OP = 'INSERT') or (TG_OP = 'UPDATE' and new.avatar_url is distinct from old.avatar_url) then
    if not public.is_safe_public_image_url(coalesce(new.avatar_url, ''), 'avatars', new.user_id)
       and coalesce(new.avatar_url, '') not in ('', 'assets/img/logo.jpg', '/assets/img/logo.jpg') then
      raise exception 'Avatar URL tidak aman' using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

-- Produk: validasi gambar hanya saat insert / gambar diganti.
create or replace function public.validate_product_fields()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
begin
  new.name := left(trim(coalesce(new.name, '')), 120);
  if length(new.name) < 2 then
    raise exception 'Nama produk wajib diisi' using errcode = '23514';
  end if;

  new.description := left(coalesce(new.description, ''), 1000);
  new.category := left(trim(coalesce(new.category, '')), 80);
  new.price := greatest(coalesce(new.price, 0), 0);
  if new.price > 1000000000 then
    raise exception 'Harga produk terlalu besar' using errcode = '23514';
  end if;

  if (TG_OP = 'INSERT') or (TG_OP = 'UPDATE' and new.image_url is distinct from old.image_url) then
    if not public.is_safe_public_image_url(coalesce(new.image_url, ''), 'products', new.user_id)
       and coalesce(new.image_url, '') not in ('', 'assets/img/placeholder-product.svg', '/assets/img/placeholder-product.svg') then
      raise exception 'Gambar produk tidak aman' using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

-- Gallery: validasi gambar hanya saat insert / gambar diganti.
create or replace function public.validate_gallery_fields()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
begin
  if (TG_OP = 'INSERT') or (TG_OP = 'UPDATE' and new.image_url is distinct from old.image_url) then
    if not public.is_safe_public_image_url(new.image_url, 'gallery', new.user_id) then
      raise exception 'Gambar gallery tidak aman' using errcode = '23514';
    end if;
  end if;

  new.caption := left(coalesce(new.caption, ''), 160);
  return new;
end;
$$;

-- Checkout seller: QRIS wajib dari folder qris milik user.
create or replace function public.validate_checkout_fields()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
begin
  new.whatsapp_number := regexp_replace(coalesce(new.whatsapp_number, ''), '[^0-9]', '', 'g');
  if new.whatsapp_number <> '' and length(new.whatsapp_number) not between 8 and 18 then
    raise exception 'Nomor WhatsApp checkout tidak valid' using errcode = '23514';
  end if;

  new.qris_name := left(trim(coalesce(new.qris_name, '')), 80);
  new.payment_note := left(coalesce(new.payment_note, ''), 500);

  if (TG_OP = 'INSERT') or (TG_OP = 'UPDATE' and new.qris_image_url is distinct from old.qris_image_url) then
    if coalesce(new.qris_image_url, '') <> '' and not public.is_safe_public_image_url(new.qris_image_url, 'qris', new.user_id) then
      raise exception 'QRIS toko harus dari folder qris milik user' using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

-- Order publik: bukti bayar dari folder proofs.
create or replace function public.validate_order_public_fields()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
begin
  new.buyer_name := left(trim(coalesce(new.buyer_name, '')), 80);
  if length(new.buyer_name) < 2 then
    raise exception 'Nama pembeli wajib diisi' using errcode = '23514';
  end if;

  new.buyer_phone := regexp_replace(coalesce(new.buyer_phone, ''), '[^0-9]', '', 'g');
  if length(new.buyer_phone) not between 8 and 18 then
    raise exception 'Nomor pembeli tidak valid' using errcode = '23514';
  end if;

  if (TG_OP = 'INSERT') or (TG_OP = 'UPDATE' and new.proof_image_url is distinct from old.proof_image_url) then
    if coalesce(new.proof_image_url, '') <> '' and not public.is_safe_public_image_url(new.proof_image_url, 'proofs', null) then
      raise exception 'Bukti bayar tidak aman' using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

-- App settings: QRIS premium admin.
create or replace function public.validate_app_settings_fields()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
begin
  if not public.is_admin() then
    raise exception 'Only admin can update app settings' using errcode = '42501';
  end if;

  new.maintenance_message := left(coalesce(new.maintenance_message, ''), 300);
  new.premium_note := left(coalesce(new.premium_note, ''), 600);
  new.admin_whatsapp := regexp_replace(coalesce(new.admin_whatsapp, ''), '[^0-9]', '', 'g');
  if length(new.admin_whatsapp) not between 8 and 18 then
    raise exception 'Nomor admin tidak valid' using errcode = '23514';
  end if;

  if (TG_OP = 'INSERT') or (TG_OP = 'UPDATE' and new.premium_qris_url is distinct from old.premium_qris_url) then
    if coalesce(new.premium_qris_url, '') <> '' and not public.is_safe_public_image_url(new.premium_qris_url, 'premium-qris', null) then
      raise exception 'QRIS Premium harus dari folder premium-qris admin' using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

-- Bersihkan nilai kosong supaya save profile berikutnya tidak nyangkut.
update public.profiles
set avatar_url = 'assets/img/logo.jpg'
where avatar_url is null or trim(avatar_url) = '';

notify pgrst, 'reload schema';
