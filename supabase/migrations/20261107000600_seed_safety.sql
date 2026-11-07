-- B2.4: seeding history must never push to real phones.
-- The interaction push webhook now skips rows that are
--   * backdated (created_at more than 10 minutes before now), or
--   * inserted while the session sets  app.skip_webhooks = 'on'  (seed scripts do this).
-- Clients go through PostgREST and can't set session settings, so they can't use this to hide.

create or replace function private.notify_on_interaction()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(current_setting('app.skip_webhooks', true), '') = 'on'
     or new.created_at < now() - interval '10 minutes' then
    return null;
  end if;

  perform private.post_webhook('on-interaction', jsonb_build_object(
    'type', 'INSERT', 'table', 'interactions', 'schema', 'public',
    'record', to_jsonb(new), 'old_record', null
  ));
  return null;
end;
$$;

-- Timestamps come from the server clock only. Otherwise a client could backdate rows to skip
-- pushes or fake engagement history for the drift score. (Seeds run as postgres: unaffected.)
revoke insert, update on public.interactions, public.reactions, public.shares,
  public.moments, public.app_events from authenticated;

grant insert (id, circle_id, sender_id, recipient_id, kind, media_path, body) on public.interactions to authenticated;
grant insert (interaction_id, user_id, emoji) on public.reactions to authenticated;
grant insert (id, circle_id, author_id, kind, period_key, body, media_path) on public.shares to authenticated;
grant update (body, media_path) on public.shares to authenticated;
grant insert (id, circle_id, user_id, title, occurs_on) on public.moments to authenticated;
grant update (title, occurs_on) on public.moments to authenticated;
grant insert (user_id, kind) on public.app_events to authenticated;
