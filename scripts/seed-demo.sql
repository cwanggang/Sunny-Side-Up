-- B4.8: reset the demo circle with 21 days of history for the real demo cast (plan P0.14).
-- All four must have signed up in the app first; otherwise this errors with who is missing.
--   npx supabase db query --remote -f scripts/seed-demo.sql
-- (The (dev) demo screen's "reseed" button does the same through the demo-reseed function.)
select public.demo_reseed();
