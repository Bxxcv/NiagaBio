# Setup Manual NiagaBio Final

Ikuti urutan ini biar tidak error.

## 1. Supabase Database

Buka Supabase → SQL Editor → New Query.

Copy semua isi file:

```txt
supabase/schema.sql
```

Lalu Run.

## 2. Storage Bucket

Buka Supabase → Storage → New bucket.

```txt
Bucket name: niagabio
Public bucket: ON
```

Lalu buka SQL Editor dan Run:

```txt
supabase/storage-policies.sql
```

## 3. Auth Setting

Buka Supabase → Authentication → Providers → Email.

Untuk MVP, matikan dulu:

```txt
Confirm email: OFF
```

## 4. Config Frontend

Edit file:

```txt
assets/js/config.js
```

Isi:

```js
SUPABASE_URL: "https://PROJECT-KAMU.supabase.co",
SUPABASE_ANON_KEY: "PUBLISHABLE_OR_ANON_KEY_KAMU",
DEMO_MODE: false
```

Jangan pernah isi secret key, service_role key, database password, atau connection string di frontend.

## 5. Jadikan Akun Admin

Daftar dulu di web memakai email admin:

```txt
unrageunrage@gmail.com
```

Lalu Run SQL:

```sql
update public.profiles
set role='admin', plan='premium', status='active', plan_end_date='2099-12-31'
where email='unrageunrage@gmail.com';
```

Setelah itu buka:

```txt
/admin
```

## 6. QRIS Upgrade Premium Admin

Ganti file placeholder ini dengan QRIS admin milik kamu:

```txt
assets/img/admin-qris.svg
```

Boleh ganti ke JPG/PNG, lalu update `PLATFORM_QRIS_IMAGE` di `assets/js/config.js`.

## 7. URL Bersih di Vercel

Project sudah memakai `vercel.json`, jadi link tampil tanpa `.html`:

```txt
/admin
/dashboard
/upgrade
/u/username
/checkout/username/productid
```

## 8. Fitur Admin

Admin panel mendukung:

- Lihat data user
- Upgrade user ke Premium
- Set user ke Free
- Blokir / unblock user
- Soft delete user
- Kirim email reset password
- Lihat request upgrade premium
- Approve / reject upgrade premium
- Maintenance mode
- Lihat order dan omset tercatat

Catatan: tombol reset password mengirim email reset ke user. Hard delete user dari Supabase Auth butuh Edge Function/service role, karena key rahasia tidak boleh ditaruh di frontend.
