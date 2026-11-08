-- Setup for the design v0.3 checks in rls-test.mjs (test circle "Sunny", seed users only).
-- Run as postgres: npm run rls-test:setup (pairs and spotlight days are server-only tables).
--   * Sunday pairs under the test key TEST-W00 (4 members -> 2 mutual pairs)
--   * today's (UTC) daily-photo person = Maya
insert into public.spotlight_days (circle_id, day, user_id)
values ('00000000-0000-4000-9000-000000000001', current_date, '00000000-0000-4000-8000-000000000001')
on conflict (circle_id, day) do update set user_id = excluded.user_id;
select private.ensure_sunday_pairs('00000000-0000-4000-9000-000000000001', 'TEST-W00') as paired;
