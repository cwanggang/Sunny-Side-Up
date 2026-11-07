// Service-role client for Edge Functions. Bypasses RLS: only use server-side, never return
// raw rows to a client without filtering. SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are
// injected automatically by the Edge runtime.
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.118.0';

let admin: SupabaseClient | null = null;

export function adminClient(): SupabaseClient {
  if (!admin) {
    const url = Deno.env.get('SUPABASE_URL');
    const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !key) throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set');
    admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  }
  return admin;
}

/** Client that acts as the calling user (RLS applies). Use for user-facing functions. */
export function userClient(req: Request): SupabaseClient {
  const url = Deno.env.get('SUPABASE_URL')!;
  const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
  return createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  });
}
