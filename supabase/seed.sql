-- B1.4 seed v1 + B2.4 seed v2: 4 test users in one circle, plus an outsider in their own circle (for RLS tests).
-- These are FAKE test accounts (*.test emails never receive mail). They can sign in with
-- email + password in the app, but can't receive pushes until they register a real device.
-- The real demo cast (plan P0.14) signs up in the app; their history comes from B4.8.
--
-- Password for every seed account: sunnyside-test
-- Re-runnable: everything is upserted on fixed ids.

-- Never push while seeding (see migration 20261107000600_seed_safety.sql).
set app.skip_webhooks = 'on';

-- ---------- auth users (the signup trigger creates profiles + consents) ----------
with seed_users (id, email, display_name) as (
  values
    ('00000000-0000-4000-8000-000000000001'::uuid, 'maya@sunnyside.test',   'Maya'),
    ('00000000-0000-4000-8000-000000000002'::uuid, 'sam@sunnyside.test',    'Sam'),
    ('00000000-0000-4000-8000-000000000003'::uuid, 'jordan@sunnyside.test', 'Jordan'),
    ('00000000-0000-4000-8000-000000000004'::uuid, 'priya@sunnyside.test',  'Priya'),
    ('00000000-0000-4000-8000-000000000005'::uuid, 'riley@sunnyside.test',  'Riley')
)
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  email_change_token_current, phone_change, phone_change_token, reauthentication_token
)
select
  '00000000-0000-0000-0000-000000000000', id, 'authenticated', 'authenticated', email,
  extensions.crypt('sunnyside-test', extensions.gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  jsonb_build_object('display_name', display_name),
  now(), now(),
  '', '', '', '', '', '', '', ''
from seed_users
on conflict (id) do nothing;

insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select u.id::text, u.id,
       jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
       'email', now(), now(), now()
from auth.users u
where u.email like '%@sunnyside.test'
on conflict (provider_id, provider) do nothing;

-- Profile details
update public.profiles set birthday = '2002-11-09', timezone = 'America/New_York'
where id = '00000000-0000-4000-8000-000000000002'; -- Sam: birthday in two days (good for B3.3 tests)

-- ---------- circles ----------
insert into public.circles (id, name, home_area, invite_code, created_by) values
  ('00000000-0000-4000-9000-000000000001', 'Sunny Test Circle', 'Durham, NC', 'SUNNYTST',
   '00000000-0000-4000-8000-000000000001'),
  ('00000000-0000-4000-9000-000000000002', 'Riley''s Circle', 'Raleigh, NC', 'RILEYTST',
   '00000000-0000-4000-8000-000000000005')
on conflict (id) do nothing;

insert into public.circle_members (circle_id, user_id, role) values
  ('00000000-0000-4000-9000-000000000001', '00000000-0000-4000-8000-000000000001', 'owner'),
  ('00000000-0000-4000-9000-000000000001', '00000000-0000-4000-8000-000000000002', 'member'),
  ('00000000-0000-4000-9000-000000000001', '00000000-0000-4000-8000-000000000003', 'member'),
  ('00000000-0000-4000-9000-000000000001', '00000000-0000-4000-8000-000000000004', 'member'),
  ('00000000-0000-4000-9000-000000000002', '00000000-0000-4000-8000-000000000005', 'owner')
on conflict do nothing;

-- ---------- server-only rows the RLS test checks clients can't see ----------
insert into public.daily_signals (user_id, day, hours_away_from_home, places_visited, sleep_hours, steps) values
  ('00000000-0000-4000-8000-000000000002', current_date - 1, 6.5, 3, 7.2, 8400)
on conflict do nothing;

insert into public.drift_scores (user_id, circle_id, day, score, is_quiet) values
  ('00000000-0000-4000-8000-000000000002', '00000000-0000-4000-9000-000000000001', current_date - 1, 0.2, false)
on conflict do nothing;

insert into public.nudges (id, circle_id, recipient_id, about_user_id, reason_kind, message) values
  ('00000000-0000-4000-a000-000000000001', '00000000-0000-4000-9000-000000000001',
   '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002',
   'cover', 'Haven''t caught up with Sam in a bit. Send an egg?')
on conflict (id) do nothing;

-- ---------- B2.4 seed v2: a week of feed history in the test circle ----------
-- ~5 interactions a day for the last 7 days (eggs, texts, some directed), plus reactions.
-- Photos/voice need real files in Storage: scripts/seed-media.mjs adds those.
select setseed(0.42);

with members(n, id) as (
  values (0, '00000000-0000-4000-8000-000000000001'::uuid), (1, '00000000-0000-4000-8000-000000000002'::uuid),
         (2, '00000000-0000-4000-8000-000000000003'::uuid), (3, '00000000-0000-4000-8000-000000000004'::uuid)
),
texts(n, body) as (
  values (0, 'Coffee this week?'), (1, 'Saw this and thought of you'), (2, 'How did the exam go?'),
         (3, 'Miss you guys'), (4, 'Who''s around Saturday?'), (5, 'That sunset tho'),
         (6, 'Good luck today!'), (7, 'Made the pasta recipe, 10/10'), (8, 'Call later?'),
         (9, 'Happy Friday!!')
),
slots as (
  select g as k,
         (now() - (g * interval '33 minutes') - (floor(random() * 25) * interval '1 minute')) as at,
         floor(random() * 4)::int as sender_n,
         random() as r_kind,
         random() as r_dir,
         floor(random() * 3)::int + 1 as offset_n,
         floor(random() * 10)::int as text_n
  from generate_series(1, 300, 9) g  -- 34 slots spread over ~7 days
)
insert into public.interactions (id, circle_id, sender_id, recipient_id, kind, body, created_at)
select md5('seed-interaction-' || sl.k)::uuid,
       '00000000-0000-4000-9000-000000000001',
       s.id,
       case when sl.r_dir < 0.35 then r.id end,
       case when sl.r_kind < 0.55 then 'egg' else 'text' end::public.interaction_kind,
       case when sl.r_kind < 0.55 then null else t.body end,
       sl.at
from slots sl
join members s on s.n = sl.sender_n
join members r on r.n = (sl.sender_n + sl.offset_n) % 4
join texts t on t.n = sl.text_n
on conflict (id) do nothing;

-- Reactions: each seeded whole-circle item gets 0-2 reactions from other members.
insert into public.reactions (interaction_id, user_id, emoji, created_at)
select i.id, m.id, (array['❤️', '😂', '🥚', '🙌', '😮'])[1 + floor(random() * 5)::int],
       i.created_at + interval '7 minutes'
from public.interactions i
join (values ('00000000-0000-4000-8000-000000000001'::uuid), ('00000000-0000-4000-8000-000000000002'::uuid),
             ('00000000-0000-4000-8000-000000000003'::uuid), ('00000000-0000-4000-8000-000000000004'::uuid)) m(id)
  on m.id <> i.sender_id
where i.id in (select md5('seed-interaction-' || g)::uuid from generate_series(1, 300, 9) g)
  and i.recipient_id is null
  and random() < 0.4
on conflict do nothing;

-- A few app opens so engagement_daily has something to count later.
insert into public.app_events (user_id, kind, at)
select m.id, 'app_open', now() - (d * interval '1 day') - (h * interval '1 hour')
from (values ('00000000-0000-4000-8000-000000000001'::uuid), ('00000000-0000-4000-8000-000000000002'::uuid),
             ('00000000-0000-4000-8000-000000000003'::uuid), ('00000000-0000-4000-8000-000000000004'::uuid)) m(id)
cross join generate_series(1, 7) d
cross join (values (9), (13), (20)) hh(h)
where not exists (select 1 from public.app_events e where e.user_id = m.id and e.at < now() - interval '12 hours');

reset app.skip_webhooks;
