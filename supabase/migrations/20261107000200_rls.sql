-- B0.3: row level security for every table, the private `media` bucket and its policies.
-- Membership checks go through SECURITY DEFINER helpers so circle_members policies
-- never query circle_members under RLS (that recursion breaks every query).

-- ---------- helpers ----------
create or replace function public.is_circle_member(p_circle_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.circle_members
    where circle_id = p_circle_id and user_id = auth.uid()
  );
$$;

-- Is p_user_id a member of p_circle_id? (for directed interactions: recipient must be in the circle)
create or replace function public.is_member_of(p_circle_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.circle_members
    where circle_id = p_circle_id and user_id = p_user_id
  );
$$;

-- Do I share at least one circle with p_user_id? (avatars)
create or replace function public.shares_circle_with(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_user_id = auth.uid() or exists (
    select 1
    from public.circle_members a
    join public.circle_members b on b.circle_id = a.circle_id
    where a.user_id = auth.uid() and b.user_id = p_user_id
  );
$$;

-- P0.13: can I see this interaction? Whole-circle -> any member; directed -> only sender + recipient.
create or replace function public.can_see_interaction(p_interaction_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.interactions i
    where i.id = p_interaction_id
      and public.is_circle_member(i.circle_id)
      and (i.recipient_id is null or auth.uid() in (i.sender_id, i.recipient_id))
  );
$$;

-- Can I read this storage object? Media follows the visibility of the row that points at it.
-- The uploader can always read their own file (needed between upload and the row insert).
create or replace function public.can_read_media(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
      select 1 from public.interactions i
      where i.media_path = p_name and public.can_see_interaction(i.id)
    )
    or exists (
      select 1 from public.shares s
      where s.media_path = p_name and public.is_circle_member(s.circle_id)
    );
$$;

-- Did I upload this file? Stops a member pointing a new row at someone else's private media.
create or replace function public.owns_media(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from storage.objects
    where bucket_id = 'media' and name = p_name and owner_id = auth.uid()::text
  );
$$;

-- Safe text -> uuid for storage paths (bad input returns null instead of erroring).
create or replace function public.try_uuid(p text)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
begin
  return p::uuid;
exception when others then
  return null;
end;
$$;

revoke all on function public.is_circle_member(uuid), public.is_member_of(uuid, uuid),
  public.shares_circle_with(uuid), public.can_see_interaction(uuid),
  public.can_read_media(text), public.owns_media(text) from public, anon;
grant execute on function public.is_circle_member(uuid), public.is_member_of(uuid, uuid),
  public.shares_circle_with(uuid), public.can_see_interaction(uuid),
  public.can_read_media(text), public.owns_media(text), public.try_uuid(text)
  to authenticated;

-- ---------- table privileges ----------
-- Supabase's default grants give anon + authenticated ALL on every table. Start from zero:
-- anon gets nothing, authenticated gets only what's granted below (and RLS narrows it further).
revoke all on all tables in schema public from anon, authenticated;

grant select, insert, update, delete on
  public.profiles, public.consents, public.interactions, public.reactions,
  public.shares, public.moments, public.daily_signals
  to authenticated;
grant select on public.circles, public.circle_members, public.spotlight_days to authenticated;
-- Any member may rename the circle or set its home area. Creating/joining/leaving goes through RPCs (B1.2).
grant update (name, home_area) on public.circles to authenticated;
grant insert on public.app_events to authenticated;
-- Members can't change their own role or someone else's membership directly.
revoke insert, update, delete on public.circle_members from authenticated;
-- Server-only tables: no client access at all.
revoke all on public.engagement_daily, public.drift_scores, public.nudges from authenticated, anon;

-- Views
revoke all on public.circle_profiles, public.my_nudges from anon, authenticated;
grant select on public.circle_profiles to authenticated;
grant select on public.my_nudges to authenticated;
grant update (acted_at) on public.my_nudges to authenticated;

-- ---------- enable RLS everywhere ----------
alter table public.profiles         enable row level security;
alter table public.consents         enable row level security;
alter table public.circles          enable row level security;
alter table public.circle_members   enable row level security;
alter table public.interactions     enable row level security;
alter table public.reactions        enable row level security;
alter table public.shares           enable row level security;
alter table public.spotlight_days   enable row level security;
alter table public.moments          enable row level security;
alter table public.app_events       enable row level security;
alter table public.daily_signals    enable row level security;
alter table public.engagement_daily enable row level security; -- no policies: service role only
alter table public.drift_scores     enable row level security; -- no policies: service role only
alter table public.nudges           enable row level security; -- no policies: read via my_nudges

-- ---------- profiles: self only (others read circle_profiles) ----------
create policy profiles_select_self on public.profiles
  for select to authenticated using (id = auth.uid());
create policy profiles_insert_self on public.profiles
  for insert to authenticated with check (id = auth.uid());
create policy profiles_update_self on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- ---------- consents: self only ----------
create policy consents_select_self on public.consents
  for select to authenticated using (user_id = auth.uid());
create policy consents_insert_self on public.consents
  for insert to authenticated with check (user_id = auth.uid());
create policy consents_update_self on public.consents
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------- circles ----------
create policy circles_select_member on public.circles
  for select to authenticated using (public.is_circle_member(id));
create policy circles_update_member on public.circles
  for update to authenticated
  using (public.is_circle_member(id)) with check (public.is_circle_member(id));

-- ---------- circle_members ----------
create policy circle_members_select_member on public.circle_members
  for select to authenticated using (public.is_circle_member(circle_id));

-- ---------- interactions ----------
-- P0.13: directed interactions (recipient_id set) are visible only to sender and recipient.
create policy interactions_select_visible on public.interactions
  for select to authenticated using (
    public.is_circle_member(circle_id)
    and (recipient_id is null or auth.uid() in (sender_id, recipient_id))
  );
create policy interactions_insert_sender on public.interactions
  for insert to authenticated with check (
    sender_id = auth.uid()
    and public.is_circle_member(circle_id)
    and (recipient_id is null or public.is_member_of(circle_id, recipient_id))
    and (media_path is null or (media_path like circle_id::text || '/%' and public.owns_media(media_path)))
  );
create policy interactions_delete_sender on public.interactions
  for delete to authenticated using (sender_id = auth.uid());

-- ---------- reactions ----------
-- Reactions follow the parent interaction's visibility (P0.13).
create policy reactions_select_visible on public.reactions
  for select to authenticated using (public.can_see_interaction(interaction_id));
create policy reactions_insert_self on public.reactions
  for insert to authenticated with check (
    user_id = auth.uid() and public.can_see_interaction(interaction_id)
  );
create policy reactions_delete_self on public.reactions
  for delete to authenticated using (user_id = auth.uid());

-- ---------- shares ----------
create policy shares_select_member on public.shares
  for select to authenticated using (public.is_circle_member(circle_id));
create policy shares_insert_author on public.shares
  for insert to authenticated with check (
    author_id = auth.uid()
    and public.is_circle_member(circle_id)
    and (media_path is null or (media_path like circle_id::text || '/%' and public.owns_media(media_path)))
  );
create policy shares_update_author on public.shares
  for update to authenticated
  using (author_id = auth.uid())
  with check (author_id = auth.uid() and public.is_circle_member(circle_id));
create policy shares_delete_author on public.shares
  for delete to authenticated using (author_id = auth.uid());

-- ---------- spotlight_days: read only (scheduler writes) ----------
create policy spotlight_days_select_member on public.spotlight_days
  for select to authenticated using (public.is_circle_member(circle_id));

-- ---------- moments: members read, only the person themselves creates ----------
create policy moments_select_member on public.moments
  for select to authenticated using (public.is_circle_member(circle_id));
create policy moments_insert_self on public.moments
  for insert to authenticated with check (
    user_id = auth.uid() and public.is_circle_member(circle_id)
  );
create policy moments_update_self on public.moments
  for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy moments_delete_self on public.moments
  for delete to authenticated using (user_id = auth.uid());

-- ---------- app_events: insert own only ----------
create policy app_events_insert_self on public.app_events
  for insert to authenticated with check (user_id = auth.uid());

-- ---------- daily_signals: self only (upsert needs select + insert + update) ----------
create policy daily_signals_select_self on public.daily_signals
  for select to authenticated using (user_id = auth.uid());
create policy daily_signals_insert_self on public.daily_signals
  for insert to authenticated with check (user_id = auth.uid());
create policy daily_signals_update_self on public.daily_signals
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy daily_signals_delete_self on public.daily_signals
  for delete to authenticated using (user_id = auth.uid());

-- ---------- storage: private `media` bucket ----------
-- Paths: {circle_id}/{interaction_or_share_id}.{ext}   -> members of circle_id write; read follows the
--                                                         interactions/shares row that points at it (P0.13)
--        avatars/{user_id}/{file}                      -> owner writes, people sharing a circle read
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'media', 'media', false, 20971520, -- 20 MB
  array['image/jpeg', 'image/png', 'image/heic', 'image/webp', 'audio/m4a', 'audio/mp4', 'audio/x-m4a', 'audio/aac']
)
on conflict (id) do nothing;

create policy media_select on storage.objects
  for select to authenticated using (
    bucket_id = 'media' and (
      owner_id = auth.uid()::text
      or public.can_read_media(name)
      or ((storage.foldername(name))[1] = 'avatars'
          and public.shares_circle_with(public.try_uuid((storage.foldername(name))[2])))
    )
  );

create policy media_insert on storage.objects
  for insert to authenticated with check (
    bucket_id = 'media' and (
      public.is_circle_member(public.try_uuid((storage.foldername(name))[1]))
      or ((storage.foldername(name))[1] = 'avatars'
          and (storage.foldername(name))[2] = auth.uid()::text)
    )
  );

-- Upsert / overwrite and delete: only the uploader.
create policy media_update on storage.objects
  for update to authenticated
  using (bucket_id = 'media' and owner_id = auth.uid()::text)
  with check (bucket_id = 'media' and owner_id = auth.uid()::text);

create policy media_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'media' and owner_id = auth.uid()::text);
