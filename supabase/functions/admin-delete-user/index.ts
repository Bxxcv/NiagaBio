// Optional Supabase Edge Function: hard delete auth user.
// Deploy only if you really need hard delete from Admin panel.
// Required secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
Deno.serve(async (req) => {
  try {
    const authHeader = req.headers.get('Authorization') || '';
    const { user_id } = await req.json();
    const url = Deno.env.get('SUPABASE_URL')!;
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin = createClient(url, service);
    const userClient = createClient(url, service, { global: { headers: { Authorization: authHeader } } });
    const { data: me } = await userClient.auth.getUser();
    if (!me.user) return new Response('Unauthorized', { status: 401 });
    const { data: profile } = await admin.from('profiles').select('role,status').eq('user_id', me.user.id).single();
    if (profile?.role !== 'admin' || profile?.status !== 'active') return new Response('Forbidden', { status: 403 });
    const { error } = await admin.auth.admin.deleteUser(user_id);
    if (error) throw error;
    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: String(err?.message || err) }, { status: 400 });
  }
});
