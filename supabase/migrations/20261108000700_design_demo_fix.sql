-- Fix for 20261108000600: generate_series alias `d` clashed with the loop variable `d`.
create or replace function public.demo_reseed(
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
  v_sunday date;
  v_week   text;
  v_photos text[];
  v_daily  integer;
  -- who had the daily photo d days ago (d = 0 is today): Val today, then a rotation
  v_rot    int[] := array[2, 3, 4, 1, 2, 3, 1];
  v_texts  text[] := array['my shoes, right now 👟', 'sky check ☁️', 'desk chaos', 'lunch!!',
                           'the best color I saw today', 'the view from here'];
  v_styles jsonb[] := array['{"swatch":"blush","pattern":"dots"}', '{"swatch":"mint","pattern":"zigzag"}',
                            '{"swatch":"butter","pattern":"stripes"}', '{"swatch":"sky","pattern":"dots"}',
                            '{"swatch":"shell","pattern":"none"}', '{"swatch":"lilac","pattern":"zigzag"}']::jsonb[];
  d        int;
begin
  v_base := private.demo_reseed_base(p_emails);

  select array_agg(u.id order by array_position(p_emails, lower(u.email)))
    into v_ids
  from auth.users u
  where lower(u.email) = any (p_emails);

  perform set_config('app.skip_webhooks', 'on', true);

  v_sunday := v_today - extract(dow from v_today)::int; -- today if Sunday, else last Sunday
  v_week := to_char(v_sunday, 'IYYY-"W"IW');

  delete from public.sunday_pairs where circle_id = c;

  select coalesce(array_agg(name order by name), '{}') into v_photos
  from storage.objects
  where bucket_id = 'media' and name like c::text || '/demo-photo-%';

  -- daily photos: spotlight days for the last 6 days + today (scheduler fills ahead)
  insert into public.spotlight_days (circle_id, day, user_id)
  select c, v_today - g, v_ids[v_rot[g + 1]]
  from generate_series(0, 6) g
  on conflict (circle_id, day) do update set user_id = excluded.user_id;

  v_daily := 0;
  for d in 1 .. 6 loop
    continue when v_rot[d + 1] = 1 and d <= 3; -- the quiet member skipped her day
    insert into public.shares (circle_id, author_id, kind, period_key, body, egg_style, media_path, created_at)
    values (c, v_ids[v_rot[d + 1]], 'spotlight', to_char(v_today - d, 'YYYY-MM-DD'), v_texts[d], v_styles[d],
            case when cardinality(v_photos) > 0 then v_photos[1 + (d - 1) % cardinality(v_photos)] end,
            ((v_today - d) + time '09:30' + (d * interval '17 minutes')) at time zone 'America/New_York');
    v_daily := v_daily + 1;
  end loop;

  -- Sunday pairs + one egg in flight
  insert into public.sunday_pairs (circle_id, period_key, giver_id, receiver_id, created_at)
  values (c, v_week, v_ids[2], v_ids[1], now() - interval '2 hours'),
         (c, v_week, v_ids[1], v_ids[2], now() - interval '2 hours'),
         (c, v_week, v_ids[3], v_ids[4], now() - interval '2 hours'),
         (c, v_week, v_ids[4], v_ids[3], now() - interval '2 hours');
  insert into public.shares (circle_id, author_id, recipient_id, kind, period_key, body, egg_style, created_at)
  values (c, v_ids[3], v_ids[4], 'sunday', v_week, 'miss ur terrible puns',
          '{"swatch":"mint","pattern":"zigzag"}', now() - interval '1 hour');

  return v_base || jsonb_build_object('daily_photos', v_daily, 'today_photo_by', 'cast #2',
                                      'sunday_pairs_week', v_week);
end;
$$;
revoke all on function public.demo_reseed(text[]) from public, anon, authenticated;
grant execute on function public.demo_reseed(text[]) to service_role;
