# NiagaBio v11 - Fix Theme Gate, Maintenance, Link Icon

Patch fokus:
- Premium gate tema dibuat lebih kuat membaca plan/status/plan_end_date.
- Themes page refresh profile sebelum memilih tema supaya upgrade terbaru kebaca.
- Maintenance guard diperkuat untuk public page dan clean URL.
- Admin setting diverifikasi ulang setelah save.
- Custom link icon otomatis dari URL/judul: WhatsApp, Instagram, TikTok, Shopee, Tokopedia, Lazada, Maps, Email, Phone, GitHub, katalog/produk.

File berubah:
- assets/js/supabase-client.js
- assets/js/themes.js
- assets/js/common.js
- assets/js/public-page.js
- assets/js/admin.js
- assets/js/links.js
- assets/css/main.css
- links.html

Catatan:
- Maintenance mode sengaja tidak memblokir admin. Test pakai incognito/browser lain tanpa login admin.
- Bootstrap Icons tidak punya logo resmi Shopee/Tokopedia; digunakan icon marketplace dari Bootstrap Icons.
