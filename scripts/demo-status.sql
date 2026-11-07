-- Demo readiness (read-only):  cd scripts && npm run demo-status
-- One row per demo cast member (plan P0.14), plus demo-circle totals on every row.
with cast_list(n, email, demo_role) as (
  values (1, 'ella7.ha@gmail.com', 'quiet member'),
         (2, 'val311297@gmail.com', 'nudge recipient'),
         (3, 'caden190wang@gmail.com', 'member'),
         (4, 'gamecoder04@gmail.com', 'member')
),
c as (select '00000000-0000-4000-9000-0000000000d0'::uuid as id)
select cl.n,
       cl.email,
       cl.demo_role,
       u.id is not null                                   as signed_up,
       p.display_name,
       exists (select 1 from public.circle_members m, c
               where m.circle_id = c.id and m.user_id = u.id) as in_demo_circle,
       (select count(*) from public.notifications x, c
         where x.user_id = u.id and x.circle_id = c.id and x.read_at is null) as unread_notifications,
       (select count(*) from public.interactions i, c where i.circle_id = c.id)                 as circle_posts,
       (select count(*) from public.interactions i, c where i.circle_id = c.id and i.kind = 'photo') as circle_photos,
       (select count(*) from storage.objects o, c
         where o.bucket_id = 'media' and o.name like c.id::text || '/demo-photo-%')               as demo_photo_files,
       (select max(day) from public.drift_scores d, c where d.circle_id = c.id)                 as last_drift_day
from cast_list cl
left join auth.users u on lower(u.email) = cl.email
left join public.profiles p on p.id = u.id
order by cl.n;
