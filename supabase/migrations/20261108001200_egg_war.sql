-- Design v0.5 "play!": egg wars (proposal: docs/proposals/egg-war-backend.md).
--   start  -> 24 h vote: each member opts in or out. Resolves when the countdown ends or when
--             everyone has voted. More than half the coop in -> live; otherwise called off.
--   live   -> 3 days. Opted-in players "snipe" each other: a candid photo tagged with who got
--             egged. Late joiners can opt in while it's live. Only opted-in players can be sniped.
--   over   -> final leaderboard kept on the war row (sniper - sniped); snipes + photos deleted.
-- Needs a coop of 3+. One vote/live war per coop. Notifications use the new type 'egg_war'.
-- Also: the demo cast's first names (nudge wording fallback fix) and two Informer views.

alter type public.notification_type add value if not exists 'egg_war';

create type public.egg_war_state  as enum ('vote', 'live', 'off', 'over');
create type public.egg_war_choice as enum ('in', 'out');

create table public.egg_wars (
  id               uuid primary key default gen_random_uuid(),
  circle_id        uuid not null references public.circles (id) on delete cascade,
  started_by       uuid references public.profiles (id) on delete set null,
  state            public.egg_war_state not null default 'vote',
  vote_ends_at     timestamptz not null,
  live_ends_at     timestamptz,
  members          int not null,          -- coop size when the vote resolved (or started)
  snipe_count      int not null default 0,
  final_board      jsonb,                 -- [{user_id, sniper, sniped, score}] once over
  created_at       timestamptz not null default now(),
  resolved_at      timestamptz
);
create unique index egg_wars_one_active on public.egg_wars (circle_id) where state in ('vote', 'live');
create index egg_wars_circle_idx on public.egg_wars (circle_id, created_at desc);

