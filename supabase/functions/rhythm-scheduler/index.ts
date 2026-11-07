// B3.1–B3.3: hourly rhythm scheduler (pg_cron -> pg_net -> here).
//   B3.1 Sunday share: on Sunday from 10:00 local, notify "share your week" once per user/circle/week.
//   B3.2 Spotlight: keep spotlight_days filled 7 days ahead; from 09:00 local, notify today's person.
//        Quiet members are rotated in a little sooner (never visible anywhere).
//   B3.3 Birthdays (day before + day of) and moments (morning of occurs_on), from 09:00 local.
//        Day-of birthday and moment reminders are also stored as nudges for the Nudges tab.
// Everything is a `notifications` row (plan §3.0: no remote push), created between 09:00 and 21:00
// in the *recipient's* timezone, once each (claimed atomically in scheduler_log). Paused users get
// none, and no reminders are sent about paused users (plan §9.6).
//
// Auth: the cron webhook secret, or the demo key. Option `now=<iso>` (query string with the demo
// key, JSON body via webhook) pretends it's that time and skips the once-only check, so the demo
// can be re-run.
import { adminClient } from '../_shared/supabase.ts';
import { notify } from '../_shared/notify.ts';
import { authorizeJob, json } from '../_shared/http.ts';
import { addDays, isBirthdayOn, localTime } from '../_shared/time.ts';
import type { DemoRunResponse, NotificationType } from '../_shared/contract.ts';

const FIRST_HOUR = 9;
const SUNDAY_HOUR = 10;
const LAST_HOUR = 21; // exclusive
const SPOTLIGHT_DAYS_AHEAD = 7;

interface Member { circle_id: string; user_id: string; joined_at: string }
interface Profile { id: string; display_name: string; birthday: string | null; timezone: string }
interface Candidate {
  log: { kind: string; user_id: string; circle_id: string; period_key: string };
  title: string;
  body: string;
  data: { type: NotificationType; circle_id: string; target_id?: string };
  nudge?: { about_user_id: string; reason_kind: 'birthday' | 'moment' };
}

const firstName = (p?: Profile) => p?.display_name.trim().split(/\s+/)[0] || 'A friend';

