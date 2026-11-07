-- Free-Apple-ID pivot (plan §3.0, contract change 2026-11-07):
-- no remote push. The server inserts `notifications` rows; the app listens to its own rows over
-- Realtime and shows them as local notifications.
--   B1.3  notify helper (private.create_notifications + public wrapper for Edge Functions)
--         + private.send_test_notification(email) for the scripts/ test command
--   B2.1  interactions trigger now inserts notifications directly (no webhook / Edge Function)
--   B2.2  copy per kind; paused users get none
--   removes profiles.expo_push_token and register_push_token

-- ---------- table ----------
create type public.notification_type as enum
  ('interaction', 'nudge', 'share_open', 'spotlight', 'birthday', 'moment');

create table public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade, -- who sees it
  type       public.notification_type not null,
  circle_id  uuid not null references public.circles (id) on delete cascade,
  target_id  text,          -- interaction id, nudge id, user id, ISO week, ... (routing only)
  title      text not null,
  body       text not null,
  created_at timestamptz not null default now(),
  read_at    timestamptz
);
create index notifications_user_created_idx on public.notifications (user_id, created_at desc);
create index notifications_user_unread_idx on public.notifications (user_id, created_at desc) where read_at is null;

-- Self only: read own rows, and mark them read. Inserts come only from the server.
alter table public.notifications enable row level security;
revoke all on public.notifications from anon, authenticated;
grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;
create policy notifications_select_own on public.notifications
  for select to authenticated using (user_id = (select auth.uid()));
create policy notifications_update_own on public.notifications
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

alter publication supabase_realtime add table public.notifications;

-- ---------- the one helper every notification goes through ----------
-- p_rows: jsonb array of { user_id, type, circle_id, target_id?, title, body }.
-- Skips users whose consents.paused_until is in the future (plan §4.2 / §9.6) and unknown users.
create function private.create_notifications(p_rows jsonb, p_respect_pause boolean default true)
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
    ));
  get diagnostics v_rows = row_count;
  return v_rows;
end;
$$;
revoke all on function private.create_notifications(jsonb, boolean) from public, anon, authenticated;

-- For Edge Functions (service role only): supabase.rpc('create_notifications', { p_rows }).
create function public.create_notifications(p_rows jsonb)
returns integer
language sql
security definer
set search_path = ''
as $$
  select private.create_notifications(p_rows, true);
$$;
revoke all on function public.create_notifications(jsonb) from public, anon, authenticated;
grant execute on function public.create_notifications(jsonb) to service_role;

-- B1.3 test command (scripts/notify-test.mjs): one notification for that account, in their
-- first circle. Ignores pause so it always shows. Run as postgres only (supabase db query).
create function private.send_test_notification(p_email text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid    uuid;
  v_circle uuid;
  v_id     uuid;
begin
  select id into v_uid from auth.users where lower(email) = lower(trim(p_email));
  if v_uid is null then
    raise exception 'No account with email %', p_email using errcode = 'P0002';
  end if;
  select circle_id into v_circle from public.circle_members where user_id = v_uid order by joined_at limit 1;
  if v_circle is null then
    raise exception '% is not in a circle yet (notifications belong to a circle)', p_email using errcode = 'P0002';
  end if;
  insert into public.notifications (user_id, type, circle_id, target_id, title, body)
  values (v_uid, 'interaction', v_circle, null, 'Sunny Side Up',
          'Test notification ☀️ If you can see this, notifications work!')
  returning id into v_id;
  return v_id;
end;
$$;
revoke all on function private.send_test_notification(text) from public, anon, authenticated;

-- ---------- B2.1 / B2.2: interactions -> notifications (pure SQL trigger) ----------
drop trigger interactions_push_webhook on public.interactions;
drop function private.notify_on_interaction();

create function private.notify_on_interaction()
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
  -- seeds and backdated history never notify (see 20261107000600_seed_safety.sql)
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
           'target_id', new.id::text, 'title', coalesce(v_circle, 'Sunny Side Up'), 'body', v_body)), '[]'::jsonb)
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

create trigger interactions_notify
  after insert on public.interactions
  for each row execute function private.notify_on_interaction();

-- ---------- remove remote push ----------
drop function public.register_push_token(text);
alter table public.profiles drop column expo_push_token;
