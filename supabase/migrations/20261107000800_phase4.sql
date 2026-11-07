-- Phase 4: B4.1 engagement, B4.2 drift score, B4.5 Informer analytics, B4.6 delete-account helper,
-- B4.8 demo seed (also used by demo-reseed, B4.7), crons.
--
-- PRIVACY (plan §9): everything here uses counts and timing only. No message bodies, no media,
-- no raw location. drift_scores / engagement_daily stay server-only. No labels beyond is_quiet.

-- ---------- B4.1: engagement_daily ----------
-- Per member, per circle, per LOCAL day (member's timezone), from the member's join date on:
--   sent     = interactions sent + reactions given + shares posted (in that circle)
--   received = directed interactions to them + whole-circle interactions by others
--              + reactions others left on their interactions
--   opens    = app opens that day (app-wide, counted for each of their circles)
create function private.build_engagement(p_from date, p_to date)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rows integer;
begin
  delete from public.engagement_daily where day between p_from and p_to;

  with tz as (
    select id as user_id, coalesce(nullif(timezone, ''), 'America/New_York') as tz from public.profiles
  ),
  mem as (
    select m.circle_id, m.user_id, (m.joined_at at time zone t.tz)::date as joined_day
    from public.circle_members m join tz t on t.user_id = m.user_id
  ),
  sent as (
    select i.sender_id as user_id, i.circle_id, (i.created_at at time zone t.tz)::date as day, count(*) as n
    from public.interactions i join tz t on t.user_id = i.sender_id group by 1, 2, 3
    union all
    select r.user_id, i.circle_id, (r.created_at at time zone t.tz)::date, count(*)
    from public.reactions r join public.interactions i on i.id = r.interaction_id
    join tz t on t.user_id = r.user_id group by 1, 2, 3
    union all
    select s.author_id, s.circle_id, (s.created_at at time zone t.tz)::date, count(*)
    from public.shares s join tz t on t.user_id = s.author_id group by 1, 2, 3
  ),
  received as (
    select i.recipient_id as user_id, i.circle_id, (i.created_at at time zone t.tz)::date as day, count(*) as n
    from public.interactions i join tz t on t.user_id = i.recipient_id
    where i.recipient_id is not null group by 1, 2, 3
    union all
    select m.user_id, i.circle_id, (i.created_at at time zone t.tz)::date, count(*)
    from public.interactions i
    join public.circle_members m on m.circle_id = i.circle_id and m.user_id <> i.sender_id
    join tz t on t.user_id = m.user_id
    where i.recipient_id is null group by 1, 2, 3
    union all
    select i.sender_id, i.circle_id, (r.created_at at time zone t.tz)::date, count(*)
    from public.reactions r join public.interactions i on i.id = r.interaction_id
    join tz t on t.user_id = i.sender_id
    where r.user_id <> i.sender_id group by 1, 2, 3
  ),
  opens as (
    select m.user_id, m.circle_id, (e.at at time zone t.tz)::date as day, count(*) as n
    from public.app_events e
    join public.circle_members m on m.user_id = e.user_id
    join tz t on t.user_id = e.user_id
    where e.kind = 'app_open' group by 1, 2, 3
  ),
  s as (select user_id, circle_id, day, sum(n)::int as n from sent group by 1, 2, 3),
  r as (select user_id, circle_id, day, sum(n)::int as n from received group by 1, 2, 3),
  days as (
    select m.user_id, m.circle_id, d::date as day
    from mem m cross join generate_series(p_from, p_to, interval '1 day') d
    where d::date >= m.joined_day
  )
  insert into public.engagement_daily (user_id, circle_id, day, sent, received, opens)
  select d.user_id, d.circle_id, d.day, coalesce(s.n, 0), coalesce(r.n, 0), coalesce(o.n, 0)::int
  from days d
  left join s on s.user_id = d.user_id and s.circle_id = d.circle_id and s.day = d.day
  left join r on r.user_id = d.user_id and r.circle_id = d.circle_id and r.day = d.day
  left join opens o on o.user_id = d.user_id and o.circle_id = d.circle_id and o.day = d.day;

  get diagnostics v_rows = row_count;
  return v_rows;
end;
$$;

-- ---------- B4.2: drift score against each person's own baseline ----------
-- recent   = p_day-2 .. p_day   (3 days)
-- baseline = p_day-16 .. p_day-3 (14 days)
-- activity = sent + 0.5 * opens  (own behaviour only; what others send isn't the person's choice)
-- engagement score = 1 - recent_avg / baseline_avg, clamped to [0, 1]
-- If daily_signals exist in both windows: signal score = average drop in steps, places visited,
-- hours away from home, plus relative change in sleep; final = 0.7 engagement + 0.3 signals.
-- is_quiet needs: 3 recent days, >= 7 baseline days, baseline activity >= 1/day, score >= 0.6.
create function private.compute_drift(p_day date)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rows integer;
begin
  with e as (
    select user_id, circle_id, day, sent + 0.5 * opens as activity
    from public.engagement_daily
    where day between p_day - 16 and p_day
  ),
  win as (
    select user_id, circle_id,
           avg(activity) filter (where day >= p_day - 2)   as recent_avg,
           count(*)      filter (where day >= p_day - 2)   as recent_n,
           avg(activity) filter (where day <  p_day - 2)   as base_avg,
           count(*)      filter (where day <  p_day - 2)   as base_n
    from e group by 1, 2
  ),
  sig as (
    select user_id,
           avg(steps)                filter (where day >= p_day - 2) as steps_r,
           avg(steps)                filter (where day <  p_day - 2) as steps_b,
           avg(places_visited)       filter (where day >= p_day - 2) as places_r,
           avg(places_visited)       filter (where day <  p_day - 2) as places_b,
           avg(hours_away_from_home) filter (where day >= p_day - 2) as away_r,
           avg(hours_away_from_home) filter (where day <  p_day - 2) as away_b,
           avg(sleep_hours)          filter (where day >= p_day - 2) as sleep_r,
           avg(sleep_hours)          filter (where day <  p_day - 2) as sleep_b,
           count(*) filter (where day >= p_day - 2) as n_r,
           count(*) filter (where day <  p_day - 2) as n_b
    from public.daily_signals
    where day between p_day - 16 and p_day
    group by 1
  ),
  parts as (
    select w.user_id, w.circle_id, w.recent_n, w.base_n, w.base_avg,
           case when coalesce(w.base_avg, 0) > 0
                then least(1, greatest(0, 1 - coalesce(w.recent_avg, 0) / w.base_avg)) else 0 end as eng,
           case when s.n_r >= 2 and s.n_b >= 5 then (
             select avg(x) from unnest(array[
               case when s.steps_b  > 0 then least(1, greatest(0, 1 - s.steps_r  / s.steps_b))  end,
               case when s.places_b > 0 then least(1, greatest(0, 1 - s.places_r / s.places_b)) end,
               case when s.away_b   > 0 then least(1, greatest(0, 1 - s.away_r   / s.away_b))   end,
               case when s.sleep_b  > 0 then least(1, abs(s.sleep_r - s.sleep_b) / s.sleep_b)   end
             ]) as x
           ) end as sig
    from win w left join sig s on s.user_id = w.user_id
  ),
  scored as (
    select user_id, circle_id, recent_n, base_n, base_avg,
           round((case when sig is null then eng else 0.7 * eng + 0.3 * sig end)::numeric, 3) as score
    from parts
  )
  insert into public.drift_scores (user_id, circle_id, day, score, is_quiet)
  select user_id, circle_id, p_day, score,
         recent_n = 3 and base_n >= 7 and base_avg >= 1 and score >= 0.6
  from scored
  on conflict (user_id, circle_id, day) do update
    set score = excluded.score, is_quiet = excluded.is_quiet;

  get diagnostics v_rows = row_count;
  return v_rows;
end;
$$;

-- Entry point for nightly-drift / nudge-engine (service role only).
-- Default day = yesterday on the East Coast (the last complete day for most users).
create function public.run_drift(p_day date default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_day date := coalesce(p_day, (now() at time zone 'America/New_York')::date - 1);
  v_eng integer;
  v_scores integer;
  v_quiet integer;
begin
  v_eng := private.build_engagement(v_day - 17, v_day);
  v_scores := private.compute_drift(v_day);
  select count(*) into v_quiet from public.drift_scores where day = v_day and is_quiet;
  return jsonb_build_object('day', v_day, 'engagement_rows', v_eng, 'scores', v_scores, 'quiet', v_quiet);
end;
$$;
revoke all on function public.run_drift(date) from public, anon, authenticated;
grant execute on function public.run_drift(date) to service_role;

-- ---------- B4.6: list a user's uploaded files (storage schema isn't exposed to the API) ----------
create function public.user_media_paths(p_user_id uuid)
returns setof text
language sql
stable
security definer
set search_path = ''
as $$
  select name from storage.objects where bucket_id = 'media' and owner_id = p_user_id::text;
$$;
revoke all on function public.user_media_paths(uuid) from public, anon, authenticated;
grant execute on function public.user_media_paths(uuid) to service_role;

-- ---------- B4.5: Informer (read-only, de-identified aggregates only) ----------
-- Informer connects as `informer_ro` (via the session pooler) and can read ONLY the analytics
-- schema: per-circle daily totals under a hashed key. No names, ids, media, message bodies,
-- drift scores, or is_quiet. Login is enabled separately (see analytics/README.md).
create schema if not exists analytics;

create view analytics.circle_engagement_daily as
select left(md5('sunny-circle:' || e.circle_id::text), 10) as circle_key,
       e.day,
       count(*)                                  as members,
       sum(e.sent)::int                          as sent,
       sum(e.received)::int                      as received,
       sum(e.opens)::int                         as opens,
       round(avg(e.sent + 0.5 * e.opens), 2)     as activity_per_member
from public.engagement_daily e
group by 1, 2;

create view analytics.daily_totals as
select day,
       count(distinct circle_key)   as circles,
       sum(members)::int            as member_days,
       sum(sent)::int               as sent,
       sum(opens)::int              as opens,
       round(avg(activity_per_member), 2) as avg_activity_per_member
from analytics.circle_engagement_daily
group by day;

-- Alert feed: circles whose last 3 days dropped >= 25% below their previous 14 days
-- (one friend in four going quiet is about a 25% dip for the circle).
create view analytics.circle_engagement_alerts as
with latest as (select max(day) as d from analytics.circle_engagement_daily),
w as (
  select c.circle_key,
         avg(c.activity_per_member) filter (where c.day >  l.d - 3)                       as recent_avg,
         avg(c.activity_per_member) filter (where c.day <= l.d - 3 and c.day > l.d - 17)  as baseline_avg
  from analytics.circle_engagement_daily c cross join latest l
  where c.day > l.d - 17
  group by c.circle_key
)
select circle_key,
       round(recent_avg, 2)   as recent_avg,
       round(baseline_avg, 2) as baseline_avg,
       round(100 * (1 - recent_avg / nullif(baseline_avg, 0)), 1) as drop_pct,
       coalesce(baseline_avg >= 1 and recent_avg <= 0.75 * baseline_avg, false) as alert
from w;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'informer_ro') then
    create role informer_ro nologin;
  end if;
