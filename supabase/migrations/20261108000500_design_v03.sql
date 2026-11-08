-- Design v0.3 backend (docs/proposals/design-v0.3-backend.md), agreed 2026-11-07.
--   * Daily photo: today's spotlight person posts one `spotlight` share per circle per day,
--     decorated as an egg (egg_style + body). Others are told when it's up.
--   * Sunny Sunday: secret pairs (sunday_pairs). Each person sends one egg (video or voice) to
--     their person, and can open the egg sent to them only after sending their own.
--   * Notification settings: daily photo reminder, sunday reminder, when friends post.
--   * Prompts: daily_prompt(day), sunday_prompt(week, name), the same for everyone.
--   * media bucket accepts video.

-- ---------- media bucket: video ----------
update storage.buckets
set file_size_limit = 52428800, -- 50 MB
    allowed_mime_types = array[
      'image/jpeg', 'image/png', 'image/heic', 'image/webp',
      'audio/m4a', 'audio/mp4', 'audio/x-m4a', 'audio/aac',
      'video/mp4', 'video/quicktime'
    ]
where id = 'media';

-- ---------- notification settings ----------
alter table public.consents
  add column notify_daily_photo  boolean not null default true,
  add column notify_sunday       boolean not null default true,
  add column notify_friend_posts boolean not null default true;

-- create_notifications: rows may carry "pref" ('daily_photo' | 'sunday' | 'friend_posts');
-- users who turned that setting off are skipped. Rows without "pref" always go out (pause still applies).
create or replace function private.create_notifications(p_rows jsonb, p_respect_pause boolean default true)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rows integer;
begin
  insert into public.notifications (user_id, type, circle_id, target_id, title, body)
  select (r ->> 'user_id')::uuid,
         (r ->> 'type')::public.notification_type,
         (r ->> 'circle_id')::uuid,
         r ->> 'target_id',
         r ->> 'title',
         r ->> 'body'
  from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) r
  where exists (select 1 from public.profiles p where p.id = (r ->> 'user_id')::uuid)
    and not (p_respect_pause and exists (
      select 1 from public.consents c
      where c.user_id = (r ->> 'user_id')::uuid and c.paused_until > now()
    ))
    and not exists (
      select 1 from public.consents c
      where c.user_id = (r ->> 'user_id')::uuid
        and case r ->> 'pref'
              when 'daily_photo'  then not c.notify_daily_photo
              when 'sunday'       then not c.notify_sunday
              when 'friend_posts' then not c.notify_friend_posts
              else false
            end
    );
  get diagnostics v_rows = row_count;
  return v_rows;
end;
$$;
revoke all on function private.create_notifications(jsonb, boolean) from public, anon, authenticated;

-- Whole-circle interactions count as "friends posting"; directed ones (to me) always notify.
create or replace function private.notify_on_interaction()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_directed boolean := new.recipient_id is not null;
  v_who      text;
  v_circle   text;
  v_text     text := trim(coalesce(new.body, ''));
  v_body     text;
  v_rows     jsonb;
begin
  if coalesce(current_setting('app.skip_webhooks', true), '') = 'on'
     or new.created_at < now() - interval '10 minutes' then
    return null;
  end if;

  select coalesce(nullif(trim(display_name), ''), 'Someone') into v_who
  from public.profiles where id = new.sender_id;
  v_who := coalesce(v_who, 'Someone');
  select name into v_circle from public.circles where id = new.circle_id;

  v_body := case new.kind
    when 'egg'   then v_who || case when v_directed then ' sent you an egg 🥚' else ' sent everyone an egg 🥚' end
    when 'photo' then v_who || case when v_directed then ' sent you a photo 📷' else ' shared a photo 📷' end
    when 'voice' then v_who || case when v_directed then ' sent you a voice memo 🎙️' else ' shared a voice memo 🎙️' end
    else case when v_text = '' then v_who || ' sent you a message'
              when length(v_text) > 140 then v_who || ': ' || left(v_text, 139) || '…'
              else v_who || ': ' || v_text end
  end;

  select coalesce(jsonb_agg(jsonb_build_object(
           'user_id', x.uid, 'type', 'interaction', 'circle_id', new.circle_id,
           'target_id', new.id::text, 'title', coalesce(v_circle, 'Sunny Side Up'), 'body', v_body,
           'pref', case when v_directed then null else 'friend_posts' end)), '[]'::jsonb)
    into v_rows
  from (
    select new.recipient_id as uid where v_directed and new.recipient_id <> new.sender_id
    union all
    select m.user_id from public.circle_members m
    where not v_directed and m.circle_id = new.circle_id and m.user_id <> new.sender_id
  ) x;

  perform private.create_notifications(v_rows, true);
  return null;
end;
$$;

