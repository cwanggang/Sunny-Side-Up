-- Demo readiness (read-only):  cd scripts && npm run demo-status
-- One row per demo cast member (plan P0.14). `next_step` says what's missing; 'ready' when nothing is.
-- Circle-level facts (posts, photos, drift, today's daily photo, other sign-ups) repeat on every row.
with cast_list(n, email, demo_role) as (
  values (1, 'ella7.ha@gmail.com', 'quiet member'),
         (2, 'river.jossy7@gmail.com', 'nudge recipient'),
         (3, 'caden190wang@gmail.com', 'member')
),
c as (select '00000000-0000-4000-9000-0000000000d0'::uuid as id),
today as (select (now() at time zone 'America/New_York')::date as d),
week as (
  select p.period_key from public.sunday_pairs p, c
  where p.circle_id = c.id order by p.created_at desc limit 1
),
circle_facts as (
  select (select count(*) from public.interactions i, c where i.circle_id = c.id)                  as circle_posts,
         (select count(*) from storage.objects o, c
           where o.bucket_id = 'media' and o.name like c.id::text || '/demo-photo-%')                as demo_photo_files,
         (select max(day) from public.drift_scores d, c where d.circle_id = c.id)                  as last_drift_day,
         (select pr.display_name from public.spotlight_days s join public.profiles pr on pr.id = s.user_id, c, today t
           where s.circle_id = c.id and s.day = t.d)                                                 as todays_photo_person,
         (select count(*) > 0 from public.shares s, c, today t
           where s.circle_id = c.id and s.kind = 'spotlight' and s.period_key = to_char(t.d, 'YYYY-MM-DD')) as todays_photo_posted,
         (select period_key from week)                                                             as sunday_week,
         (select string_agg(u.email, ', ' order by u.created_at) from auth.users u
           where u.email not like '%@sunnyside.test'
             and lower(u.email) not in (select email from cast_list))                              as other_signups
),
rows_ as (
  select cl.n, cl.email, cl.demo_role,
         u.id is not null as signed_up,
         p.display_name,
         p.timezone,
         exists (select 1 from public.circle_members m, c where m.circle_id = c.id and m.user_id = u.id) as in_demo_circle,
         coalesce(co.paused_until > now(), false) as paused,
         concat_ws(', ',
           case when co.notify_daily_photo  = false then 'daily photo' end,
           case when co.notify_sunday       = false then 'sunday' end,
           case when co.notify_friend_posts = false then 'friend posts' end) as notifications_off,
         (select pr.display_name from public.sunday_pairs sp join public.profiles pr on pr.id = sp.receiver_id, c
           where sp.circle_id = c.id and sp.period_key = (select period_key from week) and sp.giver_id = u.id) as sunday_person,
         exists (select 1 from public.shares s, c
           where s.circle_id = c.id and s.period_key = (select period_key from week)
             and s.author_id = u.id and s.recipient_id is not null) as egg_sent,
         exists (select 1 from public.shares s, c
           where s.circle_id = c.id and s.period_key = (select period_key from week)
             and s.recipient_id = u.id) as egg_waiting,
         (select count(*) from public.notifications x, c
           where x.user_id = u.id and x.circle_id = c.id and x.read_at is null) as unread_notifications
  from cast_list cl
  left join auth.users u on lower(u.email) = cl.email
  left join public.profiles p on p.id = u.id
  left join public.consents co on co.user_id = u.id
)
select r.n, r.email, r.demo_role, r.display_name,
       case
         when not r.signed_up then 'sign up in the app with this email'
         when not r.in_demo_circle or f.circle_posts = 0 then 'run Reset demo (or scripts/seed-demo.sql) once everyone has signed up'
         when r.paused then 'turn off pause in Settings'
         when r.sunday_person is null then 'run Reset demo again (no Sunday pairs)'
         when f.last_drift_day is null then 'tap "Run drift + nudge" on the demo screen (or it runs nightly)'
         when r.notifications_off <> '' then 'turn notifications back on: ' || r.notifications_off
         else 'ready'
       end as next_step,
       r.signed_up, r.in_demo_circle, r.paused, r.timezone, r.notifications_off,
       r.sunday_person, r.egg_sent, r.egg_waiting, r.unread_notifications,
       f.todays_photo_person, f.todays_photo_posted, f.sunday_week,
       f.circle_posts, f.demo_photo_files, f.last_drift_day, f.other_signups
from rows_ r cross join circle_facts f
order by r.n;
