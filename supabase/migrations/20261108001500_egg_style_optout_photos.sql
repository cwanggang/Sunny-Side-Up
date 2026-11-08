-- 2026-11-08, after Developer A's v0.5 UI handoff:
--   1. interactions.egg_style: a friend's egg (directed egg / photo / voice memo from the decorate
--      screen) keeps its decoration, instead of showing the sender's profile egg. Same shape as
--      shares.egg_style ({ swatch, pattern }). Contract change.
--   2. set_event_opt_out: a coop member who isn't on the event yet is added (so "join" works and
--      "opt out" isn't a silent no-op). Anyone else gets an error instead of nothing happening.
--   3. Reset demo uses the team's real photos: storage files {demo}/daily-<n>.jpg, where n is the
--      daily_prompt() index (1 view, 6 hand, 7 corner, 8 sky, 9 mood). Each seeded daily photo whose
--      prompt has a real photo gets it (and a matching caption); the gallery shows the real photos;
--      the generated placeholders in feed posts and the event album are swapped for real ones.
--   4. notify_media_replaced respects app.skip_webhooks (like the delete trigger), so reseeding
--      never asks media-cleanup to delete the reusable demo files.

-- ---------- 1. interactions.egg_style ----------
alter table public.interactions
  add column egg_style jsonb,
  add constraint interactions_egg_style_object check (egg_style is null or jsonb_typeof(egg_style) = 'object');
grant insert (egg_style) on public.interactions to authenticated;