create table public.egg_war_people (
  war_id     uuid not null references public.egg_wars (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  choice     public.egg_war_choice not null,
  updated_at timestamptz not null default now(),
  primary key (war_id, user_id)
);

create table public.egg_war_snipes (
  id         uuid primary key default gen_random_uuid(),
  war_id     uuid not null references public.egg_wars (id) on delete cascade,
  circle_id  uuid not null references public.circles (id) on delete cascade,
  sniper_id  uuid not null references public.profiles (id) on delete cascade,
  target_id  uuid not null references public.profiles (id) on delete cascade,
  caption    text check (caption is null or length(caption) <= 100),
  media_path text not null,
  created_at timestamptz not null default now(),
  check (sniper_id <> target_id)
);
create index egg_war_snipes_war_idx on public.egg_war_snipes (war_id, created_at desc);

alter table public.egg_wars       enable row level security;
alter table public.egg_war_people enable row level security;
alter table public.egg_war_snipes enable row level security;

-- Read: coop members. Writes only through the RPCs below.
create policy egg_wars_select_member on public.egg_wars
  for select to authenticated using (private.is_circle_member(circle_id));
create policy egg_war_people_select_member on public.egg_war_people
  for select to authenticated using (
    exists (select 1 from public.egg_wars w where w.id = war_id and private.is_circle_member(w.circle_id)));
create policy egg_war_snipes_select_member on public.egg_war_snipes
  for select to authenticated using (private.is_circle_member(circle_id));

revoke all on public.egg_wars, public.egg_war_people, public.egg_war_snipes from anon, authenticated;
grant select on public.egg_wars, public.egg_war_people, public.egg_war_snipes to authenticated;

alter publication supabase_realtime add table public.egg_wars, public.egg_war_people, public.egg_war_snipes;

-- ---------- helpers ----------

create function private.egg_war_handle(p_user uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select '@' || coalesce(nullif(username, ''), 'someone') from public.profiles where id = p_user;
$$;

create function private.egg_war_board(p_war_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(to_jsonb(b) order by b.score desc, b.sniper desc, b.sniped asc), '[]'::jsonb)
  from (
    select p.user_id,
           (select count(*) from public.egg_war_snipes s where s.war_id = p_war_id and s.sniper_id = p.user_id)::int as sniper,
           (select count(*) from public.egg_war_snipes s where s.war_id = p_war_id and s.target_id = p.user_id)::int as sniped,
           ((select count(*) from public.egg_war_snipes s where s.war_id = p_war_id and s.sniper_id = p.user_id)
          - (select count(*) from public.egg_war_snipes s where s.war_id = p_war_id and s.target_id = p.user_id))::int as score
    from public.egg_war_people p
    where p.war_id = p_war_id and p.choice = 'in'
  ) b;
$$;

-- Moves every due war along. Called by cron each minute, and by the RPCs before they read/write.
create function private.advance_egg_wars()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  w       public.egg_wars;
  v_n     int := 0;
  v_mem   int;
  v_in    int;
  v_voted int;
  v_board jsonb;
  v_name  text;
  v_top   jsonb;
begin
  -- votes: countdown over, or everyone has voted
  for w in
    select * from public.egg_wars where state = 'vote' for update skip locked
  loop
    select count(*) into v_mem from public.circle_members where circle_id = w.circle_id;
    select count(*) filter (where choice = 'in'), count(*) into v_in, v_voted
      from public.egg_war_people p
      where p.war_id = w.id and exists (select 1 from public.circle_members m where m.circle_id = w.circle_id and m.user_id = p.user_id);
    continue when w.vote_ends_at > now() and v_voted < v_mem;
    select name into v_name from public.circles where id = w.circle_id;
    if v_in >= v_mem / 2 + 1 then
      update public.egg_wars set state = 'live', members = v_mem, live_ends_at = now() + interval '3 days', resolved_at = now()
       where id = w.id;
      perform private.create_notifications((
        select coalesce(jsonb_agg(jsonb_build_object(
          'user_id', p.user_id, 'type', 'egg_war', 'circle_id', w.circle_id, 'target_id', w.id::text,
          'title', 'the egg war has begun!', 'body', v_name || ' has 3 days. the yolk is your camera 🥚')), '[]'::jsonb)
        from public.egg_war_people p where p.war_id = w.id and p.choice = 'in'));
    else
      update public.egg_wars set state = 'off', members = v_mem, resolved_at = now() where id = w.id;
      perform private.create_notifications((
        select coalesce(jsonb_agg(jsonb_build_object(
          'user_id', p.user_id, 'type', 'egg_war', 'circle_id', w.circle_id, 'target_id', w.id::text,
          'title', 'egg war called off', 'body', 'not enough of ' || v_name || ' opted in. peace, for now.')), '[]'::jsonb)
        from public.egg_war_people p where p.war_id = w.id and p.choice = 'in'));
    end if;
    v_n := v_n + 1;
  end loop;

  -- live wars past their 3 days: keep the board, clear the feed (photos go with the snipes)
  for w in
    select * from public.egg_wars where state = 'live' and live_ends_at <= now() for update skip locked
  loop
    v_board := private.egg_war_board(w.id);
    update public.egg_wars
       set state = 'over', final_board = v_board, resolved_at = now(),
           snipe_count = (select count(*) from public.egg_war_snipes where war_id = w.id)
     where id = w.id;
    delete from public.egg_war_snipes where war_id = w.id;
    select name into v_name from public.circles where id = w.circle_id;
    v_top := v_board -> 0;
    perform private.create_notifications((
      select coalesce(jsonb_agg(jsonb_build_object(
        'user_id', m.user_id, 'type', 'egg_war', 'circle_id', w.circle_id, 'target_id', w.id::text,
        'title', 'the egg war is over',
        'body', v_name || ': ' || case when v_top is null then 'final scores are in.'
                                      else private.egg_war_handle((v_top ->> 'user_id')::uuid) || ' wins!' end)), '[]'::jsonb)
      from public.circle_members m where m.circle_id = w.circle_id));
    v_n := v_n + 1;
  end loop;
  return v_n;
end;
$$;

-- ---------- RPCs ----------

create function public.start_egg_war(p_circle_id uuid)
returns public.egg_wars
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me  uuid := auth.uid();
  v_mem int;
  w     public.egg_wars;
  v_name text;
begin
  if v_me is null or not private.is_circle_member(p_circle_id) then
    raise exception 'not a member of this coop' using errcode = '42501';
  end if;
  perform private.advance_egg_wars();
  select count(*) into v_mem from public.circle_members where circle_id = p_circle_id;
  if v_mem < 3 then
    raise exception 'you need at least 3 people in the coop for an egg war' using errcode = '22023';
  end if;
  if exists (select 1 from public.egg_wars where circle_id = p_circle_id and state in ('vote', 'live')) then
    raise exception 'this coop already has an egg war going' using errcode = '23505';
  end if;
  insert into public.egg_wars (circle_id, started_by, vote_ends_at, members)
  values (p_circle_id, v_me, now() + interval '24 hours', v_mem)
  returning * into w;
  insert into public.egg_war_people (war_id, user_id, choice) values (w.id, v_me, 'in');
  select name into v_name from public.circles where id = p_circle_id;
  perform private.create_notifications((
    select coalesce(jsonb_agg(jsonb_build_object(
      'user_id', m.user_id, 'type', 'egg_war', 'circle_id', p_circle_id, 'target_id', w.id::text,
      'title', v_name || ': egg war?',
      'body', private.egg_war_handle(v_me) || ' wants an egg war. you have 24 hours to opt in or out.')), '[]'::jsonb)
    from public.circle_members m where m.circle_id = p_circle_id and m.user_id <> v_me));
  return w;
end;
$$;

-- Opt in or out while the vote is open (change your mind any time before it resolves).
create function public.vote_egg_war(p_war_id uuid, p_choice public.egg_war_choice)
returns public.egg_wars
language plpgsql
security definer
set search_path = ''
as $$
declare
  w public.egg_wars;
begin
  select * into w from public.egg_wars where id = p_war_id;
  if w.id is null or not private.is_circle_member(w.circle_id) then
    raise exception 'egg war not found' using errcode = 'P0002';
  end if;
  if w.state <> 'vote' or w.vote_ends_at <= now() then
    raise exception 'voting is closed' using errcode = '22023';
  end if;
  insert into public.egg_war_people (war_id, user_id, choice) values (w.id, auth.uid(), p_choice)
  on conflict (war_id, user_id) do update set choice = excluded.choice, updated_at = now();
  perform private.advance_egg_wars();
  select * into w from public.egg_wars where id = p_war_id;
  return w;
end;
$$;

-- The person who started it can call it off while the vote is still open.
create function public.cancel_egg_war(p_war_id uuid)
returns public.egg_wars
language plpgsql
security definer
set search_path = ''
as $$
declare
  w public.egg_wars;
begin
  update public.egg_wars set state = 'off', resolved_at = now()
   where id = p_war_id and state = 'vote' and started_by = auth.uid()
  returning * into w;
  if w.id is null then
    raise exception 'only the person who started it can call it off, and only during the vote' using errcode = '42501';
  end if;
  return w;
end;
$$;

-- Join a live war late (opted out or never voted).
create function public.join_egg_war(p_war_id uuid)
returns public.egg_wars
language plpgsql
security definer
set search_path = ''
as $$
declare
  w public.egg_wars;
begin
  perform private.advance_egg_wars();
  select * into w from public.egg_wars where id = p_war_id;
  if w.id is null or not private.is_circle_member(w.circle_id) then
    raise exception 'egg war not found' using errcode = 'P0002';
  end if;
  if w.state <> 'live' then
    raise exception 'this egg war is not live' using errcode = '22023';
  end if;
  insert into public.egg_war_people (war_id, user_id, choice) values (w.id, auth.uid(), 'in')
  on conflict (war_id, user_id) do update set choice = 'in', updated_at = now();
  return w;
end;
$$;

-- A snipe: upload the photo to media/{circle_id}/{snipe_id}.jpg first, then call this.
create function public.post_snipe(p_war_id uuid, p_target_id uuid, p_media_path text, p_caption text default null, p_id uuid default null)
returns public.egg_war_snipes
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := auth.uid();
  w    public.egg_wars;
  s    public.egg_war_snipes;
  v_cap text := nullif(trim(coalesce(p_caption, '')), '');
begin
  perform private.advance_egg_wars();
  select * into w from public.egg_wars where id = p_war_id;
  if w.id is null or not private.is_circle_member(w.circle_id) then
    raise exception 'egg war not found' using errcode = 'P0002';
  end if;
  if w.state <> 'live' then
    raise exception 'this egg war is not live' using errcode = '22023';
  end if;
  if not exists (select 1 from public.egg_war_people where war_id = w.id and user_id = v_me and choice = 'in') then
    raise exception 'join the egg war first' using errcode = '42501';
  end if;
  if p_target_id = v_me
     or not exists (select 1 from public.egg_war_people where war_id = w.id and user_id = p_target_id and choice = 'in') then
    raise exception 'you can only egg someone who opted in' using errcode = '22023';
  end if;
  if (storage.foldername(p_media_path))[1] is distinct from w.circle_id::text then
    raise exception 'photo must be in this coop''s folder' using errcode = '22023';
  end if;
  if v_cap is not null and length(v_cap) > 100 then
    raise exception 'caption is 100 characters max' using errcode = '22001';
  end if;
  insert into public.egg_war_snipes (id, war_id, circle_id, sniper_id, target_id, caption, media_path)
  values (coalesce(p_id, gen_random_uuid()), w.id, w.circle_id, v_me, p_target_id, v_cap, p_media_path)
  returning * into s;
  perform private.create_notifications(jsonb_build_array(jsonb_build_object(
    'user_id', p_target_id, 'type', 'egg_war', 'circle_id', w.circle_id, 'target_id', w.id::text,
    'title', 'you got egged 🥚', 'body', private.egg_war_handle(v_me) || ' sniped you' || coalesce(': ' || v_cap, '!'))));
  return s;
end;
$$;

-- The sniper or the person in the photo can take a snipe down.
create function public.delete_snipe(p_snipe_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.egg_war_snipes
  where id = p_snipe_id and auth.uid() in (sniper_id, target_id);
  if not found then
    raise exception 'only the sniper or the person in the photo can delete it' using errcode = '42501';
  end if;
end;
$$;

-- Everything the play/war screens need for one coop: the current war (vote/live) or the latest
-- finished one, everyone's choice, the leaderboard, and how many opt-ins it takes.
create function public.egg_war_status(p_circle_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  w     public.egg_wars;
  v_mem int;
begin
  if not private.is_circle_member(p_circle_id) then
    raise exception 'not a member of this coop' using errcode = '42501';
  end if;
  perform private.advance_egg_wars();
  select count(*) into v_mem from public.circle_members where circle_id = p_circle_id;
  select * into w from public.egg_wars
   where circle_id = p_circle_id
   order by (state in ('vote', 'live')) desc, created_at desc
   limit 1;
  return jsonb_build_object(
    'members', v_mem,
    'need', v_mem / 2 + 1,
    'can_start', v_mem >= 3 and (w.id is null or w.state not in ('vote', 'live')),
    'war', case when w.id is null then null else jsonb_build_object(
      'id', w.id, 'state', w.state, 'started_by', w.started_by,
      'vote_ends_at', w.vote_ends_at, 'live_ends_at', w.live_ends_at, 'created_at', w.created_at,
      'people', (select coalesce(jsonb_agg(jsonb_build_object('user_id', p.user_id, 'choice', p.choice)), '[]'::jsonb)
                 from public.egg_war_people p where p.war_id = w.id),
      'board', case when w.state = 'over' then w.final_board else private.egg_war_board(w.id) end,
      'snipes', case when w.state = 'over' then w.snipe_count
                     else (select count(*) from public.egg_war_snipes s where s.war_id = w.id)::int end
    ) end);
end;
$$;

-- Demo only (the "skip to the end" links in the design): ends the countdown or the war now.
-- Works only in the demo circle, so it can't touch a real coop.
create function public.demo_skip_egg_war(p_war_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  w public.egg_wars;
begin
  select * into w from public.egg_wars where id = p_war_id;
  if w.id is null or w.circle_id <> '00000000-0000-4000-9000-0000000000d0'::uuid
     or not private.is_circle_member(w.circle_id) then
    raise exception 'demo coop only' using errcode = '42501';
  end if;
  update public.egg_wars
     set vote_ends_at = case when state = 'vote' then now() else vote_ends_at end,
         live_ends_at = case when state = 'live' then now() else live_ends_at end
   where id = w.id;
  perform private.advance_egg_wars();
  return public.egg_war_status(w.circle_id);
end;
$$;

revoke all on function
  public.start_egg_war(uuid), public.vote_egg_war(uuid, public.egg_war_choice), public.join_egg_war(uuid), public.cancel_egg_war(uuid),
  public.post_snipe(uuid, uuid, text, text, uuid), public.delete_snipe(uuid), public.egg_war_status(uuid),
  public.demo_skip_egg_war(uuid)
from public, anon;
grant execute on function
  public.start_egg_war(uuid), public.vote_egg_war(uuid, public.egg_war_choice), public.join_egg_war(uuid), public.cancel_egg_war(uuid),
  public.post_snipe(uuid, uuid, text, text, uuid), public.delete_snipe(uuid), public.egg_war_status(uuid),
  public.demo_skip_egg_war(uuid)
to authenticated;
revoke all on function private.advance_egg_wars(), private.egg_war_board(uuid), private.egg_war_handle(uuid)
  from public, anon, authenticated;

select cron.schedule('egg-wars', '* * * * *', $$ select private.advance_egg_wars() $$);

-- ---------- snipe photos: readable by the coop while the war is on; deleted with the snipe ----------
create or replace function private.can_read_media(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.interactions i where i.media_path = p_name and private.can_see_interaction(i.id))
      or exists (select 1 from public.shares s where s.media_path = p_name and private.can_see_share(s.id))
      or exists (
        select 1 from public.photos ph where ph.media_path = p_name
          and case when ph.event_id is null then private.is_circle_member(ph.circle_id)
                   else private.can_see_event(ph.event_id) end)
      or exists (select 1 from public.circles c where c.cover_path = p_name and private.is_circle_member(c.id))
      or exists (select 1 from public.egg_war_snipes s where s.media_path = p_name and private.is_circle_member(s.circle_id));
$$;

create trigger egg_war_snipes_media_cleanup
  after delete on public.egg_war_snipes
  for each row execute function private.notify_media_cleanup();

-- ---------- Informer (B4.5): de-identified egg war + nudge numbers ----------
create view analytics.egg_war_summary as
select left(md5('sunny-circle:' || w.circle_id::text), 10) as circle_key,
       w.created_at::date                                   as started_on,
       w.state::text                                        as state,
       w.members,
       (select count(*) from public.egg_war_people p where p.war_id = w.id and p.choice = 'in')::int as opted_in,
       case when w.state = 'over' then w.snipe_count
            else (select count(*) from public.egg_war_snipes s where s.war_id = w.id)::int end      as snipes
from public.egg_wars w;

-- All circles together, per day. No reason_kind (drift vs cover never leaves the server, §9.4).
create view analytics.nudge_daily as
select n.sent_at::date                                         as day,
       count(*)::int                                           as nudges_sent,
       count(n.acted_at)::int                                  as nudges_acted,
       round(100.0 * count(n.acted_at) / nullif(count(*), 0), 1) as acted_pct
from public.nudges n
group by 1;

grant select on analytics.egg_war_summary, analytics.nudge_daily to informer_ro;

-- ---------- demo: first names for the cast, a fresh egg war vote ----------
-- Ella and Caden never set a display name, so it was their email prefix ("ella7.ha"): the LLM
-- wrote "Ella", failed the must-contain-the-name check, and every drift nudge used fallback text.
alter function public.demo_reseed(text[]) rename to demo_reseed_core;
alter function public.demo_reseed_core(text[]) set schema private;
revoke all on function private.demo_reseed_core(text[]) from public, anon, authenticated;

create function public.demo_reseed(
  p_emails text[] default array['ella7.ha@gmail.com', 'river.jossy7@gmail.com', 'caden190wang@gmail.com']
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  c      constant uuid := '00000000-0000-4000-9000-0000000000d0';
  v_res  jsonb;
  v_ids  uuid[];
  v_war  uuid;
begin
  -- only names that were never set (still the email prefix) are changed
  update public.profiles p
     set display_name = v.name
    from auth.users u,
         (values ('ella7.ha@gmail.com', 'Ella'), ('river.jossy7@gmail.com', 'Jocelyn'), ('caden190wang@gmail.com', 'Caden')) v(email, name)
   where u.id = p.id and lower(u.email) = v.email and lower(u.email) = any (p_emails)
     and (p.display_name is null or trim(p.display_name) = '' or p.display_name = split_part(u.email, '@', 1));

  perform set_config('app.skip_webhooks', 'on', true);
  delete from public.egg_wars where circle_id = c;

  v_res := private.demo_reseed_core(p_emails);

  -- the last cast member (Caden) has started an egg war; the vote has ~20 h left
  select array_agg(u.id order by array_position(array(select lower(trim(e)) from unnest(p_emails) e), lower(u.email)))
    into v_ids from auth.users u where lower(u.email) = any (array(select lower(trim(e)) from unnest(p_emails) e));
  if cardinality(v_ids) >= 3 then
    insert into public.egg_wars (circle_id, started_by, vote_ends_at, members, created_at)
    values (c, v_ids[cardinality(v_ids)], now() + interval '20 hours', cardinality(v_ids), now() - interval '4 hours')
    returning id into v_war;
    insert into public.egg_war_people (war_id, user_id, choice) values (v_war, v_ids[cardinality(v_ids)], 'in');
  end if;
  return v_res || jsonb_build_object('egg_war', v_war);
end;
$$;
revoke all on function public.demo_reseed(text[]) from public, anon, authenticated;
grant execute on function public.demo_reseed(text[]) to service_role;
