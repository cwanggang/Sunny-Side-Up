-- Phase 2: B2.1 interaction webhook, B2.3 media cleanup webhook, B2.5 app_open logging.
--
-- Webhooks are our own pg_net triggers (same JSON shape as Supabase database webhooks).
-- They authenticate with a random secret that is generated here and kept in Vault, so it never
-- appears in the repo. The Edge Function checks it by calling private.verify_webhook_secret()
-- with the service role.

-- ---------- config + secret ----------
create table private.app_config (
  key   text primary key,
  value text not null
);
revoke all on private.app_config from public, anon, authenticated;

insert into private.app_config (key, value) values
  ('functions_url', 'https://zztlrcshhvhesnocbhrh.supabase.co/functions/v1')
on conflict (key) do update set value = excluded.value;

select vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'webhook_secret',
                           'Shared secret for pg_net -> Edge Function webhooks')
where not exists (select 1 from vault.secrets where name = 'webhook_secret');

create function private.webhook_secret()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'webhook_secret' limit 1;
$$;
revoke all on function private.webhook_secret() from public, anon, authenticated;

-- Called by Edge Functions (service role only) to check the x-webhook-secret header.
create function public.verify_webhook_secret(p_secret text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_secret is not null and p_secret = private.webhook_secret();
$$;
revoke all on function public.verify_webhook_secret(text) from public, anon, authenticated;
grant execute on function public.verify_webhook_secret(text) to service_role;

-- POST a database-webhook-shaped payload to an Edge Function (async, never blocks the insert).
create function private.post_webhook(p_function text, p_payload jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_base text := (select value from private.app_config where key = 'functions_url');
begin
  perform net.http_post(
    url := v_base || '/' || p_function,
    body := p_payload,
    headers := jsonb_build_object(
      'content-type', 'application/json',
      'x-webhook-secret', private.webhook_secret()
    ),
    timeout_milliseconds := 5000
  );
end;
$$;
revoke all on function private.post_webhook(text, jsonb) from public, anon, authenticated;

-- ---------- B2.1: interactions insert -> on-interaction ----------
create function private.notify_on_interaction()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.post_webhook('on-interaction', jsonb_build_object(
    'type', 'INSERT', 'table', 'interactions', 'schema', 'public',
    'record', to_jsonb(new), 'old_record', null
  ));
  return null;
end;
$$;

create trigger interactions_push_webhook
  after insert on public.interactions
  for each row execute function private.notify_on_interaction();

-- ---------- B2.3: delete media files when their row goes ----------
-- (Covers single deletes and cascades from account / circle deletion.
--  Files must be removed through the Storage API, not by deleting storage.objects rows.)
create function private.notify_media_cleanup()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.media_path is not null then
    perform private.post_webhook('media-cleanup', jsonb_build_object(
      'type', 'DELETE', 'table', tg_table_name, 'schema', 'public',
      'record', null, 'old_record', to_jsonb(old)
    ));
  end if;
  return null;
end;
$$;

create trigger interactions_media_cleanup
  after delete on public.interactions
  for each row execute function private.notify_media_cleanup();

create trigger shares_media_cleanup
  after delete on public.shares
  for each row execute function private.notify_media_cleanup();

-- Replacing an avatar or share photo also orphans the old file.
create function private.notify_media_replaced()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- via jsonb: plpgsql can't reference old.avatar_path on a table without that column
  v_col text := case when tg_table_name = 'profiles' then 'avatar_path' else 'media_path' end;
  v_old text := to_jsonb(old) ->> v_col;
  v_new text := to_jsonb(new) ->> v_col;
begin
  if v_old is not null and v_old is distinct from v_new then
    perform private.post_webhook('media-cleanup', jsonb_build_object(
      'type', 'UPDATE', 'table', tg_table_name, 'schema', 'public',
      'record', null, 'old_record', jsonb_build_object('media_path', v_old)
    ));
  end if;
  return null;
end;
$$;

create trigger shares_media_replaced
  after update of media_path on public.shares
  for each row execute function private.notify_media_replaced();

create trigger profiles_avatar_replaced
  after update of avatar_path on public.profiles
  for each row execute function private.notify_media_replaced();

-- ---------- B2.5: app_open logging ----------
-- Clients insert into app_events directly (insert-only policy from B0.3; user_id and kind default).
-- Server-side throttle: at most one app_open per user per 30 minutes, so engagement counts
-- can't be inflated by a chatty client. Inserts inside the window are silently dropped.
create function private.throttle_app_open()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.app_events e
    where e.user_id = new.user_id
      and e.kind = new.kind
      and e.at > new.at - interval '30 minutes'
      and e.at <= new.at
  ) then
    return null;
  end if;
  return new;
end;
$$;

create trigger app_events_throttle
  before insert on public.app_events
  for each row execute function private.throttle_app_open();