Deno.serve(async (req) => {
  const opts = await authorizeJob(req);
  if (!opts) return json({ error: 'unauthorized' }, 401);

  const demo = Boolean(opts.now); // forced time -> re-runnable demo
  const now = opts.now ? new Date(opts.now) : new Date();
  if (Number.isNaN(now.getTime())) return json({ error: 'bad ?now=' }, 400);

  const db = adminClient();
  const utcToday = now.toISOString().slice(0, 10);

  // ---------- load (small data: one query per table) ----------
  const [circlesQ, membersQ, profilesQ, consentsQ, spotQ, momentsQ, quietQ] = await Promise.all([
    db.from('circles').select('id, name'),
    db.from('circle_members').select('circle_id, user_id, joined_at'),
    db.from('profiles').select('id, display_name, birthday, timezone'),
    db.from('consents').select('user_id, paused_until'),
    db.from('spotlight_days').select('circle_id, day, user_id').gte('day', addDays(utcToday, -30)),
    db.from('moments').select('id, circle_id, user_id, title, occurs_on')
      .gte('occurs_on', addDays(utcToday, -1)).lte('occurs_on', addDays(utcToday, 1)),
    db.from('drift_scores').select('user_id, circle_id').eq('is_quiet', true).gte('day', addDays(utcToday, -3)),
  ]);
  for (const q of [circlesQ, membersQ, profilesQ, consentsQ, spotQ, momentsQ, quietQ]) {
    if (q.error) return json({ error: q.error.message }, 500);
  }

  const circleName = new Map((circlesQ.data ?? []).map((c) => [c.id as string, c.name as string]));
  const profiles = new Map((profilesQ.data as Profile[]).map((p) => [p.id, p]));
  const paused = new Set(
    (consentsQ.data ?? []).filter((c) => c.paused_until && new Date(c.paused_until) > now).map((c) => c.user_id as string),
  );
  const quiet = new Set((quietQ.data ?? []).map((q) => `${q.circle_id}:${q.user_id}`));
  const membersByCircle = new Map<string, Member[]>();
  for (const m of membersQ.data as Member[]) {
    if (!membersByCircle.has(m.circle_id)) membersByCircle.set(m.circle_id, []);
    membersByCircle.get(m.circle_id)!.push(m);
  }
  const spotlight = new Map<string, string>(); // `${circle}:${day}` -> user
  for (const s of spotQ.data ?? []) spotlight.set(`${s.circle_id}:${s.day}`, s.user_id as string);

  // ---------- B3.2: fill spotlight_days ahead ----------
  const newSpotlights: { circle_id: string; day: string; user_id: string }[] = [];
  for (const [circleId, members] of membersByCircle) {
    const eligible = members.filter((m) => !paused.has(m.user_id));
    if (eligible.length === 0) continue;
    const refTz = profiles.get(members[0].user_id)?.timezone;
    const start = localTime(now, refTz).date;

    // last spotlight day per member (from history + what we assign now)
    const last = new Map<string, string>();
    for (const [key, uid] of spotlight) {
      const [cid, day] = key.split(':');
      if (cid === circleId && (!last.has(uid) || day > last.get(uid)!)) last.set(uid, day);
    }
    for (let i = 0; i <= SPOTLIGHT_DAYS_AHEAD; i++) {
      const day = addDays(start, i);
      if (spotlight.has(`${circleId}:${day}`)) continue;
      const prev = spotlight.get(`${circleId}:${addDays(day, -1)}`);
      const ranked = eligible
        .filter((m) => eligible.length === 1 || m.user_id !== prev)
        .map((m) => {
          const lastDay = last.get(m.user_id) ?? '1970-01-01';
          // Quiet members look 3 days "more overdue", so they come up a little sooner.
          const effective = quiet.has(`${circleId}:${m.user_id}`) ? addDays(lastDay, -3) : lastDay;
          return { m, effective, tie: Math.random() };
        })
        .sort((a, b) => (a.effective === b.effective ? a.tie - b.tie : a.effective < b.effective ? -1 : 1));
      const pick = ranked[0].m.user_id;
      spotlight.set(`${circleId}:${day}`, pick);
      last.set(pick, day);
      newSpotlights.push({ circle_id: circleId, day, user_id: pick });
    }
  }
  if (newSpotlights.length > 0) {
    const { error } = await db.from('spotlight_days').upsert(newSpotlights, {
      onConflict: 'circle_id,day',
      ignoreDuplicates: true,
    });
    if (error) return json({ error: error.message }, 500);
  }

  // ---------- B3.1 / B3.2 / B3.3: per-recipient reminders ----------
  const candidates: Candidate[] = [];
  for (const [circleId, members] of membersByCircle) {
    const cName = circleName.get(circleId) ?? 'your circle';
    for (const me of members) {
      if (paused.has(me.user_id)) continue;
      const profile = profiles.get(me.user_id);
      const local = localTime(now, profile?.timezone);
      if (local.hour < FIRST_HOUR || local.hour >= LAST_HOUR) continue;
      const base = { user_id: me.user_id, circle_id: circleId };

      // Sunday share
      if (local.weekday === 0 && local.hour >= SUNDAY_HOUR) {
        candidates.push({
          log: { ...base, kind: 'sunday', period_key: local.isoWeek },
          title: cName,
          body: 'Sunday share is open ☀️ How was your week?',
          data: { type: 'share_open', circle_id: circleId, target_id: local.isoWeek },
        });
      }

      // Spotlight
      const star = spotlight.get(`${circleId}:${local.date}`);
      if (star && !paused.has(star)) {
        candidates.push({
          log: { ...base, kind: 'spotlight', period_key: local.date },
          title: cName,
          body: star === me.user_id
            ? "Today's your spotlight day ☀️"
            : `Today's spotlight: ${firstName(profiles.get(star))} ☀️`,
          data: { type: 'spotlight', circle_id: circleId, target_id: star },
        });
      }

      // Birthdays of the other members
      const tomorrow = addDays(local.date, 1);
      for (const other of members) {
        if (other.user_id === me.user_id || paused.has(other.user_id)) continue;
        const p = profiles.get(other.user_id);
        if (!p?.birthday) continue;
        const name = firstName(p);
        if (isBirthdayOn(p.birthday, tomorrow)) {
          candidates.push({
            log: { ...base, kind: 'birthday_eve', period_key: `${tomorrow}:${other.user_id}` },
            title: cName,
            body: `${name}'s birthday is tomorrow 🎂`,
            data: { type: 'birthday', circle_id: circleId, target_id: other.user_id },
          });
        }
        if (isBirthdayOn(p.birthday, local.date)) {
          candidates.push({
            log: { ...base, kind: 'birthday', period_key: `${local.date}:${other.user_id}` },
            title: cName,
            body: `It's ${name}'s birthday today! 🎉 Send them some love`,
            data: { type: 'birthday', circle_id: circleId, target_id: other.user_id },
            nudge: { about_user_id: other.user_id, reason_kind: 'birthday' },
          });
        }
      }

      // Moments ("interview Tuesday") of the other members, the morning of
      for (const mo of momentsQ.data ?? []) {
        if (mo.circle_id !== circleId || mo.occurs_on !== local.date) continue;
        if (mo.user_id === me.user_id || paused.has(mo.user_id)) continue;
        candidates.push({
          log: { ...base, kind: 'moment', period_key: `${local.date}:${mo.id}` },
          title: cName,
          body: `${firstName(profiles.get(mo.user_id))}: ${mo.title} is today. Send a good-luck egg 🍀`,
          data: { type: 'moment', circle_id: circleId, target_id: mo.id },
          nudge: { about_user_id: mo.user_id, reason_kind: 'moment' },
        });
      }
    }
  }

  // ---------- claim (once-only), push, record nudges ----------
  let toSend = candidates;
  if (candidates.length > 0) {
    const { data: claimed, error } = await db
      .from('scheduler_log')
      .upsert(candidates.map((c) => c.log), {
        onConflict: 'kind,user_id,circle_id,period_key',
        ignoreDuplicates: true,
      })
      .select('kind, user_id, circle_id, period_key');
    if (error) return json({ error: error.message }, 500);
    if (!demo) {
      const fresh = new Set((claimed ?? []).map((r) => `${r.kind}|${r.user_id}|${r.circle_id}|${r.period_key}`));
      toSend = candidates.filter((c) => fresh.has(`${c.log.kind}|${c.log.user_id}|${c.log.circle_id}|${c.log.period_key}`));
    }
  }

  const nudgeRows = toSend
    .filter((c) => c.nudge)
    .map((c) => ({
      circle_id: c.log.circle_id,
      recipient_id: c.log.user_id,
      about_user_id: c.nudge!.about_user_id,
      reason_kind: c.nudge!.reason_kind,
      message: c.body,
    }));
  if (nudgeRows.length > 0) {
    const { error } = await db.from('nudges').insert(nudgeRows);
    if (error) console.error('nudge insert failed', error.message);
  }

  let notified = 0;
  try {
    notified = await notify(toSend.map((c) => ({
      user_id: c.log.user_id,
      type: c.data.type,
      circle_id: c.data.circle_id,
      target_id: c.data.target_id ?? null,
      title: c.title,
      body: c.body,
    })));
  } catch (err) {
    return json({ error: String(err) }, 500);
  }

  const counts = toSend.reduce<Record<string, number>>((acc, c) => {
    acc[c.log.kind] = (acc[c.log.kind] ?? 0) + 1;
    return acc;
  }, {});
  const response: DemoRunResponse & Record<string, unknown> = {
    ok: true,
    summary: `${toSend.length} reminders (${Object.entries(counts).map(([k, n]) => `${k} ${n}`).join(', ') || 'none due'}), ` +
      `${notified} notifications created, ${newSpotlights.length} spotlight days scheduled`,
    now: now.toISOString(),
    reminders: counts,
    notified,
  };
  return json(response);
});
