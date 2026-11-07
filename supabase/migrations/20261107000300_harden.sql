-- B0.3 follow-up from `supabase db advisors`:
-- 1. Helper functions move to a `private` schema that the REST API doesn't expose, so nobody can
--    call e.g. is_member_of() over /rpc to probe who is in other circles. Policies keep working:
--    they reference functions by OID, so ALTER ... SET SCHEMA carries them along.
-- 2. Views become security_invoker (no SECURITY DEFINER views).
-- 3. auth.uid() in policies is wrapped as (select auth.uid()) so it's evaluated once per query.

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role;

alter function public.is_circle_member(uuid)       set schema private;
alter function public.is_member_of(uuid, uuid)     set schema private;
alter function public.shares_circle_with(uuid)     set schema private;
alter function public.can_see_interaction(uuid)    set schema private;
alter function public.can_read_media(text)         set schema private;
alter function public.owns_media(text)             set schema private;
alter function public.try_uuid(text)               set schema private;
alter function public.generate_invite_code()       set schema private;
alter function public.touch_updated_at()           set schema private;

-- Bodies are plain SQL text, so helpers that call other helpers need their references updated.
create or replace function private.can_see_interaction(p_interaction_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.interactions i
    where i.id = p_interaction_id
      and private.is_circle_member(i.circle_id)
      and (i.recipient_id is null or auth.uid() in (i.sender_id, i.recipient_id))
  );
$$;

create or replace function private.can_read_media(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
      select 1 from public.interactions i
      where i.media_path = p_name and private.can_see_interaction(i.id)
    )
    or exists (
      select 1 from public.shares s
      where s.media_path = p_name and private.is_circle_member(s.circle_id)
    );
$$;

-- ---------- circle_profiles: invoker view over a definer function ----------
create function private.circle_profiles_rows()
returns table (
  circle_id    uuid,
  id           uuid,
  display_name text,
  avatar_path  text,
  birthday     date,
  role         public.circle_role,
  joined_at    timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select cm.circle_id, p.id, p.display_name, p.avatar_path, p.birthday, cm.role, cm.joined_at
  from public.circle_members cm
  join public.profiles p on p.id = cm.user_id
  where private.is_circle_member(cm.circle_id);
$$;
revoke all on function private.circle_profiles_rows() from public, anon;
grant execute on function private.circle_profiles_rows() to authenticated;

drop view public.circle_profiles;
create view public.circle_profiles
with (security_invoker = true)
as select * from private.circle_profiles_rows();
revoke all on public.circle_profiles from anon, authenticated;
grant select on public.circle_profiles to authenticated;

-- ---------- my_nudges: invoker view; base table locked to own rows and never reason_kind ----------
drop view public.my_nudges;

create policy nudges_select_own on public.nudges
  for select to authenticated using (recipient_id = (select auth.uid()));
create policy nudges_update_own on public.nudges
  for update to authenticated
  using (recipient_id = (select auth.uid())) with check (recipient_id = (select auth.uid()));
-- Column grants: reason_kind is not granted, so it can never be selected by a client.
grant select (id, circle_id, recipient_id, about_user_id, message, sent_at, acted_at) on public.nudges to authenticated;
grant update (acted_at) on public.nudges to authenticated;

create view public.my_nudges
with (security_invoker = true, security_barrier = true)
as
select id, circle_id, about_user_id, message, sent_at, acted_at
from public.nudges
where recipient_id = (select auth.uid());
revoke all on public.my_nudges from anon, authenticated;
grant select on public.my_nudges to authenticated;
grant update (acted_at) on public.my_nudges to authenticated;

-- ---------- (select auth.uid()) in every public policy ----------
do $$
declare
  p record;
  new_qual  text;
  new_check text;
  stmt      text;
begin
  for p in
    select policyname, tablename, qual, with_check
    from pg_policies
    where schemaname = 'public'
      and (qual like '%auth.uid()%' or with_check like '%auth.uid()%')
  loop
    new_qual  := replace(replace(p.qual,       '( SELECT auth.uid() AS uid)', 'auth.uid()'), 'auth.uid()', '(select auth.uid())');
    new_check := replace(replace(p.with_check, '( SELECT auth.uid() AS uid)', 'auth.uid()'), 'auth.uid()', '(select auth.uid())');
    stmt := format('alter policy %I on public.%I', p.policyname, p.tablename);
    if new_qual is not null then
      stmt := stmt || format(' using (%s)', new_qual);
    end if;
    if new_check is not null then
      stmt := stmt || format(' with check (%s)', new_check);
    end if;
    execute stmt;
  end loop;
end;
$$;