-- ---------- prompts ----------
create function public.daily_prompt(p_day date default current_date)
returns text
language sql
immutable
set search_path = ''
as $$
  select (array[
    'the view from where you are right now',
    'the last thing you ate, no judgment',
    'something that made you smile today',
    'your shoes, right now',
    'the best color you have seen today',
    'what''s in your hand?',
    'a corner of your room nobody''s seen',
    'sky check! point it up',
    'your mood today, as an object',
    'show us what''s on your desk right now'
  ])[1 + ((p_day - date '2026-01-01') % 10 + 10) % 10];
$$;

-- p_week: ISO week 'YYYY-Www'. p_name: the first name of the person you're sending to.
create function public.sunday_prompt(p_week text, p_name text)
returns text
language sql
immutable
set search_path = ''
as $$
  select replace((array[
    'tell {n} about a moment this week you wish they were there for',
    'what''s something you''ve been meaning to tell {n}?',
    'give {n} a tiny tour of where you are right now',
    'what made you think of {n} this week?'
  ])[1 + (coalesce(nullif(regexp_replace(p_week, '\D', '', 'g'), ''), '0')::bigint % 4)::int],
  '{n}', coalesce(nullif(trim(p_name), ''), 'your person'));
$$;
grant execute on function public.daily_prompt(date), public.sunday_prompt(text, text) to authenticated, service_role;

