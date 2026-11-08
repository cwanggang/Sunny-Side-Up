-- Design v0.4 (artifact update 2026-11-08): coops, profiles, events, gallery, daily streak.
--   coops      circles.description + cover_path, ABC-123 invite codes, create_circle(description),
--              coop_overview() (members, streak, today's person) for home and the carton
--   profiles   username (unique), egg_style (the egg in friends' cartons), facts ("about me")
--   events     events + event_people (lead, edit/comment/view, opted out; guests from my other
--              coops allowed) + event_messages (temporary chat) + photos (event albums)
--   gallery    photos with event_id null = the coop's gallery
--   daily      circle_daily(): last N days: whose day, prompt, posted, first photo
-- Notifications: new type 'event' (added to an event, chat messages, morning-of reminder).
-- Privacy (plan §9): chat is never analyzed; drift only counts messages/photos like other posts.

-- ---------- notification type ----------
alter type public.notification_type add value if not exists 'event';

-- ---------- coops ----------
alter table public.circles
  add column description text check (description is null or length(description) <= 120),
  add column cover_path  text;
grant update (description, cover_path) on public.circles to authenticated;

-- New codes: 3 letters + 3 digits (shown as RMS-482). Stored without the dash; join_circle
-- already strips punctuation, so "rms-482", "RMS482" and old 8-character codes all work.
create or replace function private.generate_invite_code()
returns text
language sql
volatile
set search_path = ''
as $$
  select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ', 1 + floor(random() * 24)::int, 1), '')
         || lpad(floor(random() * 1000)::int::text, 3, '0')
  from generate_series(1, 3);
$$;

drop function public.create_circle(text, text);
create function public.create_circle(name text, home_area text default null, description text default null)
returns public.circles
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_uid    uuid := auth.uid();
  v_circle public.circles;
begin
  if v_uid is null then
    raise exception 'Not signed in' using errcode = '28000';
  end if;
  if create_circle.name is null or length(trim(create_circle.name)) = 0 then
    raise exception 'Coop name is required' using errcode = '22023';
  end if;
  loop
    begin
      insert into public.circles (name, home_area, description, created_by, invite_code)
      values (left(trim(create_circle.name), 40), nullif(trim(create_circle.home_area), ''),
              nullif(left(trim(coalesce(create_circle.description, '')), 120), ''), v_uid,
              private.generate_invite_code())
      returning * into v_circle;
      exit;
    exception when unique_violation then
      -- invite code collision: try another one
    end;
  end loop;
  insert into public.circle_members (circle_id, user_id, role) values (v_circle.id, v_uid, 'owner');
  return v_circle;
end;
$$;
revoke all on function public.create_circle(text, text, text) from public, anon;
grant execute on function public.create_circle(text, text, text) to authenticated;

-- ---------- profiles ----------
alter table public.profiles
  add column username  text,
  add column egg_style jsonb not null default '{"swatch":"butter","pattern":"dots"}',
  add column facts     jsonb not null default '[]';

-- usernames: a-z 0-9 . _ , 2-18 chars; backfill from display_name / email, deduplicated
create function private.username_base(p_text text)
returns text
language sql
immutable
set search_path = ''
as $$
  select coalesce(nullif(left(regexp_replace(lower(coalesce(p_text, '')), '[^a-z0-9._]', '', 'g'), 14), ''), 'egg');
$$;

create function private.unique_username(p_text text, p_self uuid default null)
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_base text := private.username_base(p_text);
  v_try  text := v_base;
  n      int := 1;
begin
  if length(v_try) < 2 then v_try := v_try || '1'; v_base := v_try; end if;
  while exists (select 1 from public.profiles p where p.username = v_try and p.id is distinct from p_self) loop
    n := n + 1;
    v_try := v_base || n::text;
  end loop;
  return v_try;
end;
$$;

do $$
declare r record;
begin
  for r in select p.id, p.display_name, u.email from public.profiles p join auth.users u on u.id = p.id
           where p.username is null order by p.created_at loop
    update public.profiles
    set username = private.unique_username(coalesce(nullif(r.display_name, ''), split_part(r.email, '@', 1)), r.id)
    where id = r.id;
  end loop;
end;
$$;

alter table public.profiles
  alter column username set not null,
  add constraint profiles_username_format check (username ~ '^[a-z0-9._]{2,18}$'),
  add constraint profiles_username_unique unique (username),
  add constraint profiles_egg_style_object check (jsonb_typeof(egg_style) = 'object'),
  add constraint profiles_facts_array check (jsonb_typeof(facts) = 'array' and jsonb_array_length(facts) <= 12);
grant update (username, egg_style, facts) on public.profiles to authenticated;

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
    nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
    '');
begin
  insert into public.profiles (id, display_name, username)
  values (new.id, v_name, private.unique_username(coalesce(nullif(v_name, ''), split_part(coalesce(new.email, ''), '@', 1))))
  on conflict (id) do nothing;
  insert into public.consents (user_id) values (new.id) on conflict (user_id) do nothing;
  return new;
end;
$$;

-- Is this username free (for the profile screen)? True for my own current one.
create function public.username_available(p_username text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_username ~ '^[a-z0-9._]{2,18}$'
     and not exists (select 1 from public.profiles p where p.username = p_username and p.id <> auth.uid());
$$;
revoke all on function public.username_available(text) from public, anon;
grant execute on function public.username_available(text) to authenticated;

-- circle_profiles: + username, egg_style, facts (what friends see when they crack your egg)
drop view public.circle_profiles;
drop function private.circle_profiles_rows();
create function private.circle_profiles_rows()
returns table (
  circle_id    uuid,
  id           uuid,
  display_name text,
  avatar_path  text,
  birthday     date,
  role         public.circle_role,
  joined_at    timestamptz,
  username     text,
  egg_style    jsonb,
  facts        jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  select cm.circle_id, p.id, p.display_name, p.avatar_path, p.birthday, cm.role, cm.joined_at,
         p.username, p.egg_style, p.facts
  from public.circle_members cm
  join public.profiles p on p.id = cm.user_id
  where private.is_circle_member(cm.circle_id);
$$;
revoke all on function private.circle_profiles_rows() from public, anon;
grant execute on function private.circle_profiles_rows() to authenticated;
create view public.circle_profiles
with (security_invoker = true)
as select * from private.circle_profiles_rows();
revoke all on public.circle_profiles from anon, authenticated;
grant select on public.circle_profiles to authenticated;

-- ---------- events ----------
create type public.event_role as enum ('edit', 'comment', 'view');

create table public.events (
  id              uuid primary key default gen_random_uuid(),
  circle_id       uuid not null references public.circles (id) on delete cascade,
  title           text not null check (length(trim(title)) between 1 and 40),
  starts_at       timestamptz not null,
  location        text check (location is null or length(location) <= 60),
  description     text check (description is null or length(description) <= 200),
  chat_enabled    boolean not null default true,
  gallery_enabled boolean not null default true,
  chat_days_after int not null default 1 check (chat_days_after in (0, 1, 3, 7)),
  created_by      uuid references public.profiles (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index events_circle_start_idx on public.events (circle_id, starts_at);
create trigger events_touch_updated_at before update on public.events
  for each row execute function private.touch_updated_at();

create table public.event_people (
  event_id  uuid not null references public.events (id) on delete cascade,
  user_id   uuid not null references public.profiles (id) on delete cascade,
  role      public.event_role not null default 'view',
  is_lead   boolean not null default false,
  opted_out boolean not null default false,
  added_at  timestamptz not null default now(),
  primary key (event_id, user_id)
);
create index event_people_user_idx on public.event_people (user_id);

create table public.event_messages (
  id         uuid primary key default gen_random_uuid(),
  event_id   uuid not null references public.events (id) on delete cascade,
  sender_id  uuid not null references public.profiles (id) on delete cascade,
  body       text not null check (length(trim(body)) between 1 and 300),
  created_at timestamptz not null default now()
);
create index event_messages_event_idx on public.event_messages (event_id, created_at);

-- coop gallery (event_id null) and event albums (event_id set)
create table public.photos (
  id         uuid primary key default gen_random_uuid(),
  circle_id  uuid not null references public.circles (id) on delete cascade,
  event_id   uuid references public.events (id) on delete cascade,
  author_id  uuid not null references public.profiles (id) on delete cascade,
  media_path text not null,
  width      int check (width is null or width > 0),
  height     int check (height is null or height > 0),
  created_at timestamptz not null default now()
);
create index photos_circle_idx on public.photos (circle_id, created_at desc);
create index photos_event_idx on public.photos (event_id, created_at desc) where event_id is not null;
create index photos_media_path_idx on public.photos (media_path);

alter publication supabase_realtime add table public.event_messages, public.event_people;

-- ---------- helpers ----------
create function private.can_see_event(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.events e
    where e.id = p_event_id
      and (private.is_circle_member(e.circle_id)
           or exists (select 1 from public.event_people p where p.event_id = e.id and p.user_id = auth.uid()))
  );
$$;

-- 'lead' | 'edit' | 'comment' | 'view' | null (not on the event)
create function private.my_event_role(p_event_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case when p.is_lead then 'lead' else p.role::text end
  from public.event_people p where p.event_id = p_event_id and p.user_id = auth.uid();
$$;

create function private.event_chat_closes(p_event public.events)
returns timestamptz
language sql
immutable
set search_path = ''
as $$
  select p_event.starts_at + interval '3 hours' + p_event.chat_days_after * interval '1 day';
$$;

-- Do I share an event with this person (for avatars and event_profiles)?
create function private.shares_event_with(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.event_people a join public.event_people b on b.event_id = a.event_id
    where a.user_id = auth.uid() and b.user_id = p_user_id
  );
$$;

grant execute on function private.can_see_event(uuid), private.my_event_role(uuid),
  private.event_chat_closes(public.events), private.shares_event_with(uuid) to authenticated;

-- ---------- RLS ----------
alter table public.events         enable row level security;
alter table public.event_people   enable row level security;
alter table public.event_messages enable row level security;
alter table public.photos         enable row level security;
revoke all on public.events, public.event_people, public.event_messages, public.photos from anon, authenticated;

grant select on public.events, public.event_people, public.event_messages, public.photos to authenticated;
grant insert (event_id, sender_id, body) on public.event_messages to authenticated;
grant insert (id, circle_id, event_id, author_id, media_path, width, height) on public.photos to authenticated;
grant delete on public.photos, public.event_messages to authenticated;

create policy events_select_visible on public.events
  for select to authenticated using (private.can_see_event(id));
grant delete on public.events to authenticated;
create policy events_delete_lead on public.events
  for delete to authenticated using (private.my_event_role(id) = 'lead');
create policy event_people_select_visible on public.event_people
  for select to authenticated using (private.can_see_event(event_id));

create policy event_messages_select_visible on public.event_messages
  for select to authenticated using (private.can_see_event(event_id));
-- write: I'm on the event, haven't opted out, and the chat is on and still open
create policy event_messages_insert_open on public.event_messages
  for insert to authenticated with check (
    sender_id = (select auth.uid())
    and exists (
      select 1 from public.events e join public.event_people p on p.event_id = e.id
      where e.id = event_messages.event_id and p.user_id = (select auth.uid()) and not p.opted_out
        and e.chat_enabled and now() < private.event_chat_closes(e)
    )
  );
create policy event_messages_delete_own on public.event_messages
  for delete to authenticated using (sender_id = (select auth.uid()));

create policy photos_select_visible on public.photos
  for select to authenticated using (
    case when event_id is null then private.is_circle_member(circle_id)
         else private.can_see_event(event_id) end
  );
create policy photos_insert_author on public.photos
  for insert to authenticated with check (
    author_id = (select auth.uid())
    and private.owns_media(media_path)
    and case
      when event_id is null then private.is_circle_member(circle_id) and media_path like circle_id::text || '/%'
      else exists (
        select 1 from public.events e
        where e.id = photos.event_id and e.circle_id = photos.circle_id and e.gallery_enabled
          and (private.is_circle_member(e.circle_id) or private.my_event_role(e.id) is not null)
      ) and (media_path like circle_id::text || '/%' or media_path like 'events/' || event_id::text || '/%')
    end
  );
create policy photos_delete_author on public.photos
  for delete to authenticated using (author_id = (select auth.uid()));

-- ---------- storage ----------
-- event guests (not coop members) upload to events/{event_id}/...
create policy media_insert_event on storage.objects
  for insert to authenticated with check (
    bucket_id = 'media'
    and (storage.foldername(name))[1] = 'events'
    and private.my_event_role(private.try_uuid((storage.foldername(name))[2])) is not null
  );
-- avatars of people I share an event with
create policy media_select_event_avatars on storage.objects
  for select to authenticated using (
    bucket_id = 'media'
    and (storage.foldername(name))[1] = 'avatars'
    and private.shares_event_with(private.try_uuid((storage.foldername(name))[2]))
  );

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
      or exists (select 1 from public.circles c where c.cover_path = p_name and private.is_circle_member(c.id));
$$;

create trigger photos_media_cleanup
  after delete on public.photos
  for each row execute function private.notify_media_cleanup();

-- ---------- profiles of people on my events (guests aren't in circle_profiles) ----------
create function private.event_profiles_rows()
returns table (event_id uuid, id uuid, display_name text, username text, avatar_path text, egg_style jsonb)
language sql
stable
security definer
set search_path = ''
as $$
  select ep.event_id, p.id, p.display_name, p.username, p.avatar_path, p.egg_style
  from public.event_people ep
  join public.profiles p on p.id = ep.user_id
  where private.can_see_event(ep.event_id);
$$;
revoke all on function private.event_profiles_rows() from public, anon;
grant execute on function private.event_profiles_rows() to authenticated;
create view public.event_profiles with (security_invoker = true) as select * from private.event_profiles_rows();
revoke all on public.event_profiles from anon, authenticated;
grant select on public.event_profiles to authenticated;

-- ---------- event RPCs ----------
-- p_people: [{ "user_id": uuid, "role": "edit"|"comment"|"view", "lead": bool }]. The caller is
-- always added as a lead. Guests must share a coop with the caller ("contacts").
create function private.add_event_people(p_event public.events, p_people jsonb, p_by uuid)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rows   jsonb;
  v_n      int;
  v_who    text;
  v_circle text;
begin
  with incoming as (
    select (x ->> 'user_id')::uuid as user_id,
           coalesce(nullif(x ->> 'role', ''), 'view')::public.event_role as role,
           coalesce((x ->> 'lead')::boolean, false) as is_lead
    from jsonb_array_elements(coalesce(p_people, '[]'::jsonb)) x
  ),
  allowed as (
    select distinct on (i.user_id) i.* from incoming i
    where i.user_id <> p_by
      and exists (
        select 1 from public.circle_members a join public.circle_members b on b.circle_id = a.circle_id
        where a.user_id = p_by and b.user_id = i.user_id)
  ),
  ins as (
    insert into public.event_people (event_id, user_id, role, is_lead)
    select p_event.id, a.user_id, case when a.is_lead then 'edit'::public.event_role else a.role end, a.is_lead
    from allowed a
    on conflict (event_id, user_id) do nothing
    returning user_id
  )
  select coalesce(jsonb_agg(user_id), '[]'::jsonb) into v_rows from ins;
  v_n := jsonb_array_length(v_rows);

  if v_n > 0 and coalesce(current_setting('app.skip_webhooks', true), '') <> 'on' then
    select coalesce(nullif(split_part(trim(display_name), ' ', 1), ''), 'someone') into v_who from public.profiles where id = p_by;
    select name into v_circle from public.circles where id = p_event.circle_id;
    perform private.create_notifications((
      select jsonb_agg(jsonb_build_object(
        'user_id', u, 'type', 'event', 'circle_id', p_event.circle_id, 'target_id', p_event.id::text,
        'title', coalesce(v_circle, 'Sunny Side Up'),
        'body', coalesce(v_who, 'someone') || ' added you to ' || p_event.title || ' 📅'))
      from jsonb_array_elements_text(v_rows) u), true);
  end if;
  return v_n;
end;
$$;

create function public.create_event(
  p_circle_id uuid, p_title text, p_starts_at timestamptz, p_location text default null,
  p_description text default null, p_people jsonb default '[]', p_chat_enabled boolean default true,
  p_gallery_enabled boolean default true, p_chat_days_after int default 1
)
returns public.events
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_e   public.events;
begin
  if v_uid is null then raise exception 'Not signed in' using errcode = '28000'; end if;
  if not private.is_circle_member(p_circle_id) then
    raise exception 'Not a member of this coop' using errcode = '42501';
  end if;
  insert into public.events (circle_id, title, starts_at, location, description, chat_enabled, gallery_enabled, chat_days_after, created_by)
  values (p_circle_id, trim(p_title), p_starts_at, nullif(trim(coalesce(p_location, '')), ''),
          nullif(trim(coalesce(p_description, '')), ''), p_chat_enabled, p_gallery_enabled, p_chat_days_after, v_uid)
  returning * into v_e;
  insert into public.event_people (event_id, user_id, role, is_lead) values (v_e.id, v_uid, 'edit', true);
  perform private.add_event_people(v_e, p_people, v_uid);
  return v_e;
end;
$$;

-- details: leads and 'edit' people. Pass only what changes (nulls are kept).
create function public.update_event(
  p_event_id uuid, p_title text default null, p_starts_at timestamptz default null, p_location text default null,
  p_description text default null, p_chat_enabled boolean default null, p_gallery_enabled boolean default null
)
returns public.events
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_e public.events;
begin
  if coalesce(private.my_event_role(p_event_id), '') not in ('lead', 'edit') then
    raise exception 'Only event leads and editors can change this event' using errcode = '42501';
  end if;
  update public.events set
    title = coalesce(nullif(trim(p_title), ''), title),
    starts_at = coalesce(p_starts_at, starts_at),
    location = case when p_location is null then location else nullif(trim(p_location), '') end,
    description = case when p_description is null then description else nullif(trim(p_description), '') end,
    chat_enabled = coalesce(p_chat_enabled, chat_enabled),
    gallery_enabled = coalesce(p_gallery_enabled, gallery_enabled)
  where id = p_event_id
  returning * into v_e;
  return v_e;
end;
$$;

create function public.add_people_to_event(p_event_id uuid, p_people jsonb)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_e public.events;
begin
  if coalesce(private.my_event_role(p_event_id), '') not in ('lead', 'edit') then
    raise exception 'Only event leads and editors can add people' using errcode = '42501';
  end if;
  select * into v_e from public.events where id = p_event_id;
  return private.add_event_people(v_e, p_people, auth.uid());
end;
$$;

-- leads only: someone's role, lead flag, or remove them
create function public.set_event_person(p_event_id uuid, p_user_id uuid, p_role public.event_role default null,
                                        p_lead boolean default null, p_remove boolean default false)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if private.my_event_role(p_event_id) is distinct from 'lead' then
    raise exception 'Only event leads can change people' using errcode = '42501';
  end if;
  if p_remove then
    delete from public.event_people where event_id = p_event_id and user_id = p_user_id and user_id <> auth.uid();
    return;
  end if;
  update public.event_people set
    role = coalesce(p_role, role),
    is_lead = coalesce(p_lead, is_lead)
  where event_id = p_event_id and user_id = p_user_id;
  if not exists (select 1 from public.event_people where event_id = p_event_id and is_lead) then
    raise exception 'An event needs at least one lead' using errcode = '22023';
  end if;
end;
$$;

-- anyone on the event: opt out / back in (opted-out people leave the chat)
create function public.set_event_opt_out(p_event_id uuid, p_out boolean)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.event_people set opted_out = p_out where event_id = p_event_id and user_id = auth.uid();
$$;

-- leads only: how long the chat stays open after the event (0, 1, 3 or 7 days)
create function public.set_event_chat_timer(p_event_id uuid, p_days int)
returns public.events
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_e public.events;
begin
  if private.my_event_role(p_event_id) is distinct from 'lead' then
    raise exception 'Only event leads can change the chat timer' using errcode = '42501';
  end if;
  update public.events set chat_days_after = p_days where id = p_event_id returning * into v_e;
  return v_e;
end;
$$;

-- leads only: a guest who came can be added to the coop afterwards
create function public.add_event_guest_to_circle(p_event_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_circle uuid;
begin
  if private.my_event_role(p_event_id) is distinct from 'lead' then
    raise exception 'Only event leads can add guests to the coop' using errcode = '42501';
  end if;
  select circle_id into v_circle from public.events where id = p_event_id;
  if not exists (select 1 from public.event_people where event_id = p_event_id and user_id = p_user_id) then
    raise exception 'That person is not on this event' using errcode = '22023';
  end if;
  insert into public.circle_members (circle_id, user_id, role) values (v_circle, p_user_id, 'member')
  on conflict (circle_id, user_id) do nothing;
end;
$$;

revoke all on function
  public.create_event(uuid, text, timestamptz, text, text, jsonb, boolean, boolean, int),
  public.update_event(uuid, text, timestamptz, text, text, boolean, boolean),
  public.add_people_to_event(uuid, jsonb),
  public.set_event_person(uuid, uuid, public.event_role, boolean, boolean),
  public.set_event_opt_out(uuid, boolean),
  public.set_event_chat_timer(uuid, int),
  public.add_event_guest_to_circle(uuid, uuid)
from public, anon;
grant execute on function
  public.create_event(uuid, text, timestamptz, text, text, jsonb, boolean, boolean, int),
  public.update_event(uuid, text, timestamptz, text, text, boolean, boolean),
  public.add_people_to_event(uuid, jsonb),
  public.set_event_person(uuid, uuid, public.event_role, boolean, boolean),
  public.set_event_opt_out(uuid, boolean),
  public.set_event_chat_timer(uuid, int),
  public.add_event_guest_to_circle(uuid, uuid)
to authenticated;
revoke all on function private.add_event_people(public.events, jsonb, uuid) from public, anon, authenticated;

-- chat message -> everyone else on the event who hasn't opted out
create function private.notify_on_event_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_e    public.events;
  v_who  text;
  v_text text := trim(new.body);
begin
  if coalesce(current_setting('app.skip_webhooks', true), '') = 'on'
     or new.created_at < now() - interval '10 minutes' then
    return null;
  end if;
  select * into v_e from public.events where id = new.event_id;
  select coalesce(nullif(username, ''), 'someone') into v_who from public.profiles where id = new.sender_id;
  perform private.create_notifications((
    select coalesce(jsonb_agg(jsonb_build_object(
      'user_id', p.user_id, 'type', 'event', 'circle_id', v_e.circle_id, 'target_id', v_e.id::text,
      'title', v_e.title,
      'body', v_who || ': ' || case when length(v_text) > 120 then left(v_text, 119) || '…' else v_text end)), '[]'::jsonb)
    from public.event_people p
    where p.event_id = v_e.id and p.user_id <> new.sender_id and not p.opted_out), true);
  return null;
end;
$$;
create trigger event_messages_notify
  after insert on public.event_messages
  for each row execute function private.notify_on_event_message();

-- ---------- coop overview: home list + carton header ----------
-- streak = consecutive days (ending yesterday) where the day's person posted the daily photo,
-- + 1 if today's photo is already up.
create function private.circle_streak(p_circle_id uuid, p_today date)
returns int
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  n int := 0;
  d date := p_today - 1;
begin
  while exists (
    select 1 from public.shares s
    where s.circle_id = p_circle_id and s.kind = 'spotlight' and s.period_key = to_char(d, 'YYYY-MM-DD')
  ) and n < 3650 loop
    n := n + 1;
    d := d - 1;
  end loop;
  if exists (select 1 from public.shares s where s.circle_id = p_circle_id and s.kind = 'spotlight'
             and s.period_key = to_char(p_today, 'YYYY-MM-DD')) then
    n := n + 1;
  end if;
  return n;
end;
$$;

create function public.coop_overview(p_today date default null)
returns table (
  id uuid, name text, description text, cover_path text, invite_code text, home_area text,
  members int, streak int, today_user_id uuid, today_posted boolean, joined_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  with me as (select auth.uid() as uid, coalesce(p_today, (now() at time zone 'America/New_York')::date) as today)
  select c.id, c.name, c.description, c.cover_path, c.invite_code, c.home_area,
         (select count(*)::int from public.circle_members m where m.circle_id = c.id),
         private.circle_streak(c.id, me.today),
         (select s.user_id from public.spotlight_days s where s.circle_id = c.id and s.day = me.today),
         exists (select 1 from public.shares s where s.circle_id = c.id and s.kind = 'spotlight'
                 and s.period_key = to_char(me.today, 'YYYY-MM-DD')),
         cm.joined_at
  from me
  join public.circle_members cm on cm.user_id = me.uid
  join public.circles c on c.id = cm.circle_id
  order by cm.joined_at;
$$;
revoke all on function public.coop_overview(date) from public, anon;
grant execute on function public.coop_overview(date) to authenticated;

-- daily: the last p_days days (today first): whose day, the prompt, posted, first photo
create function public.circle_daily(p_circle_id uuid, p_today date default null, p_days int default 7)
returns table (day date, user_id uuid, prompt text, posted boolean, share_id uuid, media_path text, posted_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  with t as (select coalesce(p_today, (now() at time zone 'America/New_York')::date) as today)
  select d.day::date, sd.user_id, public.daily_prompt(d.day::date), sh.id is not null, sh.id, sh.media_path, sh.created_at
  from t
  cross join generate_series(t.today, t.today - (least(greatest(p_days, 1), 31) - 1), interval '-1 day') d(day)
  left join public.spotlight_days sd on sd.circle_id = p_circle_id and sd.day = d.day::date
  left join lateral (
    select s.id, s.media_path, s.created_at from public.shares s
    where s.circle_id = p_circle_id and s.kind = 'spotlight' and s.period_key = to_char(d.day, 'YYYY-MM-DD')
    order by (s.media_path is null), s.created_at limit 1
  ) sh on true
  where private.is_circle_member(p_circle_id)
  order by 1 desc;
$$;
revoke all on function public.circle_daily(uuid, date, int) from public, anon;
grant execute on function public.circle_daily(uuid, date, int) to authenticated;

-- ---------- engagement: photos and event chat count as posts (counts only, never content) ----------
create or replace function private.build_engagement(p_from date, p_to date)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rows integer;
begin
  delete from public.engagement_daily where day between p_from and p_to;

  with tz as (
    select id as user_id, coalesce(nullif(timezone, ''), 'America/New_York') as tz from public.profiles
  ),
  mem as (
    select m.circle_id, m.user_id, (m.joined_at at time zone t.tz)::date as joined_day
    from public.circle_members m join tz t on t.user_id = m.user_id
  ),
  sent as (
    select i.sender_id as user_id, i.circle_id, (i.created_at at time zone t.tz)::date as day, count(*) as n
    from public.interactions i join tz t on t.user_id = i.sender_id group by 1, 2, 3
    union all
    select r.user_id, i.circle_id, (r.created_at at time zone t.tz)::date, count(*)
    from public.reactions r join public.interactions i on i.id = r.interaction_id
    join tz t on t.user_id = r.user_id group by 1, 2, 3
    union all
    select s.author_id, s.circle_id, (s.created_at at time zone t.tz)::date, count(*)
    from public.shares s join tz t on t.user_id = s.author_id group by 1, 2, 3
    union all
    select sr.user_id, s.circle_id, (sr.created_at at time zone t.tz)::date, count(*)
    from public.share_reactions sr join public.shares s on s.id = sr.share_id
    join tz t on t.user_id = sr.user_id group by 1, 2, 3
    union all
    select ph.author_id, ph.circle_id, (ph.created_at at time zone t.tz)::date, count(*)
    from public.photos ph join tz t on t.user_id = ph.author_id group by 1, 2, 3
    union all
    select em.sender_id, e.circle_id, (em.created_at at time zone t.tz)::date, count(*)
    from public.event_messages em join public.events e on e.id = em.event_id
    join tz t on t.user_id = em.sender_id group by 1, 2, 3
  ),
  received as (
    select i.recipient_id as user_id, i.circle_id, (i.created_at at time zone t.tz)::date as day, count(*) as n
    from public.interactions i join tz t on t.user_id = i.recipient_id
    where i.recipient_id is not null group by 1, 2, 3
    union all
    select m.user_id, i.circle_id, (i.created_at at time zone t.tz)::date, count(*)
    from public.interactions i
    join public.circle_members m on m.circle_id = i.circle_id and m.user_id <> i.sender_id
    join tz t on t.user_id = m.user_id
    where i.recipient_id is null group by 1, 2, 3
    union all
    select i.sender_id, i.circle_id, (r.created_at at time zone t.tz)::date, count(*)
    from public.reactions r join public.interactions i on i.id = r.interaction_id
    join tz t on t.user_id = i.sender_id
    where r.user_id <> i.sender_id group by 1, 2, 3
    union all
    select s.author_id, s.circle_id, (sr.created_at at time zone t.tz)::date, count(*)
    from public.share_reactions sr join public.shares s on s.id = sr.share_id
    join tz t on t.user_id = s.author_id
    where sr.user_id <> s.author_id group by 1, 2, 3
  ),
  opens as (
    select m.user_id, m.circle_id, (e.at at time zone t.tz)::date as day, count(*) as n
    from public.app_events e
    join public.circle_members m on m.user_id = e.user_id
    join tz t on t.user_id = e.user_id
    where e.kind = 'app_open' group by 1, 2, 3
  ),
  s as (select user_id, circle_id, day, sum(n)::int as n from sent group by 1, 2, 3),
  r as (select user_id, circle_id, day, sum(n)::int as n from received group by 1, 2, 3),
  days as (
    select m.user_id, m.circle_id, d::date as day
    from mem m cross join generate_series(p_from, p_to, interval '1 day') d
    where d::date >= m.joined_day
  )
  insert into public.engagement_daily (user_id, circle_id, day, sent, received, opens)
  select d.user_id, d.circle_id, d.day, coalesce(s.n, 0), coalesce(r.n, 0), coalesce(o.n, 0)::int
  from days d
  left join s on s.user_id = d.user_id and s.circle_id = d.circle_id and s.day = d.day
  left join r on r.user_id = d.user_id and r.circle_id = d.circle_id and r.day = d.day
  left join opens o on o.user_id = d.user_id and o.circle_id = d.circle_id and o.day = d.day;

  get diagnostics v_rows = row_count;
  return v_rows;
end;
$$;
