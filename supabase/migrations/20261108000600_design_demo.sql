-- Design v0.3 follow-ups (Developer B, no contract change):
--   1. demo_reseed also seeds the design: a week of daily photos (rotation), today's person, and
--      this week's Sunday pairs with tiles in different states.
--   2. analytics: daily-photo participation and Sunday egg exchange (de-identified, for Informer).

-- ---------- 1. demo seed ----------
-- The B4.8/B5.1 reseed stays as is (renamed, private); the public function runs it, then adds the
-- design block. Cast order: 1 quiet member (Ella), 2 nudge recipient (Val), 3 Caden, 4 Johnathon.
--   Daily photo: today is Val's day (not posted yet: post it live). The 6 days before have photos
--     from the others, except the quiet member skipped hers in the last 3 days (the real signal).
--   Sunday (latest Sunday's week): Val <-> Ella, Caden <-> Johnathon.
--     Val, Ella: uncracked. Caden: sent, "still frying". Johnathon: an egg is waiting; sending his
--     own opens it live (and tells Caden "tap to open it").
alter function public.demo_reseed(text[]) rename to demo_reseed_base;
alter function public.demo_reseed_base(text[]) set schema private;
revoke all on function private.demo_reseed_base(text[]) from public, anon, authenticated;

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

-- ---------- 2. analytics (Informer) ----------
-- Per circle per day: did that day's person post the daily photo?
create view analytics.daily_photo_participation as
select left(md5('sunny-circle:' || d.circle_id::text), 10) as circle_key,
       d.day,
       exists (
         select 1 from public.shares s
         where s.circle_id = d.circle_id and s.kind = 'spotlight' and s.period_key = to_char(d.day, 'YYYY-MM-DD')
       ) as posted
from public.spotlight_days d
where d.day <= current_date;

-- Per circle per Sunday: how many people were paired and how many sent their egg.
create view analytics.sunday_exchange as
select left(md5('sunny-circle:' || p.circle_id::text), 10) as circle_key,
       p.period_key                                         as week,
       count(*)::int                                        as people,
       count(s.id)::int                                     as eggs_sent,
       round(100.0 * count(s.id) / count(*), 1)             as sent_pct
from public.sunday_pairs p
left join public.shares s
  on s.circle_id = p.circle_id and s.period_key = p.period_key
 and s.author_id = p.giver_id and s.recipient_id is not null
group by p.circle_id, p.period_key;

grant select on analytics.daily_photo_participation, analytics.sunday_exchange to informer_ro;
