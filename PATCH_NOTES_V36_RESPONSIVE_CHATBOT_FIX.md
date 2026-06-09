# NiagaBio v36 - Responsive Rescue + Separate Chatbot Page

Perbaikan utama:

- Floating menu kanan bawah dibuat compact dan tidak naik terlalu jauh.
- Tombol garis 3 tetap berubah menjadi X, panel tetap dekat tombol.
- In-page chatbot popup dihapus dari landing supaya tidak pecah dan tidak memenuhi layar.
- Chat Bot diarahkan ke halaman khusus `chatbot.html` / `/chatbot`.
- Halaman chatbot bisa menerima pertanyaan seputar NiagaBio dengan jawaban FAQ lokal ringan.
- Elemen dekoratif `.scene-orb` dihapus dari HTML dan disembunyikan di CSS agar tidak muncul sebagai blok hijau/blank pada device besar.
- Efek reveal/lazy scroll dimatikan agar halaman tidak terasa menunggu loading saat scroll.
- Guard horizontal overflow diperkuat untuk mencegah putih di kanan pada semua device.
- Tidak ada perubahan Supabase, RLS, database, admin, order, checkout, atau security.

File berubah:

- `index.html`
- `assets/css/landing.css`
- `assets/js/landing.js`
- `chatbot.html`
- `assets/js/chatbot.js`
- `sitemap.xml`

Tidak perlu run SQL.
