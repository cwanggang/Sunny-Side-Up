-- Phase 1: B1.1 signup trigger, B1.2 circle RPCs, B1.3 register_push_token.

-- ---------- B1.1: create profiles + consents rows on signup ----------
-- display_name: from sign-up metadata (email sign-up can pass { display_name }), Apple's full_name
-- (only sent on the very first Apple sign-in), else the part of the email before '@'.
create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
      nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
      nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      ''
    )
  )
  on conflict (id) do nothing;

  insert into public.consents (user_id) values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- Backfill anyone who signed up before this trigger existed.
insert into public.profiles (id, display_name)
select u.id, coalesce(nullif(split_part(coalesce(u.email, ''), '@', 1), ''), '')
from auth.users u
on conflict (id) do nothing;
insert into public.consents (user_id)
select id from public.profiles
on conflict (user_id) do nothing;

-- ---------- B1.2: circle RPCs ----------
-- Parameter names match the contract (plan §4.2), so they are qualified with the function name
-- wherever they could clash with a column.

create function public.create_circle(name text, home_area text default null)
returns public.circles
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_uid    uuid := auth.uid();
  v_circle public.circles;
begin
  if v_uid is null then
    raise exception 'Not signed in' using errcode = '28000';
  end if;
  if create_circle.name is null or length(trim(create_circle.name)) = 0 then
    raise exception 'Circle name is required' using errcode = '22023';
  end if;

  loop
    begin
      insert into public.circles (name, home_area, created_by, invite_code)
      values (trim(create_circle.name), nullif(trim(create_circle.home_area), ''), v_uid,
              private.generate_invite_code())
      returning * into v_circle;
      exit;
    exception when unique_violation then
      -- invite code collision: try another one
    end;
  end loop;

  insert into public.circle_members (circle_id, user_id, role)
  values (v_circle.id, v_uid, 'owner');

  return v_circle;
end;
$$;

create function public.join_circle(invite_code text)
returns public.circles
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_uid    uuid := auth.uid();
  v_code   text := upper(regexp_replace(coalesce(join_circle.invite_code, ''), '[^A-Za-z0-9]', '', 'g'));
  v_circle public.circles;
begin
  if v_uid is null then
    raise exception 'Not signed in' using errcode = '28000';
  end if;

  select * into v_circle from public.circles c where c.invite_code = v_code;
  if not found then
    raise exception 'Invite code not found' using errcode = 'P0002';
  end if;

  insert into public.circle_members (circle_id, user_id, role)
  values (v_circle.id, v_uid, 'member')
  on conflict (circle_id, user_id) do nothing;

  return v_circle;
end;
$$;

create function public.leave_circle(circle_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_uid  uuid := auth.uid();
  v_role public.circle_role;
begin
  if v_uid is null then
    raise exception 'Not signed in' using errcode = '28000';
  end if;

  delete from public.circle_members m
  where m.circle_id = leave_circle.circle_id and m.user_id = v_uid
  returning m.role into v_role;
  if not found then
    return; -- not a member: nothing to do
  end if;

  if not exists (select 1 from public.circle_members m where m.circle_id = leave_circle.circle_id) then
    -- last one out: delete the circle (cascades to its feed, shares, etc.)
    delete from public.circles c where c.id = leave_circle.circle_id;
  elsif v_role = 'owner'
    and not exists (select 1 from public.circle_members m
                    where m.circle_id = leave_circle.circle_id and m.role = 'owner') then
    -- hand ownership to the longest-standing member
    update public.circle_members m set role = 'owner'
    where (m.circle_id, m.user_id) = (
      select m2.circle_id, m2.user_id from public.circle_members m2
      where m2.circle_id = leave_circle.circle_id
      order by m2.joined_at
      limit 1
    );
  end if;
end;
$$;

-- ---------- B1.3: store the caller's Expo push token ----------
create function public.register_push_token(token text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Not signed in' using errcode = '28000';
  end if;
  if register_push_token.token is null
     or register_push_token.token !~ '^Expo(nent)?PushToken\[.+\]$' then
    raise exception 'Not an Expo push token' using errcode = '22023';
  end if;

  -- One phone = one account: if this device was signed in as someone else, stop pushing to them.
  update public.profiles p set expo_push_token = null
  where p.expo_push_token = register_push_token.token and p.id <> v_uid;

  update public.profiles p set expo_push_token = register_push_token.token
  where p.id = v_uid;
end;
$$;

revoke all on function public.create_circle(text, text), public.join_circle(text),
  public.leave_circle(uuid), public.register_push_token(text) from public, anon;
grant execute on function public.create_circle(text, text), public.join_circle(text),
  public.leave_circle(uuid), public.register_push_token(text) to authenticated;

-- Profiles rows come from the signup trigger. Clients cannot write expo_push_token directly
-- (only via register_push_token above),
-- and can't change their own id or created_at.
revoke insert, update on public.profiles from authenticated;
grant update (display_name, avatar_path, birthday, timezone) on public.profiles to authenticated;
