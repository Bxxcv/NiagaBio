# Patch Notes - Route Asset + Username + Config ENV

## Yang dipatch

1. `u.html`
   - Asset publik diganti dari `assets/...` menjadi `/assets/...`.
   - Fix untuk route Vercel `/u/:username` agar CSS/JS tidak dicari ke `/u/assets/...`.

2. `checkout.html`
   - Asset checkout diganti dari `assets/...` menjadi `/assets/...`.
   - Fix untuk route Vercel `/checkout/:username/:product` agar CSS/JS tidak dicari ke `/checkout/.../assets/...`.

3. `assets/js/supabase-client.js`
   - Tambah `makeSafeUsername()`.
   - Register lebih aman untuk email/nama pendek.
   - Jika username duplicate saat membuat profile Supabase, sistem retry dengan suffix random.

## Catatan config.js

`SUPABASE_URL` dan `SUPABASE_ANON_KEY` boleh public di frontend selama RLS aktif dan policy benar.
Yang tidak boleh public: `service_role`, token admin, private API key, secret webhook, SMTP password.

Di project vanilla static, `.env` tidak otomatis kebaca browser. Kalau ingin pakai `.env`, gunakan build step untuk generate `assets/js/config.js` saat deploy, tapi hasil akhirnya tetap akan terlihat di browser.
