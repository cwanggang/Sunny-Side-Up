-- Demo seed for design v0.4: coop description, gallery, events (upcoming with chat, one this week,
-- one past with an album), and profile facts/eggs for the cast (only if they haven't set their own).
-- The v0.3 reseed stays as is (renamed, private); this one runs it, then adds the v0.4 block.
alter function public.demo_reseed(text[]) rename to demo_reseed_v03;
alter function public.demo_reseed_v03(text[]) set schema private;
revoke all on function private.demo_reseed_v03(text[]) from public, anon, authenticated;

create function public.demo_reseed(
  p_emails text[] default array['ella7.ha@gmail.com', 'val311297@gmail.com',
                                'caden190wang@gmail.com', 'gamecoder04@gmail.com']
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  c        constant uuid := '00000000-0000-4000-9000-0000000000d0';
  v_base   jsonb;
  v_ids    uuid[];
  v_today  date := (now() at time zone 'America/New_York')::date;
  v_photos text[];
  v_e1     uuid;
  v_e2     uuid;
  v_e3     uuid;
  n        int;
  i        int;
  v_facts  jsonb[] := array[
    '[{"k":"favorite color","v":"lilac"},{"k":"spirit animal","v":"fox"},{"k":"comfort food","v":"her mom''s dumplings"}]',
    '[{"k":"favorite color","v":"purple"},{"k":"spirit animal","v":"otter"},{"k":"current go-to song","v":"anything by laufey"}]',
    '[{"k":"favorite color","v":"sky blue"},{"k":"spirit animal","v":"penguin"},{"k":"hidden talent","v":"a rubik''s cube in under a minute"}]',
    '[{"k":"favorite color","v":"forest green"},{"k":"spirit animal","v":"golden retriever"},{"k":"coffee order","v":"oat milk cortado"}]'
  ]::jsonb[];
  v_eggs   jsonb[] := array['{"swatch":"lilac","pattern":"dots"}', '{"swatch":"butter","pattern":"dots"}',
                            '{"swatch":"sky","pattern":"stripes"}', '{"swatch":"mint","pattern":"zigzag"}']::jsonb[];
begin
  v_base := private.demo_reseed_v03(p_emails);

  select array_agg(u.id order by array_position(p_emails, lower(u.email))) into v_ids
  from auth.users u where lower(u.email) = any (p_emails);

  perform set_config('app.skip_webhooks', 'on', true);

  update public.circles set description = 'four friends, one carton' where id = c and description is null;

  -- profile facts + eggs: only for people who haven't filled theirs in
  for i in 1 .. 4 loop
    update public.profiles set facts = v_facts[i], egg_style = v_eggs[i]
    where id = v_ids[i] and facts = '[]'::jsonb;
  end loop;

  delete from public.photos where circle_id = c;
  delete from public.events where circle_id = c; -- people, chat cascade

  select coalesce(array_agg(name order by name), '{}') into v_photos
  from storage.objects where bucket_id = 'media' and name like c::text || '/demo-photo-%';
  n := cardinality(v_photos);

  -- gallery: every demo photo, from the three active friends
  if n > 0 then
    insert into public.photos (circle_id, author_id, media_path, width, height, created_at)
    select c, v_ids[2 + ((k - 1) % 3)], v_photos[k], 1000, (array[1300, 800, 1000, 1250])[1 + (k - 1) % 4],
           now() - k * interval '2 days'
    from generate_series(1, n) k;
  end if;

  -- events
  insert into public.events (circle_id, title, starts_at, location, description, chat_days_after, created_by)
  values (c, 'dumpling night', ((v_today + 6) + time '19:00') at time zone 'America/New_York', 'caden''s place',
          'everyone brings one filling. johnathon is on dough duty.', 1, v_ids[3])
  returning id into v_e1;
  insert into public.events (circle_id, title, starts_at, location, description, chat_days_after, created_by)
  values (c, 'farmers market run', ((v_today + 2) + time '10:00') at time zone 'America/New_York', 'durham central park',
          'we need about forty lemons.', 0, v_ids[2])
  returning id into v_e2;
  insert into public.events (circle_id, title, starts_at, location, description, chat_days_after, created_by, created_at)
  values (c, 'movie marathon', ((v_today - 9) + time '20:00') at time zone 'America/New_York', 'our living room',
          'three movies, one couch.', 1, v_ids[4], now() - interval '14 days')
  returning id into v_e3;

  insert into public.event_people (event_id, user_id, role, is_lead) values
    (v_e1, v_ids[3], 'edit', true), (v_e1, v_ids[2], 'edit', false), (v_e1, v_ids[4], 'edit', false), (v_e1, v_ids[1], 'view', false),
    (v_e2, v_ids[2], 'edit', true), (v_e2, v_ids[4], 'view', false), (v_e2, v_ids[3], 'view', false),
    (v_e3, v_ids[4], 'edit', true), (v_e3, v_ids[1], 'view', false), (v_e3, v_ids[2], 'view', false), (v_e3, v_ids[3], 'view', false);

  insert into public.event_messages (event_id, sender_id, body, created_at) values
    (v_e1, v_ids[3], 'dumpling night is happening!!', now() - interval '2 days'),
    (v_e1, v_ids[4], 'i''ll bring flour and the good rolling pin', now() - interval '40 hours'),
    (v_e1, v_ids[2], 'can i bring the chili oil?', now() - interval '25 hours'),
    (v_e1, v_ids[3], 'yes please', now() - interval '24 hours'),
    (v_e2, v_ids[4], 'i can drive if someone buys me a coffee', now() - interval '5 hours'),
    (v_e3, v_ids[4], 'snacks are on me', now() - interval '10 days'),
    (v_e3, v_ids[2], 'i''m bringing the big blanket', now() - interval '10 days');

  -- past event album
  if n > 0 then
    insert into public.photos (circle_id, event_id, author_id, media_path, width, height, created_at)
    select c, v_e3, v_ids[1 + (k % 4)], v_photos[1 + (k - 1) % n], 1000, (array[800, 1250, 1000])[k],
           now() - interval '9 days' + k * interval '20 minutes'
    from generate_series(1, least(3, greatest(n, 1))) k;
  end if;

  return v_base || jsonb_build_object('events', 3, 'gallery_photos', n);
end;
$$;
revoke all on function public.demo_reseed(text[]) from public, anon, authenticated;
grant execute on function public.demo_reseed(text[]) to service_role;
