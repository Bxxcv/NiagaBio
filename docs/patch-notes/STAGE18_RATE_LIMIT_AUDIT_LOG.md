# Stage 18 - Rate Limit + Audit Log Hardening

Patch ini menutup sisa catatan audit Qwen yang masih relevan setelah tahap sebelumnya:

- `/api/share` diberi rate limit ringan berbasis IP. Ini best-effort karena berjalan di serverless/Vercel, bukan pengganti WAF.
- Direct insert order baru dari frontend production dimatikan. Order baru wajib lewat `createPublicOrder()` agar validasi database tetap dipakai.
- Ditambahkan `public.audit_logs` untuk jejak aksi admin penting.
- Ditambahkan trigger audit untuk perubahan field sensitif profile, premium request, password reset request, dan app settings.

## File berubah

- `api/share.js`
- `assets/js/supabase-client.js`
- `supabase/18_rate_limit_audit_log_hardening.sql`
- `docs/patch-notes/STAGE18_RATE_LIMIT_AUDIT_LOG.md`

## Cara pasang

1. Replace file dari patch ZIP.
2. Deploy ulang ke Vercel.
3. Jalankan SQL:
   `supabase/18_rate_limit_audit_log_hardening.sql`
4. Test admin action:
   - block/unblock user
   - approve/reject premium request
   - update app settings/maintenance
   - update password reset request
5. Cek log:

```sql
select action, target_table, target_id, target_user_id, created_at, metadata
from public.audit_logs
order by created_at desc
limit 20;
```

## Catatan

Audit log hanya terbaca admin lewat RLS `is_admin()`. Non-admin tidak bisa membaca log.
