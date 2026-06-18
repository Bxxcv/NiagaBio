# DESAIN.md — Panduan Desain NiagaBio

Dokumen ini dibuat supaya desain NiagaBio tetap konsisten saat diedit manual, terutama kalau pengerjaan dilakukan bertahap dari HP.

## Karakter brand

NiagaBio harus terasa:

- Ringan.
- Ramah untuk seller kecil.
- Profesional, tapi tidak kaku.
- Mudah dipakai dari HP.
- Tidak terlihat seperti template AI generik.
- Fokus ke jualan, katalog, dan checkout manual.

Hindari tampilan yang terlalu ramai, terlalu banyak badge, terlalu banyak teks marketing, atau semua section dibuat penuh warna tanpa alasan.

## Warna utama

Warna utama mengikuti logo dan konsep NiagaBio.

```txt
Primary green      : #0f9f68
Primary dark       : #08794f
Ink/dark text      : #0f172a
Muted text         : #64748b
Line/border        : #e2e8f0
Soft background    : #f4fbf7
Cream accent       : #fffaf0
Lime accent        : #d9ff52
Danger             : #ef4444
Warning            : #f59e0b
Success            : #16a34a
```

Aturan warna:

- Gunakan hijau untuk CTA utama, status sukses, dan aksen brand.
- Gunakan lime hanya sebagai aksen kecil, jangan memenuhi halaman.
- Gunakan putih/soft green untuk background agar tetap bersih.
- Hindari terlalu banyak gradient mencolok.
- Hindari kombinasi warna yang tidak nyambung dengan logo.

## Tipografi

NiagaBio memakai font sistem/browser agar ringan.

Aturan:

- Heading harus tebal dan jelas.
- Body text jangan terlalu panjang.
- Hindari kata-kata berulang seperti “super lengkap”, “fitur powerful”, “terbaik”, kalau tidak ada konteks nyata.
- Gunakan bahasa natural seperti ngobrol dengan seller.

Contoh tone yang bagus:

```txt
Bikin link toko yang rapi, gampang dibuka, dan siap dibagikan ke calon pembeli.
```

Contoh yang harus dihindari:

```txt
Platform revolusioner dengan fitur komprehensif untuk transformasi digital bisnis Anda.
```

## Layout global

### Landing page

Landing harus punya struktur:

1. Navbar ringkas.
2. Hero dengan CTA jelas.
3. Preview toko.
4. Fitur inti.
5. Cara pakai.
6. Template toko.
7. Harga.
8. Cocok untuk siapa.
9. FAQ.
10. CTA final.
11. Footer lengkap.

Aturan landing:

- Jangan terlalu penuh di mobile.
- Jangan ada overflow putih di kanan.
- CTA utama maksimal 2 tombol per section.
- Footer harus rapi, lengkap, dan punya link legal.
- Gunakan ikon seperlunya.

### Dashboard user

Dashboard harus menjawab:

- Toko saya sudah siap atau belum?
- Apa langkah berikutnya?
- Berapa order/omset saya?
- Link toko saya apa?

Komponen utama:

- Hero status toko.
- Langkah berikutnya.
- Statistik singkat.
- Aksi cepat.
- Pesanan terbaru.

Untuk user Premium, jangan tampilkan CTA beli Premium.

### Admin Master

Admin Master bukan tempat seller mengurus order produk. Admin Master untuk owner platform.

Menu yang tepat:

- Ringkasan.
- User.
- Request Premium.
- Setting platform.
- Laporan platform.

Jangan menumpuk semua section sekaligus dalam satu layar panjang. Pakai tab/section agar tidak bikin pusing.

### Public toko

Public toko harus fokus ke calon pembeli.

Urutan ideal:

1. Nama/logo toko.
2. Deskripsi singkat.
3. Tombol kontak/WhatsApp.
4. Link penting.
5. Produk.
6. Gallery jika ada.
7. Footer toko.

Aturan:

- Produk tampil 2 kolom jika layar cukup.
- Jangan tampilkan statistik internal seperti jumlah produk/link/paket pada public page.
- Nama toko Premium boleh diberi icon verified kecil.
- Footer harus center dan tidak mengganggu order.

### Checkout

Checkout harus terasa aman dan singkat.

Wajib ada:

- Tombol kembali ke toko.
- Ringkasan produk.
- Total harga.
- Data pembeli.
- QRIS/manual payment.
- Upload bukti.
- Tombol kirim order.

Jangan tampilkan logo besar NiagaBio di checkout seller, karena pembeli sedang fokus ke toko seller.

## Komponen UI

### Button

Gunakan:

- `.btn-nb` untuk aksi utama.
- `.btn-outline-nb` untuk aksi sekunder.
- Tombol danger hanya untuk aksi hapus/batal.

Label tombol harus jelas:

