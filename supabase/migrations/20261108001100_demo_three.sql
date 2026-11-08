-- Demo cast is now 3 people (2026-11-08: the free Personal Team allows 3 phones):
--   1 Ella    ella7.ha@gmail.com      quiet member
--   2 Jocelyn river.jossy7@gmail.com  gets the nudge (keeps the app open)
--   3 Caden   caden190wang@gmail.com  member
-- One self-contained demo_reseed that works for any cast of 2+ (rehearsal still passes 4 test
-- users). Same content as the B4.8 / B5.1 / v0.3 / v0.4 seeds, with every "4" made "n".
-- The older private.demo_reseed_* functions are no longer used and are dropped.

drop function if exists public.demo_reseed(text[]);
drop function if exists private.demo_reseed_v03(text[]);
drop function if exists private.demo_reseed_base(text[]);

create function public.demo_reseed(
  p_emails text[] default array['ella7.ha@gmail.com', 'river.jossy7@gmail.com', 'caden190wang@gmail.com']
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  c         constant uuid := '00000000-0000-4000-9000-0000000000d0';
  v_ids     uuid[];
  v_names   text[];
  v_missing text[];
  n         int;
  v_today   date := (now() at time zone 'America/New_York')::date;
  v_week    text := to_char((date_trunc('week', now() at time zone 'America/New_York') - interval '1 day')::date, 'IYYY-"W"IW');
  v_sunday  date;
  v_sweek   text;
  v_int     int;
  v_react   int;
  v_opens   int;
  v_photos  text[];
  v_np      int;
  v_daily   int := 0;
  v_e1      uuid;
  v_e2      uuid;
  v_e3      uuid;
  d         int;
  i         int;
  v_texts   text[] := array['my shoes, right now 👟', 'sky check ☁️', 'desk chaos', 'lunch!!', 'the best color I saw today', 'the view from here'];
  v_styles  jsonb[] := array['{"swatch":"blush","pattern":"dots"}', '{"swatch":"mint","pattern":"zigzag"}', '{"swatch":"butter","pattern":"stripes"}',
                             '{"swatch":"sky","pattern":"dots"}', '{"swatch":"shell","pattern":"none"}', '{"swatch":"lilac","pattern":"zigzag"}']::jsonb[];
  v_facts   jsonb[] := array[
    '[{"k":"favorite color","v":"lilac"},{"k":"spirit animal","v":"fox"},{"k":"comfort food","v":"her mom''s dumplings"}]',
    '[{"k":"favorite color","v":"purple"},{"k":"spirit animal","v":"otter"},{"k":"current go-to song","v":"anything by laufey"}]',
    '[{"k":"favorite color","v":"sky blue"},{"k":"spirit animal","v":"penguin"},{"k":"hidden talent","v":"a rubik''s cube in under a minute"}]',
    '[{"k":"favorite color","v":"forest green"},{"k":"spirit animal","v":"golden retriever"},{"k":"coffee order","v":"oat milk cortado"}]'
  ]::jsonb[];
  v_eggs    jsonb[] := array['{"swatch":"lilac","pattern":"dots"}', '{"swatch":"butter","pattern":"dots"}',
                             '{"swatch":"sky","pattern":"stripes"}', '{"swatch":"mint","pattern":"zigzag"}']::jsonb[];
  v_shares  text[] := array['Busy week, but the farmers market on Saturday was lovely 🌻',
                            'Finally finished my capstone draft! Celebrated with way too much pho 🍜',
                            'Climbed my first V4 at the bouldering gym 🧗',
                            'Got the internship offer!! Also learned to make dumplings 🥟'];
begin
  p_emails := array(select lower(trim(e)) from unnest(p_emails) e);
  select array_agg(e) into v_missing from unnest(p_emails) e
  where not exists (select 1 from auth.users u where lower(u.email) = e);
  if v_missing is not null then
    raise exception 'Demo accounts not signed up yet: %', array_to_string(v_missing, ', ') using errcode = 'P0002';
  end if;
  select array_agg(u.id order by array_position(p_emails, lower(u.email))),
         array_agg(coalesce(nullif(split_part(trim(p.display_name), ' ', 1), ''), p.username) order by array_position(p_emails, lower(u.email)))
    into v_ids, v_names
  from auth.users u join public.profiles p on p.id = u.id
  where lower(u.email) = any (p_emails);
  n := cardinality(v_ids);
  if n < 2 then
    raise exception 'The demo needs at least 2 people' using errcode = '22023';
  end if;

  perform set_config('app.skip_webhooks', 'on', true);
  perform setseed(0.1337);

  insert into public.circles (id, name, home_area, invite_code, created_by, description)
  values (c, 'Sunny Side Up Demo', 'Durham, NC', 'DEMOSUNY', v_ids[2], 'friends, one carton')
  on conflict (id) do update set description = coalesce(public.circles.description, excluded.description);

  -- ---------- reset the demo circle ----------
  delete from public.notifications    where circle_id = c;
  delete from public.nudges           where circle_id = c;
  delete from public.drift_scores     where circle_id = c;
  delete from public.engagement_daily where circle_id = c;
  delete from public.scheduler_log    where circle_id = c;
  delete from public.spotlight_days   where circle_id = c;
  delete from public.sunday_pairs     where circle_id = c;
  delete from public.moments          where circle_id = c;
  delete from public.photos           where circle_id = c;
  delete from public.events           where circle_id = c;
  delete from public.shares           where circle_id = c;
  delete from public.interactions     where circle_id = c;
  delete from public.circle_members   where circle_id = c and user_id <> all (v_ids);
  delete from public.app_events       where user_id = any (v_ids);
  delete from public.daily_signals    where user_id = any (v_ids) and day >= current_date - 30;

  insert into public.circle_members (circle_id, user_id, role, joined_at)
  select c, v_ids[k], case when k = 2 then 'owner' else 'member' end::public.circle_role, now() - interval '22 days'
  from generate_series(1, n) k
  on conflict (circle_id, user_id) do update set joined_at = excluded.joined_at, role = excluded.role;

  -- ---------- 21 days of history; #1 goes quiet over the last 3 days + today ----------
  with plan as (
    select dd, k, kk,
           now() - dd * interval '1 day' - (1 + random() * 11) * interval '1 hour' as at,
           random() as r_kind, random() as r_dir, 1 + floor(random() * (n - 1))::int as off,
           floor(random() * 8)::int as t
    from generate_series(0, 20) dd
    cross join generate_series(1, n) k
    cross join generate_series(1, 5) kk
    where kk <= case when k = 1 and dd <= 3 then 0 else 3 + floor(random() * 3)::int end
  ),
  texts(t, body) as (
    values (0, 'Coffee tomorrow?'), (1, 'This made me think of you'), (2, 'How was the game?'),
           (3, 'Lunch at the usual spot?'), (4, 'Look at this sunset'), (5, 'Good luck today!'),
           (6, 'Who''s free Saturday?'), (7, 'Haha same')
  )
  insert into public.interactions (circle_id, sender_id, recipient_id, kind, body, created_at)
  select c, v_ids[p.k],
         case when p.r_dir < 0.3 then v_ids[1 + ((p.k - 1 + p.off) % n)] end,
         case when p.r_kind < 0.5 then 'egg' else 'text' end::public.interaction_kind,
         case when p.r_kind < 0.5 then null else tx.body end,
         p.at
  from plan p join texts tx on tx.t = p.t;
  get diagnostics v_int = row_count;

  insert into public.reactions (interaction_id, user_id, emoji, created_at)
  select x.id, v_ids[m], (array['❤️', '😂', '🥚', '🙌'])[1 + floor(random() * 4)::int], x.created_at + interval '9 minutes'
  from public.interactions x
  cross join generate_series(1, n) m
  where x.circle_id = c and x.recipient_id is null and v_ids[m] <> x.sender_id
    and random() < 0.4
    and not (m = 1 and x.created_at > now() - interval '4 days')
  on conflict do nothing;
  get diagnostics v_react = row_count;

  insert into public.app_events (user_id, kind, at)
  select v_ids[k], 'app_open', now() - dd * interval '1 day' - h * interval '1 hour'
  from generate_series(0, 20) dd
  cross join generate_series(1, n) k
  cross join (values (1), (6), (11)) hh(h)
  where not (k = 1 and dd <= 3 and h <> 6)
    and now() - dd * interval '1 day' - h * interval '1 hour' < now();
  get diagnostics v_opens = row_count;

  update public.consents set location = true, health = true where user_id = any (v_ids);
  insert into public.daily_signals (user_id, day, hours_away_from_home, places_visited, sleep_hours, steps, uploaded_at)
  select v_ids[k], v_today - dd,
         case when q then round((0.5 + random() * 1.5)::numeric, 1) else round((6 + random() * 3)::numeric, 1) end,
         case when q then floor(random() * 2)::int else 3 + floor(random() * 3)::int end,
         case when q then round((9.5 + random() * 1.5)::numeric, 1) else round((7 + random())::numeric, 1) end,
         case when q then 1500 + floor(random() * 1500)::int else 6000 + floor(random() * 4000)::int end,
         now() - (dd - 1) * interval '1 day'
  from generate_series(1, 20) dd
  cross join generate_series(1, n) k
  cross join lateral (select k = 1 and dd <= 3 as q) qq
  on conflict (user_id, day) do update set
    hours_away_from_home = excluded.hours_away_from_home, places_visited = excluded.places_visited,
    sleep_hours = excluded.sleep_hours, steps = excluded.steps;

  -- last Sunday's shares (the quiet member posted hers before going quiet)
  insert into public.shares (circle_id, author_id, kind, period_key, body, created_at)
  select c, v_ids[k], 'sunday', v_week, v_shares[1 + (k - 1) % 4],
         (date_trunc('week', now() at time zone 'America/New_York') - interval '1 day' + (10 + k * 2) * interval '1 hour')
           at time zone 'America/New_York'
  from generate_series(1, n) k;

  -- upcoming moments
  insert into public.moments (circle_id, user_id, title, occurs_on)
  values (c, v_ids[n], 'Job interview', v_today + 2), (c, v_ids[2], 'Half marathon', v_today + 4);

  -- photo posts from the active friends, from scripts/upload-demo-photos files
  select coalesce(array_agg(name order by name), '{}') into v_photos
  from storage.objects where bucket_id = 'media' and name like c::text || '/demo-photo-%';
  v_np := cardinality(v_photos);
  insert into public.interactions (circle_id, sender_id, kind, media_path, created_at)
  select c, v_ids[2 + ((k - 1) % (n - 1))], 'photo', v_photos[k], now() - k * interval '1 day' - (2 + k) * interval '1 hour'
  from generate_series(1, v_np) k;

  -- nudge rotation: everyone except #2 was nudged recently (48 h skip), so the quiet member's
  -- nudge goes to #2
  insert into public.nudges (circle_id, recipient_id, about_user_id, reason_kind, message, sent_at)
  select c, v_ids[k], v_ids[case when k = n then 2 else k + 1 end], 'cover',
         v_names[case when k = n then 2 else k + 1 end] || ' would love a hello from you today', now() - interval '20 hours'
  from generate_series(3, n) k;

  -- ---------- daily photo: today is #2's day (post it live); #1 skipped hers in the quiet days ----------
  insert into public.spotlight_days (circle_id, day, user_id)
  select c, v_today - g, v_ids[1 + ((1 + g) % n)] from generate_series(0, 6) g
  on conflict (circle_id, day) do update set user_id = excluded.user_id;
  for d in 1 .. 6 loop
    i := 1 + ((1 + d) % n);
    continue when i = 1 and d <= 3;
    insert into public.shares (circle_id, author_id, kind, period_key, body, egg_style, media_path, created_at)
    values (c, v_ids[i], 'spotlight', to_char(v_today - d, 'YYYY-MM-DD'), v_texts[d], v_styles[d],
            case when v_np > 0 then v_photos[1 + (d - 1) % v_np] end,
            ((v_today - d) + time '09:30' + (d * interval '17 minutes')) at time zone 'America/New_York');
    v_daily := v_daily + 1;
  end loop;

  -- ---------- sunny sunday (latest Sunday's week) ----------
  -- 3 people: a ring  #3 -> #2 -> #1 -> #3. #3 already sent #2 an egg (#2 sees it waiting and
  -- opens it by sending hers); #3 is "still frying"; #1 is uncracked.
  -- otherwise: pairs #2<->#1, #3<->#4 (+ ring for an odd tail), #3's egg in flight to #4.
  v_sunday := v_today - extract(dow from v_today)::int;
  v_sweek := to_char(v_sunday, 'IYYY-"W"IW');
  if n = 2 then
    insert into public.sunday_pairs (circle_id, period_key, giver_id, receiver_id, created_at)
    values (c, v_sweek, v_ids[1], v_ids[2], now() - interval '2 hours'), (c, v_sweek, v_ids[2], v_ids[1], now() - interval '2 hours');
  elsif n = 3 then
    insert into public.sunday_pairs (circle_id, period_key, giver_id, receiver_id, created_at)
    values (c, v_sweek, v_ids[3], v_ids[2], now() - interval '2 hours'),
           (c, v_sweek, v_ids[2], v_ids[1], now() - interval '2 hours'),
           (c, v_sweek, v_ids[1], v_ids[3], now() - interval '2 hours');
    insert into public.shares (circle_id, author_id, recipient_id, kind, period_key, body, egg_style, created_at)
    values (c, v_ids[3], v_ids[2], 'sunday', v_sweek, 'miss ur terrible puns', '{"swatch":"mint","pattern":"zigzag"}', now() - interval '1 hour');
  else
    perform private.ensure_sunday_pairs(c, v_sweek); -- generic pairing for bigger rehearsal casts
    insert into public.shares (circle_id, author_id, recipient_id, kind, period_key, body, egg_style, created_at)
    select c, p.giver_id, p.receiver_id, 'sunday', v_sweek, 'miss ur terrible puns', '{"swatch":"mint","pattern":"zigzag"}', now() - interval '1 hour'
    from public.sunday_pairs p where p.circle_id = c and p.period_key = v_sweek and p.giver_id = v_ids[3];
  end if;

  -- ---------- v0.4: profiles (only if not filled in), gallery, events ----------
  for k in 1 .. n loop
    update public.profiles set facts = v_facts[1 + (k - 1) % 4], egg_style = v_eggs[1 + (k - 1) % 4]
    where id = v_ids[k] and facts = '[]'::jsonb;
  end loop;

  if v_np > 0 then
    insert into public.photos (circle_id, author_id, media_path, width, height, created_at)
    select c, v_ids[2 + ((k - 1) % (n - 1))], v_photos[k], 1000, (array[1300, 800, 1000, 1250])[1 + (k - 1) % 4], now() - k * interval '2 days'
    from generate_series(1, v_np) k;
  end if;

  insert into public.events (circle_id, title, starts_at, location, description, chat_days_after, created_by)
  values (c, 'dumpling night', ((v_today + 6) + time '19:00') at time zone 'America/New_York', lower(v_names[n]) || '''s place',
          'everyone brings one filling.', 1, v_ids[n])
  returning id into v_e1;
  insert into public.events (circle_id, title, starts_at, location, description, chat_days_after, created_by)
  values (c, 'farmers market run', ((v_today + 2) + time '10:00') at time zone 'America/New_York', 'durham central park',
          'we need about forty lemons.', 0, v_ids[2])
  returning id into v_e2;
  insert into public.events (circle_id, title, starts_at, location, description, chat_days_after, created_by, created_at)
  values (c, 'movie marathon', ((v_today - 9) + time '20:00') at time zone 'America/New_York', 'our living room',
          'three movies, one couch.', 1, v_ids[n], now() - interval '14 days')
  returning id into v_e3;

  -- dumpling night: everyone, #n leads; market run: #2 leads, everyone but #1; movie marathon: everyone
  insert into public.event_people (event_id, user_id, role, is_lead)
  select v_e1, v_ids[k], case when k = 1 then 'view' else 'edit' end::public.event_role, k = n from generate_series(1, n) k;
  insert into public.event_people (event_id, user_id, role, is_lead)
  select v_e2, v_ids[k], case when k = 2 then 'edit' else 'view' end::public.event_role, k = 2 from generate_series(2, n) k;
  insert into public.event_people (event_id, user_id, role, is_lead)
  select v_e3, v_ids[k], case when k = n then 'edit' else 'view' end::public.event_role, k = n from generate_series(1, n) k;

  insert into public.event_messages (event_id, sender_id, body, created_at) values
    (v_e1, v_ids[n], 'dumpling night is happening!!', now() - interval '2 days'),
    (v_e1, v_ids[2], 'can i bring the chili oil?', now() - interval '25 hours'),
    (v_e1, v_ids[n], 'yes please', now() - interval '24 hours'),
    (v_e2, v_ids[n], 'i can drive if someone buys me a coffee', now() - interval '5 hours'),
    (v_e3, v_ids[n], 'snacks are on me', now() - interval '10 days'),
    (v_e3, v_ids[2], 'i''m bringing the big blanket', now() - interval '10 days');

  if v_np > 0 then
    insert into public.photos (circle_id, event_id, author_id, media_path, width, height, created_at)
    select c, v_e3, v_ids[1 + (k % n)], v_photos[1 + (k - 1) % v_np], 1000, (array[800, 1250, 1000])[k],
           now() - interval '9 days' + k * interval '20 minutes'
    from generate_series(1, least(3, v_np)) k;
  end if;

  return jsonb_build_object('circle_id', c, 'cast', n, 'interactions', v_int, 'reactions', v_react, 'app_opens', v_opens,
                            'photos', v_np, 'daily_photos', v_daily, 'sunday_week', v_sweek, 'events', 3);
end;
$$;
revoke all on function public.demo_reseed(text[]) from public, anon, authenticated;
grant execute on function public.demo_reseed(text[]) to service_role;
