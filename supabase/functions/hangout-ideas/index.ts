// B3.4: 3 AI hangout ideas for a circle. Called by the app (supabase.functions.invoke) with the
// user's JWT. Membership is enforced by RLS: we read the circle *as the caller*, so a
// non-member simply gets 404. Inputs to the model: group size, home_area, day of week. Nothing else.
import { userClient } from '../_shared/supabase.ts';
import { hangoutIdeas } from '../_shared/llm.ts';
import { json } from '../_shared/http.ts';
import type { HangoutIdeasRequest, HangoutIdeasResponse } from '../_shared/contract.ts';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  let body: HangoutIdeasRequest;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid JSON' }, 400);
  }
  if (!body?.circle_id || !UUID.test(body.circle_id)) return json({ error: 'circle_id required' }, 400);

  const db = userClient(req);
  const { data: auth } = await db.auth.getUser();
  if (!auth.user) return json({ error: 'not signed in' }, 401);

  const [circle, members, me] = await Promise.all([
    db.from('circles').select('home_area').eq('id', body.circle_id).maybeSingle(),
    db.from('circle_members').select('user_id', { count: 'exact', head: true }).eq('circle_id', body.circle_id),
    db.from('profiles').select('timezone').eq('id', auth.user.id).maybeSingle(),
  ]);
  if (circle.error) return json({ error: circle.error.message }, 500);
  if (!circle.data) return json({ error: 'circle not found' }, 404);

  let dayOfWeek: string;
  try {
    dayOfWeek = new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      timeZone: (me.data?.timezone as string | undefined) || 'America/New_York',
    });
  } catch {
    dayOfWeek = new Date().toLocaleDateString('en-US', { weekday: 'long', timeZone: 'America/New_York' });
  }

  const ideas = await hangoutIdeas({
    memberCount: members.count ?? 2,
    homeArea: (circle.data.home_area as string | null) ?? null,
    dayOfWeek,
  });
  const response: HangoutIdeasResponse = { ideas };
  return json(response);
});