end;
$$;
grant usage on schema analytics to informer_ro;
grant select on all tables in schema analytics to informer_ro;
alter default privileges in schema analytics grant select on tables to informer_ro;
alter role informer_ro set search_path = analytics;
revoke all on schema analytics from anon, authenticated;

-- ---------- B4.8: demo seed (also behind demo-reseed, B4.7) ----------
-- Real demo cast (plan P0.14), in this order: quiet member, nudge recipient, member, member.
-- Each must have signed up in the app first. Resets ONLY the demo circle and these users'
-- app opens, then writes 21 days of backdated history. The quiet member drops off over the last
-- 3 days + today. Recent cover nudges for the two other members make the nudge rotation pick the
-- recipient (they're inside the 48 h skip window). Never pushes (backdated + skip flag).
create function public.demo_reseed(
  p_emails text[] default array['ella7.ha@gmail.com', 'val311297@gmail.com',
                                'caden190wang@gmail.com', 'gamecoder04@gmail.com']
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  c          constant uuid := '00000000-0000-4000-9000-0000000000d0';
  v_ids      uuid[];
  v_missing  text[];
  v_int      integer;
  v_react    integer;
  v_opens    integer;
begin
  select array_agg(u.id order by array_position(p_emails, lower(u.email)))
    into v_ids
  from auth.users u
  where lower(u.email) = any (p_emails);

  select array_agg(e) into v_missing
  from unnest(p_emails) e
  where not exists (select 1 from auth.users u where lower(u.email) = e);
  if v_missing is not null then
    raise exception 'Demo accounts not signed up yet: %', array_to_string(v_missing, ', ')
      using errcode = 'P0002';
  end if;

  perform set_config('app.skip_webhooks', 'on', true);
  perform setseed(0.1337);

  insert into public.circles (id, name, home_area, invite_code, created_by)
  values (c, 'Sunny Side Up Demo', 'Durham, NC', 'DEMOSUNY', v_ids[2])
  on conflict (id) do nothing;

  -- reset the demo circle
  delete from public.nudges           where circle_id = c;
  delete from public.drift_scores     where circle_id = c;
  delete from public.engagement_daily where circle_id = c;
  delete from public.scheduler_log    where circle_id = c;
  delete from public.spotlight_days   where circle_id = c;
  delete from public.moments          where circle_id = c;
  delete from public.shares           where circle_id = c;
  delete from public.interactions     where circle_id = c;  -- reactions cascade
  delete from public.circle_members   where circle_id = c and user_id <> all (v_ids);
  delete from public.app_events       where user_id = any (v_ids);

  insert into public.circle_members (circle_id, user_id, role, joined_at)
  select c, v_ids[i], case when i = 2 then 'owner' else 'member' end::public.circle_role,
         now() - interval '22 days'
  from generate_series(1, 4) i
  on conflict (circle_id, user_id) do update set joined_at = excluded.joined_at, role = excluded.role;

  -- interactions: 3-5 per member per day; the quiet member (#1) sends nothing on days 0-3
  with plan as (
    select d, i, k,
           now() - d * interval '1 day' - (1 + random() * 11) * interval '1 hour' as at,
           random() as r_kind, random() as r_dir, 1 + floor(random() * 3)::int as off,
           floor(random() * 8)::int as t
    from generate_series(0, 20) d
    cross join generate_series(1, 4) i
    cross join generate_series(1, 5) k
    where k <= case when i = 1 and d <= 3 then 0 else 3 + floor(random() * 3)::int end
  ),
  texts(t, body) as (
    values (0, 'Coffee tomorrow?'), (1, 'This made me think of you'), (2, 'How was the game?'),
           (3, 'Lunch at the usual spot?'), (4, 'Look at this sunset'), (5, 'Good luck today!'),
           (6, 'Who''s free Saturday?'), (7, 'Haha same')
  )
  insert into public.interactions (circle_id, sender_id, recipient_id, kind, body, created_at)
  select c, v_ids[p.i],
         case when p.r_dir < 0.3 then v_ids[1 + ((p.i - 1 + p.off) % 4)] end,
         case when p.r_kind < 0.5 then 'egg' else 'text' end::public.interaction_kind,
         case when p.r_kind < 0.5 then null else tx.body end,
         p.at
  from plan p join texts tx on tx.t = p.t;
  get diagnostics v_int = row_count;

  -- reactions on ~40% of whole-circle items (the quiet member stops reacting too)
  insert into public.reactions (interaction_id, user_id, emoji, created_at)
  select i.id, v_ids[m], (array['❤️', '😂', '🥚', '🙌'])[1 + floor(random() * 4)::int],
         i.created_at + interval '9 minutes'
  from public.interactions i
  cross join generate_series(1, 4) m
  where i.circle_id = c and i.recipient_id is null and v_ids[m] <> i.sender_id
    and random() < 0.4
    and not (m = 1 and i.created_at > now() - interval '4 days')
  on conflict do nothing;
  get diagnostics v_react = row_count;

  -- app opens: 3 a day; the quiet member opens once a day on days 0-3
  insert into public.app_events (user_id, kind, at)
  select v_ids[i], 'app_open', now() - d * interval '1 day' - h * interval '1 hour'
  from generate_series(0, 20) d
  cross join generate_series(1, 4) i
  cross join (values (1), (6), (11)) hh(h)
  where not (i = 1 and d <= 3 and h <> 6)
    and now() - d * interval '1 day' - h * interval '1 hour' < now();
  get diagnostics v_opens = row_count;

  -- rotation: the two other members got a (cover) nudge yesterday -> inside the 48 h skip
  insert into public.nudges (circle_id, recipient_id, about_user_id, reason_kind, message, sent_at)
  values (c, v_ids[3], v_ids[4], 'cover', 'Send Johnathon a quick egg 🥚', now() - interval '20 hours'),
         (c, v_ids[4], v_ids[3], 'cover', 'Caden would love a hello from you today', now() - interval '21 hours');

  return jsonb_build_object('circle_id', c, 'interactions', v_int, 'reactions', v_react, 'app_opens', v_opens);
end;
$$;
revoke all on function public.demo_reseed(text[]) from public, anon, authenticated;
grant execute on function public.demo_reseed(text[]) to service_role;

-- ---------- crons ----------
-- 08:00 UTC (3-4 am East Coast): score yesterday. 16:00 UTC (11-12 am East Coast): send nudges.
select cron.schedule('nightly-drift', '0 8 * * *', $$ select private.post_webhook('nightly-drift', '{}'::jsonb) $$);
select cron.schedule('nudge-engine', '0 16 * * *', $$ select private.post_webhook('nudge-engine', '{}'::jsonb) $$);
