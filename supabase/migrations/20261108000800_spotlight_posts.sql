-- Spotlight posts (decided 2026-11-08): only that day's spotlight person posts, and may post
-- several times that day; everyone else in the circle reacts. Contract change:
--   * drop the one-per-day limit on `spotlight` shares (insert rule "only today's person" stays)
--   * new `share_reactions` (reactions on shares; same visibility as the share), in Realtime
--   * the author is notified of reactions; reactions count toward engagement like feed reactions

drop index public.shares_one_daily_photo;

create table public.share_reactions (
  share_id   uuid not null references public.shares (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  emoji      text not null check (length(emoji) between 1 and 16),
  created_at timestamptz not null default now(),
  primary key (share_id, user_id, emoji)
);
create index share_reactions_user_idx on public.share_reactions (user_id, created_at);

alter table public.share_reactions enable row level security;
revoke all on public.share_reactions from anon, authenticated;
grant select, delete on public.share_reactions to authenticated;
grant insert (share_id, user_id, emoji) on public.share_reactions to authenticated;
create policy share_reactions_select_visible on public.share_reactions
  for select to authenticated using (private.can_see_share(share_id));
create policy share_reactions_insert_self on public.share_reactions
  for insert to authenticated with check (user_id = (select auth.uid()) and private.can_see_share(share_id));
create policy share_reactions_delete_self on public.share_reactions
  for delete to authenticated using (user_id = (select auth.uid()));

alter publication supabase_realtime add table public.share_reactions;

-- "Jun reacted ❤️ to your photo" -> the share's author (not for own reactions, not during seeds)
create function private.notify_on_share_reaction()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_share  public.shares;
  v_who    text;
  v_circle text;
begin
  if coalesce(current_setting('app.skip_webhooks', true), '') = 'on'
     or new.created_at < now() - interval '10 minutes' then
    return null;
  end if;
  select * into v_share from public.shares where id = new.share_id;
  if v_share.id is null or v_share.author_id = new.user_id then
    return null;
  end if;
  select coalesce(nullif(split_part(trim(display_name), ' ', 1), ''), 'someone') into v_who
  from public.profiles where id = new.user_id;
  select name into v_circle from public.circles where id = v_share.circle_id;
  perform private.create_notifications(jsonb_build_array(jsonb_build_object(
    'user_id', v_share.author_id,
    'type', case when v_share.kind = 'spotlight' then 'spotlight' else 'share_open' end,
    'circle_id', v_share.circle_id,
    'target_id', case when v_share.kind = 'spotlight' then v_share.author_id::text else v_share.period_key end,
    'title', coalesce(v_circle, 'Sunny Side Up'),
    'body', coalesce(v_who, 'someone') || ' reacted ' || new.emoji || ' to your ' ||
            case when v_share.kind = 'spotlight' then 'photo' else 'post' end)), true);
  return null;
end;
$$;

create trigger share_reactions_notify
  after insert on public.share_reactions
  for each row execute function private.notify_on_share_reaction();

-- engagement: + reactions given on shares (sent) and received on my shares (received)
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
