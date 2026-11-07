-- B0.2: the whole schema from plan.md §4.1 (tables, enums, views), including later phases.
-- RLS policies live in the next migration (B0.3).

-- ---------- enums ----------
create type public.circle_role      as enum ('owner', 'member');
create type public.interaction_kind as enum ('egg', 'photo', 'voice', 'text');
create type public.share_kind       as enum ('sunday', 'spotlight');
create type public.app_event_kind   as enum ('app_open');
create type public.nudge_reason     as enum ('drift', 'cover', 'birthday', 'moment', 'spotlight');

-- ---------- helpers ----------
-- 8-char invite code without look-alike characters (0/O, 1/I/L).
create or replace function public.generate_invite_code()
returns text
language sql
volatile
set search_path = ''
as $$
  select string_agg(substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', (floor(random() * 31) + 1)::int, 1), '')
  from generate_series(1, 8);
$$;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------- people ----------
create table public.profiles (
  id              uuid primary key references auth.users (id) on delete cascade,
  display_name    text not null default '',
  avatar_path     text,
  birthday        date,
  timezone        text not null default 'America/New_York',
  expo_push_token text,
  created_at      timestamptz not null default now()
);

create table public.consents (
  user_id      uuid primary key references public.profiles (id) on delete cascade,
  location     boolean not null default false,
  health       boolean not null default false,
  auto_nudges  boolean not null default true,
  paused_until timestamptz,
  updated_at   timestamptz not null default now()
);

create trigger consents_touch_updated_at
  before update on public.consents
  for each row execute function public.touch_updated_at();

-- ---------- circles ----------
create table public.circles (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (length(trim(name)) between 1 and 60),
  home_area   text,
  invite_code text not null unique default public.generate_invite_code(),
  created_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now()
);

create table public.circle_members (
  circle_id uuid not null references public.circles (id) on delete cascade,
  user_id   uuid not null references public.profiles (id) on delete cascade,
  role      public.circle_role not null default 'member',
  joined_at timestamptz not null default now(),
  primary key (circle_id, user_id)
);
create index circle_members_user_idx on public.circle_members (user_id);

-- ---------- interactions ----------
create table public.interactions (
  id           uuid primary key default gen_random_uuid(),
  circle_id    uuid not null references public.circles (id) on delete cascade,
  sender_id    uuid not null references public.profiles (id) on delete cascade,
  recipient_id uuid references public.profiles (id) on delete cascade, -- null = whole circle
  kind         public.interaction_kind not null,
  media_path   text,
  body         text,
  created_at   timestamptz not null default now(),
  check (kind not in ('photo', 'voice') or media_path is not null)
);
create index interactions_circle_created_idx on public.interactions (circle_id, created_at desc);
create index interactions_sender_idx on public.interactions (sender_id, created_at);
create index interactions_recipient_idx on public.interactions (recipient_id, created_at);
create index interactions_media_path_idx on public.interactions (media_path) where media_path is not null;

create table public.reactions (
  interaction_id uuid not null references public.interactions (id) on delete cascade,
  user_id        uuid not null references public.profiles (id) on delete cascade,
  emoji          text not null check (length(emoji) between 1 and 16),
  created_at     timestamptz not null default now(),
  primary key (interaction_id, user_id, emoji)
);
create index reactions_user_idx on public.reactions (user_id, created_at);

-- ---------- rhythm ----------
create table public.shares (
  id         uuid primary key default gen_random_uuid(),
  circle_id  uuid not null references public.circles (id) on delete cascade,
  author_id  uuid not null references public.profiles (id) on delete cascade,
  kind       public.share_kind not null,
  period_key text not null, -- e.g. '2026-W45' (sunday) or '2026-11-07' (spotlight)
  body       text,
  media_path text,
  created_at timestamptz not null default now()
);
create index shares_circle_period_idx on public.shares (circle_id, kind, period_key);
create index shares_media_path_idx on public.shares (media_path) where media_path is not null;

create table public.spotlight_days (
  circle_id uuid not null references public.circles (id) on delete cascade,
  day       date not null,
  user_id   uuid not null references public.profiles (id) on delete cascade,
  primary key (circle_id, day)
);

create table public.moments (
  id         uuid primary key default gen_random_uuid(),
  circle_id  uuid not null references public.circles (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  title      text not null check (length(trim(title)) between 1 and 120),
  occurs_on  date not null,
  created_at timestamptz not null default now()
);
create index moments_circle_date_idx on public.moments (circle_id, occurs_on);

-- ---------- signals (counts and daily summary numbers only) ----------
create table public.app_events (
  id      bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  kind    public.app_event_kind not null default 'app_open',
  at      timestamptz not null default now()
);
create index app_events_user_at_idx on public.app_events (user_id, at);

create table public.daily_signals (
  user_id              uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  day                  date not null,
  hours_away_from_home numeric(4, 1) check (hours_away_from_home between 0 and 24),
  places_visited       integer check (places_visited >= 0),
  sleep_hours          numeric(4, 1) check (sleep_hours between 0 and 24),
  steps                integer check (steps >= 0),
  uploaded_at          timestamptz not null default now(),
  primary key (user_id, day)
);

-- ---------- server-only ----------
create table public.engagement_daily (
  user_id   uuid not null references public.profiles (id) on delete cascade,
  circle_id uuid not null references public.circles (id) on delete cascade,
  day       date not null,
  sent      integer not null default 0,
  received  integer not null default 0,
  opens     integer not null default 0,
  primary key (user_id, circle_id, day)
);

create table public.drift_scores (
  user_id   uuid not null references public.profiles (id) on delete cascade,
  circle_id uuid not null references public.circles (id) on delete cascade,
  day       date not null,
  score     numeric not null,
  is_quiet  boolean not null default false,
  primary key (user_id, circle_id, day)
);

create table public.nudges (
  id            uuid primary key default gen_random_uuid(),
  circle_id     uuid not null references public.circles (id) on delete cascade,
  recipient_id  uuid not null references public.profiles (id) on delete cascade,
  about_user_id uuid not null references public.profiles (id) on delete cascade,
  reason_kind   public.nudge_reason not null,
  message       text not null,
  sent_at       timestamptz not null default now(),
  acted_at      timestamptz
);
create index nudges_recipient_idx on public.nudges (recipient_id, sent_at desc);
create index nudges_about_idx on public.nudges (about_user_id, sent_at desc);

-- ---------- realtime (useFeed live updates) ----------
alter publication supabase_realtime add table public.interactions, public.reactions;

-- ---------- views ----------
-- Both views run with the owner's rights (not security_invoker) so they can read base tables
-- that clients can't, and they filter to the caller themselves.

-- Safe profile fields for everyone in my circles. Never exposes expo_push_token or timezone.
create view public.circle_profiles
with (security_barrier = true)
as
select cm.circle_id,
       p.id,
       p.display_name,
       p.avatar_path,
       p.birthday,
       cm.role,
       cm.joined_at
from public.circle_members cm
join public.profiles p on p.id = cm.user_id
where exists (
  select 1 from public.circle_members me
  where me.circle_id = cm.circle_id and me.user_id = auth.uid()
);

-- Nudges I received. Hides reason_kind (privacy rule 4). Only acted_at is writable (see RLS migration).
create view public.my_nudges
with (security_barrier = true)
as
select id, circle_id, about_user_id, message, sent_at, acted_at
from public.nudges
where recipient_id = auth.uid();