-- ---------- sunday_pairs ----------
-- One row per giver: giver sends one egg to receiver this week. Even groups are mutual pairs;
-- an odd group has one 3-person ring (A->B->C->A), so everyone sends one and gets one.
create table public.sunday_pairs (
  circle_id   uuid not null references public.circles (id) on delete cascade,
  period_key  text not null, -- ISO week, e.g. '2026-W45'
  giver_id    uuid not null references public.profiles (id) on delete cascade,
  receiver_id uuid not null references public.profiles (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (circle_id, period_key, giver_id),
  check (giver_id <> receiver_id)
);
create index sunday_pairs_receiver_idx on public.sunday_pairs (circle_id, period_key, receiver_id);

alter table public.sunday_pairs enable row level security;
revoke all on public.sunday_pairs from anon, authenticated;
grant select on public.sunday_pairs to authenticated;
create policy sunday_pairs_select_own on public.sunday_pairs
  for select to authenticated
  using ((select auth.uid()) in (giver_id, receiver_id) and private.is_circle_member(circle_id));

-- Makes this week's pairs for one circle (service role / scheduler). Keeps existing pairs unless
-- membership changed and nobody has sent an egg yet. Quiet members (server-side drift) are paired
-- with active friends first; nothing in the row says so. Returns the number of pairs rows.
create function private.ensure_sunday_pairs(p_circle_id uuid, p_period_key text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_members uuid[];
  v_existing uuid[];
  v_quiet uuid[];
  v_active uuid[];
  v_order uuid[] := '{}';
  v_n int;
  v_pairs_end int;
  i int;
begin
  select coalesce(array_agg(m.user_id order by m.user_id), '{}') into v_members
  from public.circle_members m
  left join public.consents c on c.user_id = m.user_id
  where m.circle_id = p_circle_id and (c.paused_until is null or c.paused_until <= now());

  select coalesce(array_agg(p.giver_id order by p.giver_id), '{}') into v_existing
  from public.sunday_pairs p where p.circle_id = p_circle_id and p.period_key = p_period_key;

  if cardinality(v_existing) > 0 then
    if v_existing = v_members or exists (
      select 1 from public.shares s
      where s.circle_id = p_circle_id and s.period_key = p_period_key
        and s.kind = 'sunday' and s.recipient_id is not null
    ) then
      return cardinality(v_existing);
    end if;
    delete from public.sunday_pairs where circle_id = p_circle_id and period_key = p_period_key;
  end if;

  v_n := cardinality(v_members);
  if v_n < 2 then
    return 0;
  end if;

  -- shuffled quiet and active members, interleaved (quiet, active, quiet, active, ..., rest)
  select coalesce(array_agg(u order by random()), '{}') into v_quiet
  from unnest(v_members) u
  where exists (
    select 1 from public.drift_scores d
    where d.user_id = u and d.circle_id = p_circle_id and d.is_quiet and d.day >= current_date - 3
  );
  select coalesce(array_agg(u order by random()), '{}') into v_active
  from unnest(v_members) u where not (u = any (v_quiet));

  for i in 1 .. greatest(cardinality(v_quiet), cardinality(v_active)) loop
    if i <= cardinality(v_quiet) then v_order := v_order || v_quiet[i]; end if;
    if i <= cardinality(v_active) then v_order := v_order || v_active[i]; end if;
  end loop;

  -- pairs (1,2), (3,4), ...; an odd tail of 3 becomes a ring
  v_pairs_end := case when v_n % 2 = 1 then v_n - 3 else v_n end;
  i := 1;
  while i < v_pairs_end loop
    insert into public.sunday_pairs (circle_id, period_key, giver_id, receiver_id)
    values (p_circle_id, p_period_key, v_order[i], v_order[i + 1]),
           (p_circle_id, p_period_key, v_order[i + 1], v_order[i]);
    i := i + 2;
  end loop;
  if v_n % 2 = 1 then
    insert into public.sunday_pairs (circle_id, period_key, giver_id, receiver_id)
    values (p_circle_id, p_period_key, v_order[v_n - 2], v_order[v_n - 1]),
           (p_circle_id, p_period_key, v_order[v_n - 1], v_order[v_n]),
           (p_circle_id, p_period_key, v_order[v_n], v_order[v_n - 2]);
  end if;
  return v_n;
end;
$$;
revoke all on function private.ensure_sunday_pairs(uuid, text) from public, anon, authenticated;

-- For the scheduler (service role only): supabase.rpc('ensure_sunday_pairs', {...}).
create function public.ensure_sunday_pairs(p_circle_id uuid, p_period_key text)
returns integer
language sql
security definer
set search_path = ''
as $$
  select private.ensure_sunday_pairs(p_circle_id, p_period_key);
$$;
revoke all on function public.ensure_sunday_pairs(uuid, text) from public, anon, authenticated;
grant execute on function public.ensure_sunday_pairs(uuid, text) to service_role;

-- ---------- shares: Sunday eggs + decoration ----------
alter table public.shares
  add column recipient_id uuid references public.profiles (id) on delete cascade,
  add column egg_style    jsonb,
  add constraint shares_recipient_only_sunday check (recipient_id is null or kind = 'sunday'),
  add constraint shares_egg_style_object check (egg_style is null or jsonb_typeof(egg_style) = 'object');

-- one daily photo per circle per day; one Sunday egg per person per circle per week
create unique index shares_one_daily_photo on public.shares (circle_id, period_key) where kind = 'spotlight';
create unique index shares_one_sunday_egg on public.shares (circle_id, period_key, author_id) where recipient_id is not null;

grant insert (recipient_id, egg_style) on public.shares to authenticated;
grant update (egg_style) on public.shares to authenticated;

-- Have I sent my Sunday egg in this circle this week?
create function private.has_sent_sunday_egg(p_circle_id uuid, p_period_key text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.shares s
    where s.circle_id = p_circle_id and s.period_key = p_period_key and s.kind = 'sunday'
      and s.recipient_id is not null and s.author_id = auth.uid()
  );
$$;

-- Row visibility for shares (also used for media): whole-circle shares -> members;
-- Sunday eggs -> the author, and the recipient once they've sent their own.
create function private.can_see_share(p_share_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.shares s
    where s.id = p_share_id
      and private.is_circle_member(s.circle_id)
      and (s.recipient_id is null
           or s.author_id = auth.uid()
           or (s.recipient_id = auth.uid() and private.has_sent_sunday_egg(s.circle_id, s.period_key)))
  );
$$;

-- Daily photo: only today's spotlight person (yesterday..tomorrow, for time zones).
create function private.is_my_spotlight_day(p_circle_id uuid, p_period_key text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_day date;
begin
  if p_period_key !~ '^\d{4}-\d{2}-\d{2}$' then
    return false;
  end if;
  v_day := p_period_key::date;
  return v_day between current_date - 1 and current_date + 1
    and exists (
      select 1 from public.spotlight_days d
      where d.circle_id = p_circle_id and d.day = v_day and d.user_id = auth.uid()
    );
exception when others then
  return false;
end;
$$;

-- Sunday egg: recipient must be my person for that week.
create function private.is_my_sunday_receiver(p_circle_id uuid, p_period_key text, p_recipient uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.sunday_pairs p
    where p.circle_id = p_circle_id and p.period_key = p_period_key
      and p.giver_id = auth.uid() and p.receiver_id = p_recipient
  );
$$;

grant execute on function private.has_sent_sunday_egg(uuid, text), private.can_see_share(uuid),
  private.is_my_spotlight_day(uuid, text), private.is_my_sunday_receiver(uuid, text, uuid)
  to authenticated;

drop policy shares_select_member on public.shares;
create policy shares_select_visible on public.shares
  for select to authenticated using (
    private.is_circle_member(circle_id)
    and (recipient_id is null
         or author_id = (select auth.uid())
         or (recipient_id = (select auth.uid()) and private.has_sent_sunday_egg(circle_id, period_key)))
  );

drop policy shares_insert_author on public.shares;
create policy shares_insert_author on public.shares
  for insert to authenticated with check (
    author_id = (select auth.uid())
    and private.is_circle_member(circle_id)
    and (media_path is null or (media_path like circle_id::text || '/%' and private.owns_media(media_path)))
    and (kind <> 'spotlight' or private.is_my_spotlight_day(circle_id, period_key))
    and (recipient_id is null or private.is_my_sunday_receiver(circle_id, period_key, recipient_id))
  );

-- media follows the share row's visibility
create or replace function private.can_read_media(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
      select 1 from public.interactions i
      where i.media_path = p_name and private.can_see_interaction(i.id)
    )
    or exists (
      select 1 from public.shares s
      where s.media_path = p_name and private.can_see_share(s.id)
    );
$$;

-- ---------- what the app needs for a Sunday tile, in one call ----------
-- Latest week I'm paired in for this circle (or p_period_key). they_sent says an egg is waiting
-- (the design shows a gift); their_share_id is only returned once I've sent mine.
create function public.sunday_status(p_circle_id uuid, p_period_key text default null)
returns table (
  period_key     text,
  send_to        uuid,
  from_id        uuid,
  i_sent         boolean,
  they_sent      boolean,
  my_share_id    uuid,
  their_share_id uuid,
  prompt         text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_uid uuid := auth.uid();
  v_week text;
begin
  if v_uid is null or not private.is_circle_member(p_circle_id) then
    return;
  end if;
  select p.period_key into v_week
  from public.sunday_pairs p
  where p.circle_id = p_circle_id and p.giver_id = v_uid
    and (p_period_key is null or p.period_key = p_period_key)
  order by p.created_at desc limit 1;
  if v_week is null then
    return;
  end if;

  return query
  with mine as (
    select p.receiver_id from public.sunday_pairs p
    where p.circle_id = p_circle_id and p.period_key = v_week and p.giver_id = v_uid
  ),
  sender as (
    select p.giver_id from public.sunday_pairs p
    where p.circle_id = p_circle_id and p.period_key = v_week and p.receiver_id = v_uid
    limit 1
  ),
  my_egg as (
    select s.id from public.shares s
    where s.circle_id = p_circle_id and s.period_key = v_week and s.author_id = v_uid and s.recipient_id is not null
  ),
  their_egg as (
    select s.id from public.shares s
    where s.circle_id = p_circle_id and s.period_key = v_week and s.recipient_id = v_uid
    limit 1
  )
  select v_week,
         (select receiver_id from mine),
         (select giver_id from sender),
         exists (select 1 from my_egg),
         exists (select 1 from their_egg),
         (select id from my_egg),
         case when exists (select 1 from my_egg) then (select id from their_egg) end,
         public.sunday_prompt(v_week, (
           select split_part(trim(pr.display_name), ' ', 1) from public.profiles pr
           where pr.id = (select receiver_id from mine)));
end;
$$;
revoke all on function public.sunday_status(uuid, text) from public, anon;
grant execute on function public.sunday_status(uuid, text) to authenticated;

-- ---------- shares -> notifications ----------
create function private.notify_on_share()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_who    text;
  v_circle text;
  v_rows   jsonb;
begin
  if coalesce(current_setting('app.skip_webhooks', true), '') = 'on'
     or new.created_at < now() - interval '10 minutes' then
    return null;
  end if;

  select coalesce(nullif(split_part(trim(display_name), ' ', 1), ''), 'someone') into v_who
  from public.profiles where id = new.author_id;
  v_who := coalesce(v_who, 'someone');
  select name into v_circle from public.circles where id = new.circle_id;

  if new.kind = 'spotlight' then
    -- today's photo is up -> everyone else in the circle
    select coalesce(jsonb_agg(jsonb_build_object(
             'user_id', m.user_id, 'type', 'spotlight', 'circle_id', new.circle_id,
             'target_id', new.author_id::text, 'title', coalesce(v_circle, 'Sunny Side Up'),
             'body', v_who || '''s photo is up 📷', 'pref', 'friend_posts')), '[]'::jsonb)
      into v_rows
    from public.circle_members m
    where m.circle_id = new.circle_id and m.user_id <> new.author_id;
  elsif new.recipient_id is not null then
    -- Sunday egg -> its recipient
    v_rows := jsonb_build_array(jsonb_build_object(
      'user_id', new.recipient_id, 'type', 'share_open', 'circle_id', new.circle_id,
      'target_id', new.period_key, 'title', coalesce(v_circle, 'Sunny Side Up'),
      'body', v_who || ' sent you an egg 🥚 ' ||
              case when exists (
                select 1 from public.shares s
                where s.circle_id = new.circle_id and s.period_key = new.period_key
                  and s.author_id = new.recipient_id and s.recipient_id is not null
              ) then 'tap to open it' else 'send yours to open it' end));
  else
    return null;
  end if;

  perform private.create_notifications(v_rows, true);
  return null;
end;
$$;

create trigger shares_notify
  after insert on public.shares
  for each row execute function private.notify_on_share();