-- ---------- 2. opt out / join a coop event ----------
create or replace function public.set_event_opt_out(p_event_id uuid, p_out boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_circle uuid;
begin
  update public.event_people set opted_out = p_out where event_id = p_event_id and user_id = auth.uid();
  if found then
    return;
  end if;
  select circle_id into v_circle from public.events where id = p_event_id;
  if v_circle is null or not private.is_circle_member(v_circle) then
    raise exception 'you are not on this event' using errcode = '42501';
  end if;
  insert into public.event_people (event_id, user_id, role, opted_out)
  values (p_event_id, auth.uid(), 'view', p_out)
  on conflict (event_id, user_id) do update set opted_out = excluded.opted_out;
end;
$$;
revoke all on function public.set_event_opt_out(uuid, boolean) from public, anon;
grant execute on function public.set_event_opt_out(uuid, boolean) to authenticated;

-- ---------- 4. replaced-media cleanup skips seeding ----------
create or replace function private.notify_media_replaced()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- via jsonb: plpgsql can't reference old.avatar_path on a table without that column
  v_col text := case when tg_table_name = 'profiles' then 'avatar_path' else 'media_path' end;
  v_old text := to_jsonb(old) ->> v_col;
  v_new text := to_jsonb(new) ->> v_col;
begin
  if coalesce(current_setting('app.skip_webhooks', true), '') = 'on' then
    return null;
  end if;
  if v_old is not null and v_old is distinct from v_new then
    perform private.post_webhook('media-cleanup', jsonb_build_object(
      'type', 'UPDATE', 'table', tg_table_name, 'schema', 'public',
      'record', null, 'old_record', jsonb_build_object('media_path', v_old)
    ));
  end if;
  return null;
end;
$$;

-- ---------- 3. Reset demo with real photos ----------
create or replace function public.demo_reseed(
  p_emails text[] default array['ella7.ha@gmail.com', 'river.jossy7@gmail.com', 'caden190wang@gmail.com']
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  c        constant uuid := '00000000-0000-4000-9000-0000000000d0';
  v_res    jsonb;
  v_ids    uuid[];
  v_war    uuid;
  v_real   text[];
  v_nr     int;
  v_today  date := (now() at time zone 'America/New_York')::date;
  -- captions for the real photos, by daily_prompt() index
  v_caps   text[] := array['the view: one very big, very off tv', null, null, null, null,
                           'my tiny macro pad 🐼', 'the comfiest chair on campus. don''t tell anyone',
                           'sky check: that red tree though 🍁', '100 grand. feeling rich today', null];
  v_daily  int := 0;
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

  -- real photos (scripts/DEMO.md "demo photos"): daily photos by prompt, gallery, feed, album
  select coalesce(array_agg(name order by name), '{}') into v_real
  from storage.objects where bucket_id = 'media' and name ~ ('^' || c::text || '/daily-[0-9]+\.jpg$');
  v_nr := cardinality(v_real);
  if v_nr > 0 then
    update public.shares s
       set media_path = c::text || '/daily-' || x.idx || '.jpg',
           body = coalesce(v_caps[x.idx], s.body)
      from (select s2.id, 1 + (((to_date(s2.period_key, 'YYYY-MM-DD') - date '2026-01-01') % 10 + 10) % 10) as idx
            from public.shares s2 where s2.circle_id = c and s2.kind = 'spotlight') x
     where s.id = x.id
       and (c::text || '/daily-' || x.idx || '.jpg') = any (v_real);
    get diagnostics v_daily = row_count;

    -- gallery (coop photos, not event albums): the real photos, a couple of days apart
    delete from public.photos where circle_id = c and event_id is null;
    insert into public.photos (circle_id, author_id, media_path, width, height, created_at)
    select c, v_ids_author, v_real[k], 1200, 1600, now() - k * interval '1 day' - interval '3 hours'
    from generate_series(1, v_nr) k,
         lateral (select s.author_id as v_ids_author from public.shares s
                  where s.circle_id = c and s.media_path = v_real[k] limit 1) a;
    -- real photos nobody posted as a daily photo still go in the gallery, from the coop's creator
    insert into public.photos (circle_id, author_id, media_path, width, height, created_at)
    select c, ci.created_by, r.name, 1200, 1600, now() - interval '5 days'
    from unnest(v_real) r(name) cross join public.circles ci
    where ci.id = c and not exists (select 1 from public.photos p where p.circle_id = c and p.media_path = r.name);

    -- feed photos and the event album: real photos instead of the generated placeholders
    update public.interactions i
       set media_path = v_real[1 + ((x.rn - 1) % v_nr)]
      from (select id, row_number() over (order by created_at) as rn from public.interactions
            where circle_id = c and media_path like c::text || '/demo-photo-%') x
     where i.id = x.id;
    update public.photos p
       set media_path = v_real[1 + ((x.rn + 1) % v_nr)]
      from (select id, row_number() over (order by created_at) as rn from public.photos
            where circle_id = c and event_id is not null and media_path like c::text || '/demo-photo-%') x
     where p.id = x.id;
  end if;

  -- the last cast member (Caden) has started an egg war; the vote has ~20 h left
  select array_agg(u.id order by array_position(array(select lower(trim(e)) from unnest(p_emails) e), lower(u.email)))
    into v_ids from auth.users u where lower(u.email) = any (array(select lower(trim(e)) from unnest(p_emails) e));
  if cardinality(v_ids) >= 3 then
    insert into public.egg_wars (circle_id, started_by, vote_ends_at, members, created_at)
    values (c, v_ids[cardinality(v_ids)], now() + interval '20 hours', cardinality(v_ids), now() - interval '4 hours')
    returning id into v_war;
    insert into public.egg_war_people (war_id, user_id, choice) values (v_war, v_ids[cardinality(v_ids)], 'in');
  end if;
  -- engagement history for Informer right away (counts only; drift + nudges still wait for the
  -- demo's "Run drift + nudge" step)
  perform private.build_engagement(v_today - 18, v_today - 1);
  return v_res || jsonb_build_object('egg_war', v_war, 'real_photos', v_nr, 'daily_with_real_photo', v_daily);
end;
$$;
revoke all on function public.demo_reseed(text[]) from public, anon, authenticated;
grant execute on function public.demo_reseed(text[]) to service_role;
