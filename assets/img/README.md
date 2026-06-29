# Image Assets

Struktur utama:

- `brand/` untuk logo dan gambar Open Graph.
- `icons/` untuk favicon, PWA icon, dan apple touch icon.
- `placeholders/` untuk gambar fallback seperti produk kosong.
- `preview/` untuk foto/preview yang tampil di landing page.

File lama di root folder ini sengaja tetap disimpan sebagai compatibility alias.
Alasannya: data lama di Supabase atau local fallback bisa saja masih menyimpan path seperti `assets/img/logo.jpg` atau `assets/img/placeholder-product.svg`.
Jangan hapus file legacy sebelum data lama dimigrasikan.
