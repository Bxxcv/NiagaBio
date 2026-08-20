# Roadmap — NiagaBio

Dokumen ini adalah backlog arah produk. Untuk status teknis terkini gunakan `PRD.md` dan `SkilAi.md`.

## Prioritas aktif

### P1 — Public store themes

Rapikan tampilan semua tema toko:
- visual hierarchy
- spacing
- typography
- link/button treatment
- product card
- mobile responsive
- karakter unik setiap tema

**Batas:** jangan mengubah persistence/RPC/theme eligibility kecuali terbukti perlu.

### P2 — UX seller

- onboarding lebih jelas
- empty state yang membantu
- feedback save/error yang konsisten
- mobile interaction lebih ringkas

### P3 — Public store quality

- share preview
- SEO/metadata per toko
- performa asset
- accessibility dasar

### P4 — Notification / engagement

- realtime notification bila diperlukan
- push notification production
- cleanup notifikasi lama

### P5 — Payment evolution

Saat ini checkout masih manual/QRIS. Payment gateway otomatis hanya dikerjakan jika model bisnis, backend, webhook, signature verification, dan security siap.

## Jangan dikerjakan dulu

- migrasi framework
- payment gateway kompleks
- marketplace payout
- perubahan besar schema tanpa requirement jelas
- redesign seluruh dashboard sebelum public store themes selesai
