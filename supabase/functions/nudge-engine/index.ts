// B4.3 / B4.4: nudge engine. Daily cron (after nightly-drift), or the demo screen with demo=true.
//
// For each circle:
//   1. Drift nudges: for each member whose latest drift score is_quiet, ask one friend to reach out.
//   2. Cover nudges: each other member has a COVER_RATE chance of a friendly nudge about them too,
//      so a nudge is never evidence that someone went quiet (plan §9.4).
// Both kinds are worded by the SAME call (wordNudge with first name + circle name only), pushed the
// same way, and stored the same way; only the server-side reason_kind differs.
//
// Rules: never about or to a paused user (§9.6); never about someone with auto_nudges off;
// recipients rotate (least recently nudged first) and skip anyone nudged in the last 48 h;
// at most one nudge per recipient per run; no repeat about the same person within 48 h.
//
// demo=true: re-scores drift now and runs only the demo circle (B4.8), with no cover randomness
// so the demo is predictable. The response never says which nudges are drift vs cover.
import { adminClient } from '../_shared/supabase.ts';
import { sendPush, type PushMessage } from '../_shared/push.ts';
import { authorizeJob, json } from '../_shared/http.ts';
import { wordNudge } from '../_shared/llm.ts';
import { DEMO_CIRCLE_ID } from '../_shared/demo.ts';
import type { DemoRunResponse } from '../_shared/contract.ts';

const COVER_RATE = 0.25;
const SKIP_WINDOW_MS = 48 * 3600 * 1000;

interface Planned {
  circle_id: string;
  recipient_id: string;
  about_user_id: string;
  reason_kind: 'drift' | 'cover';
}

const shuffle = <T,>(xs: T[]) => xs.map((x) => [Math.random(), x] as const).sort((a, b) => a[0] - b[0]).map(([, x]) => x);
const firstName = (name?: string) => name?.trim().split(/\s+/)[0] || 'your friend';

