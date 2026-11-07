// B4.7: reset the demo circle to the B4.8 seed (public.demo_reseed). Demo key only.
import { adminClient } from '../_shared/supabase.ts';
import { isDemoRequest, json } from '../_shared/http.ts';
import type { DemoRunResponse } from '../_shared/contract.ts';

Deno.serve(async (req) => {
  if (!isDemoRequest(req)) return json({ error: 'unauthorized' }, 401);

  const { data, error } = await adminClient().rpc('demo_reseed', {});
  if (error) {
    // e.g. "Demo accounts not signed up yet: ..." -> show it on the demo screen
    const response: DemoRunResponse = { ok: false, summary: error.message };
    return json(response, 409);
  }
  const r = data as { interactions: number; reactions: number; app_opens: number };
  const response: DemoRunResponse = {
    ok: true,
    summary: `Demo reset: ${r.interactions} interactions, ${r.reactions} reactions, ${r.app_opens} app opens over 21 days`,
  };
  return json(response);
});
