-- Reset demo also rebuilds engagement_daily, so the Informer chart (analytics views) shows the
-- 18-day history and the 3-day dip as soon as the demo is reset, before "Run drift + nudge".
create or replace function public.demo_reseed(
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
  -- engagement history for Informer right away (counts only; drift + nudges still wait for the
  -- demo's "Run drift + nudge" step)
  perform private.build_engagement((now() at time zone 'America/New_York')::date - 18,
                                   (now() at time zone 'America/New_York')::date - 1);
  return v_res || jsonb_build_object('egg_war', v_war);
end;
$$;
revoke all on function public.demo_reseed(text[]) from public, anon, authenticated;
grant execute on function public.demo_reseed(text[]) to service_role;

-- Alert line 25% -> 20%: with the 3-person cast, one friend fading out is a ~20% dip for the
-- circle (the others' replies to them fade too, but not to zero). Same columns, same meaning.
create or replace view analytics.circle_engagement_alerts as
with latest as (select max(day) as d from analytics.circle_engagement_daily),
w as (
  select c.circle_key,
         avg(c.activity_per_member) filter (where c.day >  l.d - 3)                       as recent_avg,
         avg(c.activity_per_member) filter (where c.day <= l.d - 3 and c.day > l.d - 17)  as baseline_avg
  from analytics.circle_engagement_daily c cross join latest l
  where c.day > l.d - 17
  group by c.circle_key
)
select circle_key,
       round(recent_avg, 2)   as recent_avg,
       round(baseline_avg, 2) as baseline_avg,
       round(100 * (1 - recent_avg / nullif(baseline_avg, 0)), 1) as drop_pct,
       coalesce(baseline_avg >= 1 and recent_avg <= 0.80 * baseline_avg, false) as alert
from w;
grant select on analytics.circle_engagement_alerts to informer_ro;