Deno.serve(async (req) => {
  const opts = await authorizeJob(req);
  if (!opts) return json({ error: 'unauthorized' }, 401);
  const demo = opts.demo === 'true';

  const db = adminClient();
  const now = Date.now();

  // Always (re)score first: idempotent, and covers a missed nightly run.
  const drift = await db.rpc('run_drift', {});
  if (drift.error) return json({ error: `run_drift: ${drift.error.message}` }, 500);
  const day = (drift.data as { day: string }).day;

  let scoresSel = db.from('drift_scores').select('user_id, circle_id, is_quiet').eq('day', day);
  let membersSel = db.from('circle_members').select('circle_id, user_id');
  if (demo) {
    scoresSel = scoresSel.eq('circle_id', DEMO_CIRCLE_ID);
    membersSel = membersSel.eq('circle_id', DEMO_CIRCLE_ID);
  }
  const [scoresQ, membersQ, profilesQ, consentsQ, circlesQ, recentQ] = await Promise.all([
    scoresSel,
    membersSel,
    db.from('profiles').select('id, display_name, expo_push_token'),
    db.from('consents').select('user_id, auto_nudges, paused_until'),
    db.from('circles').select('id, name'),
    db.from('nudges').select('circle_id, recipient_id, about_user_id, sent_at')
      .gte('sent_at', new Date(now - 14 * 86400_000).toISOString()),
  ]);
  for (const q of [scoresQ, membersQ, profilesQ, consentsQ, circlesQ, recentQ]) {
    if (q.error) return json({ error: q.error.message }, 500);
  }

  const profile = new Map((profilesQ.data ?? []).map((p) => [p.id as string, p]));
  const circleName = new Map((circlesQ.data ?? []).map((c) => [c.id as string, c.name as string]));
  const consent = new Map((consentsQ.data ?? []).map((c) => [c.user_id as string, c]));
  const paused = (uid: string) => {
    const p = consent.get(uid)?.paused_until as string | null | undefined;
    return !!p && new Date(p).getTime() > now;
  };
  const autoOk = (uid: string) => consent.get(uid)?.auto_nudges !== false;
  const quiet = new Set((scoresQ.data ?? []).filter((s) => s.is_quiet).map((s) => `${s.circle_id}:${s.user_id}`));

  const lastReceived = new Map<string, number>(); // `${circle}:${user}` -> ms
  const lastAbout = new Map<string, number>();
  for (const n of recentQ.data ?? []) {
    const t = new Date(n.sent_at as string).getTime();
    const rk = `${n.circle_id}:${n.recipient_id}`;
    const ak = `${n.circle_id}:${n.about_user_id}`;
    if (t > (lastReceived.get(rk) ?? 0)) lastReceived.set(rk, t);
    if (t > (lastAbout.get(ak) ?? 0)) lastAbout.set(ak, t);
  }

  const membersByCircle = new Map<string, string[]>();
  for (const m of membersQ.data ?? []) {
    const list = membersByCircle.get(m.circle_id as string) ?? [];
    list.push(m.user_id as string);
    membersByCircle.set(m.circle_id as string, list);
  }

  const planned: Planned[] = [];
  for (const [circleId, members] of membersByCircle) {
    const usedRecipients = new Set<string>();
    const recentlyAbout = (uid: string) => now - (lastAbout.get(`${circleId}:${uid}`) ?? 0) < SKIP_WINDOW_MS;

    const pickRecipient = (aboutId: string): string | null => {
      const eligible = members.filter((uid) =>
        uid !== aboutId && !paused(uid) && !usedRecipients.has(uid) &&
        now - (lastReceived.get(`${circleId}:${uid}`) ?? 0) >= SKIP_WINDOW_MS
      );
      if (eligible.length === 0) return null;
      // least recently nudged first; random among ties (e.g. never nudged)
      const ranked = shuffle(eligible).sort(
        (a, b) => (lastReceived.get(`${circleId}:${a}`) ?? 0) - (lastReceived.get(`${circleId}:${b}`) ?? 0),
      );
      usedRecipients.add(ranked[0]);
      return ranked[0];
    };

    const subjects = members.filter((uid) => !paused(uid) && autoOk(uid) && !recentlyAbout(uid));
    const quietOnes = shuffle(subjects.filter((uid) => quiet.has(`${circleId}:${uid}`)));
    const others = shuffle(subjects.filter((uid) => !quiet.has(`${circleId}:${uid}`)));

    for (const about of quietOnes) {
      const r = pickRecipient(about);
      if (r) planned.push({ circle_id: circleId, recipient_id: r, about_user_id: about, reason_kind: 'drift' });
    }
    if (!demo) {
      for (const about of others) {
        if (Math.random() >= COVER_RATE) continue;
        const r = pickRecipient(about);
        if (r) planned.push({ circle_id: circleId, recipient_id: r, about_user_id: about, reason_kind: 'cover' });
      }
    }
  }

  // Identical wording path for every nudge, whatever its reason.
  const worded = await Promise.all(
    shuffle(planned).map(async (p) => ({
      ...p,
      message: await wordNudge({
        firstName: firstName(profile.get(p.about_user_id)?.display_name as string | undefined),
        circleName: circleName.get(p.circle_id) ?? 'your circle',
      }),
    })),
  );

  let inserted: { id: string; circle_id: string; recipient_id: string; message: string }[] = [];
  if (worded.length > 0) {
    const { data, error } = await db.from('nudges').insert(worded).select('id, circle_id, recipient_id, message');
    if (error) return json({ error: error.message }, 500);
    inserted = data ?? [];
  }

  const messages: PushMessage[] = inserted.flatMap((n) => {
    const token = profile.get(n.recipient_id)?.expo_push_token as string | null | undefined;
    return token
      ? [{
        to: token,
        title: circleName.get(n.circle_id) ?? 'Sunny Side Up',
        body: n.message,
        data: { type: 'nudge' as const, circle_id: n.circle_id, target_id: n.id },
        sound: 'default' as const,
      }]
      : [];
  });
  const push = await sendPush(messages);

  const response: DemoRunResponse = {
    ok: true,
    summary: `${inserted.length} nudge${inserted.length === 1 ? '' : 's'} sent (${push.sent} pushes delivered)`,
  };
  return json(response);
});
