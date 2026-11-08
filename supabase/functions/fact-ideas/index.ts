// Design v0.4: "suggest categories" for profile facts. Called by the app with the user's JWT.
// Input is only the category names the person already has (never their answers).
import { userClient } from '../_shared/supabase.ts';
import { factIdeas } from '../_shared/llm.ts';
import { json } from '../_shared/http.ts';
import type { FactIdeasRequest, FactIdeasResponse } from '../_shared/contract.ts';

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);
  const db = userClient(req);
  const { data: auth } = await db.auth.getUser();
  if (!auth.user) return json({ error: 'not signed in' }, 401);

  let body: Partial<FactIdeasRequest> = {};
  try {
    body = await req.json();
  } catch {
    // empty body: no existing categories
  }
  const raw: unknown[] = Array.isArray(body.have) ? body.have : [];
  const have = raw.filter((x): x is string => typeof x === 'string').map((x) => x.slice(0, 40)).slice(0, 20);
  const response: FactIdeasResponse = await factIdeas(have);
  return json(response);
});
