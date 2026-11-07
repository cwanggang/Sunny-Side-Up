-- B5.1 demo polish: last Sunday's shares, upcoming moments, and photo posts in the demo circle.
-- demo_reseed = 20261108000300 version + the B5.1 block.

-- Media cleanup also respects app.skip_webhooks, so reseeding the demo never deletes the
-- reusable demo photos (it only deletes and re-creates the posts that point at them).
create or replace function private.notify_media_cleanup()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(current_setting('app.skip_webhooks', true), '') = 'on' then
    return null;
  end if;
  if old.media_path is not null then
    perform private.post_webhook('media-cleanup', jsonb_build_object(
      'type', 'DELETE', 'table', tg_table_name, 'schema', 'public',
      'record', null, 'old_record', to_jsonb(old)
    ));
  end if;
  return null;
end;
$$;

create or replace function public.demo_reseed(
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
  v_photos   integer;
  v_week     text := to_char((date_trunc('week', now() at time zone 'America/New_York') - interval '1 day')::date, 'IYYY-"W"IW');
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
  delete from public.notifications    where circle_id = c;
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
  delete from public.daily_signals    where user_id = any (v_ids) and day >= current_date - 30;

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

  -- daily signals (plan B4.8): the cast agreed to location + health in this demo.
  -- Normal days: 6-9 h away from home, 3-5 places, 7-8 h sleep, 6-10k steps.
  -- The quiet member's last 3 days: mostly home, 0-1 places, long sleep, few steps.
  update public.consents set location = true, health = true where user_id = any (v_ids);
  insert into public.daily_signals (user_id, day, hours_away_from_home, places_visited, sleep_hours, steps, uploaded_at)
  select v_ids[i], (now() at time zone 'America/New_York')::date - d,
         case when q then round((0.5 + random() * 1.5)::numeric, 1) else round((6 + random() * 3)::numeric, 1) end,
         case when q then floor(random() * 2)::int else 3 + floor(random() * 3)::int end,
         case when q then round((9.5 + random() * 1.5)::numeric, 1) else round((7 + random())::numeric, 1) end,
         case when q then 1500 + floor(random() * 1500)::int else 6000 + floor(random() * 4000)::int end,
         now() - (d - 1) * interval '1 day'
  from generate_series(1, 20) d
  cross join generate_series(1, 4) i
  cross join lateral (select i = 1 and d <= 3 as q) qq
  on conflict (user_id, day) do update set
    hours_away_from_home = excluded.hours_away_from_home, places_visited = excluded.places_visited,
    sleep_hours = excluded.sleep_hours, steps = excluded.steps;

  -- ---------- B5.1 polish ----------
  -- Last Sunday's shares (Ella posted hers before she went quiet).
  insert into public.shares (circle_id, author_id, kind, period_key, body, created_at)
  select c, v_ids[i], 'sunday', v_week, body,
         (date_trunc('week', now() at time zone 'America/New_York') - interval '1 day' + h * interval '1 hour')
           at time zone 'America/New_York'
  from (values
    (1, 'Busy week, but the farmers market on Saturday was lovely 🌻', 11),
    (2, 'Finally finished my capstone draft! Celebrated with way too much pho 🍜', 12),
    (3, 'Climbed my first V4 at the bouldering gym 🧗', 15),
    (4, 'Got the internship offer!! Also learned to make dumplings 🥟', 18)
  ) s(i, body, h);

  -- Upcoming moments (shout-out notifications fire the morning of).
  insert into public.moments (circle_id, user_id, title, occurs_on)
  values (c, v_ids[3], 'Job interview', (now() at time zone 'America/New_York')::date + 2),
         (c, v_ids[4], 'Half marathon', (now() at time zone 'America/New_York')::date + 4);

  -- Photo posts: every file uploaded to {demo circle}/demo-photo-* (scripts/upload-demo-photos.mjs)
  -- becomes a backdated photo from one of the three active friends. Files survive reseeds because
  -- media cleanup is skipped while app.skip_webhooks is on.
  insert into public.interactions (circle_id, sender_id, kind, media_path, created_at)
  select c, v_ids[2 + ((rn - 1) % 3)::int], 'photo', o.name,
         now() - rn * interval '1 day' - (2 + rn) * interval '1 hour'
  from (
    select name, row_number() over (order by name) as rn
    from storage.objects
    where bucket_id = 'media' and name like c::text || '/demo-photo-%'
  ) o;
  get diagnostics v_photos = row_count;

  -- rotation: the two other members got a (cover) nudge yesterday -> inside the 48 h skip
  insert into public.nudges (circle_id, recipient_id, about_user_id, reason_kind, message, sent_at)
  values (c, v_ids[3], v_ids[4], 'cover', 'Send Johnathon a quick egg 🥚', now() - interval '20 hours'),
         (c, v_ids[4], v_ids[3], 'cover', 'Caden would love a hello from you today', now() - interval '21 hours');

  return jsonb_build_object('circle_id', c, 'interactions', v_int, 'reactions', v_react, 'app_opens', v_opens,
                            'photos', v_photos, 'sunday_week', v_week);
end;
$$;
