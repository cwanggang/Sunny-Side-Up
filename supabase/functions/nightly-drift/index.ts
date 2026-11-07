// B4.1 / B4.2: nightly drift. Cron (08:00 UTC) or demo. Rebuilds engagement_daily for the last
// 18 days and scores yesterday (or opts.day = YYYY-MM-DD). All logic is SQL: public.run_drift().
// The response carries counts only, never who is quiet.
import { adminClient } from '../_shared/supabase.ts';
import { authorizeJob, json } from '../_shared/http.ts';

Deno.serve(async (req) => {
  const opts = await authorizeJob(req);
  if (!opts) return json({ error: 'unauthorized' }, 401);
  const day = opts.day && /^\d{4}-\d{2}-\d{2}$/.test(opts.day) ? opts.day : null;

  const { data, error } = await adminClient().rpc('run_drift', day ? { p_day: day } : {});
  if (error) return json({ error: error.message }, 500);
  const r = data as { day: string; scores: number };
  return json({ ok: true, summary: `Scored ${r.scores} member-circles for ${r.day}` });
});
