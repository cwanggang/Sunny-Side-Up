-- Rehearsal: run the demo with the fake test accounts instead of the real cast
-- (maya = quiet member, sam = gets the nudge, jordan + priya = friends; password sunnyside-test).
-- Also makes maya a demo-circle member so `npm run upload-demo-photos` can upload photos.
--   npx supabase db query --remote -f scripts/seed-demo-rehearsal.sql     (from the repo root)
-- Afterwards, scripts/seed-demo.sql (or "Reset demo" in the app) puts the real cast back.
select public.demo_reseed(array['maya@sunnyside.test', 'sam@sunnyside.test',
                                'jordan@sunnyside.test', 'priya@sunnyside.test']);
