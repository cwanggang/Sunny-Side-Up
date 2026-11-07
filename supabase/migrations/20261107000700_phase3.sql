-- Phase 3: rhythm-scheduler bookkeeping + hourly cron (B3.1–B3.3).

-- One row per reminder actually sent, so cron retries or overlapping runs never double-push.
-- Server-only (service role); clients have no access.
create table public.scheduler_log (
  kind       text not null,          -- 'sunday' | 'spotlight' | 'birthday_eve' | 'birthday' | 'moment'
  user_id    uuid not null references public.profiles (id) on delete cascade, -- who was pushed
  circle_id  uuid not null references public.circles (id) on delete cascade,
  period_key text not null,          -- ISO week, date, or date:subject id
  sent_at    timestamptz not null default now(),
  primary key (kind, user_id, circle_id, period_key)
);
alter table public.scheduler_log enable row level security;
revoke all on public.scheduler_log from anon, authenticated;

-- Hourly at :05. The function decides per user whether it's the right local time.
select cron.schedule(
  'rhythm-scheduler-hourly',
  '5 * * * *',
  $$ select private.post_webhook('rhythm-scheduler', '{}'::jsonb) $$
);
