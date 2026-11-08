-- Egg war fixes from Developer A's contract review (2026-11-08):
--   1. post_snipe: the photo must be owned by the sniper (private.owns_media), not just sit in the
--      coop's folder. can_read_media also only opens a snipe photo the sniper owns (defense in depth).
--   2. leave_egg_war: opt out during a live war. post_snipe already refuses targets who aren't in,
--      and the leaderboard lists only people who are in. Snipes of you stay until the war ends;
--      you can delete any of them with delete_snipe.

-- A snipe: upload the photo to media/{circle_id}/{snipe_id}.jpg first, then call this.
create or replace function public.post_snipe(p_war_id uuid, p_target_id uuid, p_media_path text, p_caption text default null, p_id uuid default null)
returns public.egg_war_snipes
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := auth.uid();
  w    public.egg_wars;
  s    public.egg_war_snipes;
  v_cap text := nullif(trim(coalesce(p_caption, '')), '');
begin
  perform private.advance_egg_wars();
  select * into w from public.egg_wars where id = p_war_id;
  if w.id is null or not private.is_circle_member(w.circle_id) then
    raise exception 'egg war not found' using errcode = 'P0002';
  end if;
  if w.state <> 'live' then
    raise exception 'this egg war is not live' using errcode = '22023';
  end if;
  if not exists (select 1 from public.egg_war_people where war_id = w.id and user_id = v_me and choice = 'in') then
    raise exception 'join the egg war first' using errcode = '42501';
  end if;
  if p_target_id = v_me
     or not exists (select 1 from public.egg_war_people where war_id = w.id and user_id = p_target_id and choice = 'in') then
    raise exception 'you can only egg someone who opted in' using errcode = '22023';
  end if;
  if (storage.foldername(p_media_path))[1] is distinct from w.circle_id::text then
    raise exception 'photo must be in this coop''s folder' using errcode = '22023';
  end if;
  -- the photo must be one the sniper uploaded: otherwise a snipe could point at someone else's
  -- private file in the same folder (e.g. a directed photo) and open it to the whole coop
  if not private.owns_media(p_media_path) then
    raise exception 'upload the snipe photo first' using errcode = '42501';
  end if;
  if v_cap is not null and length(v_cap) > 100 then
    raise exception 'caption is 100 characters max' using errcode = '22001';
  end if;
  insert into public.egg_war_snipes (id, war_id, circle_id, sniper_id, target_id, caption, media_path)
  values (coalesce(p_id, gen_random_uuid()), w.id, w.circle_id, v_me, p_target_id, v_cap, p_media_path)
  returning * into s;
  perform private.create_notifications(jsonb_build_array(jsonb_build_object(
    'user_id', p_target_id, 'type', 'egg_war', 'circle_id', w.circle_id, 'target_id', w.id::text,
    'title', 'you got egged 🥚', 'body', private.egg_war_handle(v_me) || ' sniped you' || coalesce(': ' || v_cap, '!'))));
  return s;
end;
$$;


create or replace function private.can_read_media(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.interactions i where i.media_path = p_name and private.can_see_interaction(i.id))
      or exists (select 1 from public.shares s where s.media_path = p_name and private.can_see_share(s.id))
      or exists (
        select 1 from public.photos ph where ph.media_path = p_name
          and case when ph.event_id is null then private.is_circle_member(ph.circle_id)
                   else private.can_see_event(ph.event_id) end)
      or exists (select 1 from public.circles c where c.cover_path = p_name and private.is_circle_member(c.id))
      or exists (
        select 1 from public.egg_war_snipes s
        where s.media_path = p_name and private.is_circle_member(s.circle_id)
          and exists (select 1 from storage.objects o
                      where o.bucket_id = 'media' and o.name = p_name and o.owner_id = s.sniper_id::text));
$$;


create function public.leave_egg_war(p_war_id uuid)
returns public.egg_wars
language plpgsql
security definer
set search_path = ''
as $$
declare
  w public.egg_wars;
begin
  perform private.advance_egg_wars();
  select * into w from public.egg_wars where id = p_war_id;
  if w.id is null or not private.is_circle_member(w.circle_id) then
    raise exception 'egg war not found' using errcode = 'P0002';
  end if;
  if w.state <> 'live' then
    raise exception 'this egg war is not live (during the vote, just opt out)' using errcode = '22023';
  end if;
  update public.egg_war_people set choice = 'out', updated_at = now()
   where war_id = w.id and user_id = auth.uid() and choice = 'in';
  if not found then
    raise exception 'you are not in this egg war' using errcode = '22023';
  end if;
  return w;
end;
$$;
revoke all on function public.leave_egg_war(uuid) from public, anon;
grant execute on function public.leave_egg_war(uuid) to authenticated;
