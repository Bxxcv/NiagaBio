# NiagaBio File Structure

Struktur ini dipertahankan agar static hosting di Vercel dan editor mobile seperti SPCK/Acode tetap mudah dipakai.

```text
/
  index.html                  Landing page
  vercel.json                 Route, cache, dan security header Vercel
  robots.txt                  SEO crawler rules
  sitemap.xml                 Sitemap public
  site.webmanifest            PWA metadata
  favicon.ico                 Root favicon legacy
```

```text
pages/
  login.html                  Login user
  register.html               Register user
  reset-password.html         Reset password
  dashboard.html              Dashboard seller
  profile.html                Profil toko
  products.html               Produk seller
  links.html                  Link custom
  social.html                 Social links
  gallery.html                Gallery premium
  themes.html                 Tema toko
  checkout-settings.html      Pengaturan checkout seller
  orders.html                 Pesanan seller
  upgrade.html                Upgrade premium
  notifications.html          Notifikasi seller/admin
  admin.html                  Admin master
  u.html                      Public store
  checkout.html               Checkout public
  chatbot.html                Chatbot page
  maintenance.html            Maintenance page
  privacy.html                Privacy policy
  terms.html                  Terms
  refund.html                 Refund policy
  404.html                    Halaman 404
```

```text
assets/
  css/
    landing.css               Style landing page
    main.css                  Style dashboard, auth, public store
    bot.css                   Style chatbot
  js/
    config.js                 Konfigurasi Supabase/client
    supabase-client.js        Data layer utama
    common.js                 Layout guard, sidebar, notification badge
    landing.js                Interaksi landing page
    auth.js                   Login/register/reset
    dashboard.js              Dashboard seller
    profile.js                Profil toko
    products.js               CRUD produk
    links.js                  CRUD custom links
    social.js                 CRUD social links
    gallery.js                CRUD gallery
    themes.js                 Tema toko
    checkout-settings.js      Pengaturan checkout
    orders.js                 Pesanan seller
    upgrade.js                Upgrade premium
    notifications.js          Notifikasi
    admin.js                  Admin master
    public-page.js            Public store
    checkout.js               Checkout public
    chatbot.js                Chatbot
    maintenance.js            Maintenance
  img/
    brand/                    Logo dan OG image utama
    icons/                    Favicon dan PWA icons
    placeholders/             Fallback image
    preview/                  Preview/testimonial landing
```

```text
api/
  share.js                    Dynamic share preview untuk /s/:username

supabase/
  01_...sql                   Schema dan patch database
  19_production_readiness_audit.sql

docs/
  FILE_STRUCTURE.md           Dokumen struktur folder
  PRODUCTION_READINESS.md     Checklist produksi dan scaling
  PROJECT_STRUCTURE.md        Dokumentasi struktur lama
  UPDATE_GUIDE.md             Panduan update
```

Catatan penting:

- `index.html` tetap di root supaya homepage tetap langsung jalan di SPCK/Acode tanpa konfigurasi.
- HTML aplikasi ada di `pages/`, sementara URL publik tetap bersih lewat rewrite Vercel, misalnya `/login` ke `/pages/login.html`.
- Di dalam file `pages/*.html`, path asset memakai absolut seperti `/assets/...` agar aman saat dibuka dari rewrite Vercel.
- Jangan ubah nama file di `pages/` tanpa update `vercel.json`, semua link antarhalaman, dan semua path asset.
- File legacy di `assets/img/` jangan dihapus sebelum data lama Supabase dimigrasikan.
