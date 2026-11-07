-- B1.4 seed v1: 4 test users in one circle, plus an outsider in their own circle (for RLS tests).
-- These are FAKE test accounts (*.test emails never receive mail). They can sign in with
-- email + password in the app, but can't receive pushes until they register a real device.
-- The real demo cast (plan P0.14) signs up in the app; their history comes from B4.8.
--
-- Password for every seed account: sunnyside-test
-- Re-runnable: everything is upserted on fixed ids.

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