```txt
Tambah Produk
Lihat Toko
Kirim Pengajuan
Tandai Selesai
Batalkan Pesanan
```

Hindari label:

```txt
Submit
OK
Action
Paid
Cancel
```

### Card

Card harus punya:

- Border tipis.
- Radius cukup besar.
- Shadow lembut.
- Spacing lega.

Jangan semua card diberi warna berbeda-beda.

### Empty state

Setiap data kosong harus memberi arahan.

Contoh:

```txt
Belum ada produk.
Tambahkan produk pertama supaya toko kamu mulai bisa dibagikan.
```

Tombol:

```txt
Tambah Produk
```

### Modal

Modal hanya untuk:

- Detail user.
- Konfirmasi hapus/blokir.
- Detail order/request.

Jangan buat modal terlalu panjang di HP.

## Responsive rules

Target device:

- HP kecil 360px.
- HP besar 390–430px.
- Tablet.
- Laptop.
- Desktop.

Aturan teknis:

```css
html,
body {
  width: 100%;
  max-width: 100%;
  overflow-x: hidden;
}

img,
video,
svg,
canvas {
  max-width: 100%;
}
```

Grid mobile:

- Dashboard card: 1 kolom.
- Produk public: 2 kolom jika cukup, 1 kolom jika sangat sempit.
- Admin table: berubah jadi card/list di mobile.
- Footer: 1 kolom di mobile, multi kolom di desktop.

Jangan memakai width seperti `100vw` untuk container yang punya padding, karena sering membuat putih/overflow kanan.

## Animasi

Gunakan animasi ringan:

- Fade up 300–500ms.
- Hover kecil.
- Transition opacity/transform.

Hindari:

- Parallax berat.
- Animasi terus-menerus.
- Box-shadow besar di banyak elemen.
- Script scroll berat.

Gunakan IntersectionObserver untuk reveal. Jika browser tidak support, konten tetap harus terlihat.

## Template toko

Template harus beda layout, bukan cuma beda warna.

Contoh kategori template:

1. Seller Green — UMKM harian.
2. Clean Minimal — toko simpel.
3. Editorial Fashion — fashion/thrift.
4. Tech Dashboard — jasa digital/gadget.
5. Warm Menu — makanan/minuman.
6. Soft Beauty — beauty/skincare.
7. Black Drop — brand gelap/premium.
8. Gold Signature — luxury/personal brand.
9. Neon Creator — kreator/digital product.
10. Creator Brutalist — portfolio/produk digital dengan border tebal.

Setiap template minimal beda:

- Hero.
- Card produk.
- Tombol.
- Spacing.
- Background.
- Font weight/feel.

## Copywriting

Gunakan bahasa yang sederhana dan natural.

Ganti kalimat kaku:

```txt
User premium upload QRIS miliknya sendiri. Pembeli upload bukti, lalu seller konfirmasi paid.
```

Menjadi:

```txt
Upload QRIS tokomu, terima bukti pembayaran, lalu tandai pesanan selesai setelah dicek.
```

Ganti:

```txt
Platform terbaik dengan fitur lengkap.
```

Menjadi:

```txt
Satu link untuk katalog, kontak, checkout manual, dan rekap pesanan.
```

## Icon

Gunakan Bootstrap Icons.

Icon yang cocok:

- WhatsApp: `bi-whatsapp`
- Instagram: `bi-instagram`
- TikTok: `bi-tiktok`
- QRIS/payment: `bi-qr-code-scan`
- Produk: `bi-bag-heart`
- Rekap: `bi-graph-up-arrow`
- Notifikasi: `bi-bell`
- Verified: `bi-patch-check-fill`

Jangan pakai emoji sebagai pengganti icon.

## Hal yang jangan dilakukan

- Jangan ubah framework ke React.
- Jangan masukkan service_role key ke frontend.
- Jangan menambah library berat untuk animasi.
- Jangan membuat semua section penuh gradient.
- Jangan menampilkan fitur internal seller di public page.
- Jangan membuat Admin Master terlalu penuh dalam satu layar.
- Jangan membuat copywriting terlalu kaku seperti template AI.
- Jangan pakai URL/file user tanpa sanitizer.
- Jangan hapus file SQL/security tanpa memahami efeknya.

## Checklist visual sebelum deploy

```txt
1. Landing tidak ada putih/overflow kanan di HP.
2. Navbar mobile bisa dibuka dan ditutup.
3. Footer rapi di HP dan desktop.
4. Admin Master tidak penuh dan tidak bikin pusing.
5. Public toko fokus ke pembeli.
6. Checkout singkat dan jelas.
7. Dashboard user memberi arahan langkah berikutnya.
8. Empty state tidak kosong mentah.
9. Semua tombol punya label jelas.
10. Tidak ada teks kaku/aneh.
```
