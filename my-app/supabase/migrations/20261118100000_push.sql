-- Push notifications with Firebase Cloud Messaging (Part 23). Run by the owner in
-- the Supabase SQL editor BEFORE the code that uses it is deployed. Additive:
-- nothing is replaced, and nothing is sent until the admin switches push on
-- (default OFF) and the Firebase keys exist.
--
-- Everything new is private: RLS on, no policies, no grants for the client roles;
-- the app reaches it only through the secret key (service_role). Device tokens
-- are secrets: they are never shown, logged or put in a URL.

-- Settings (one row, OFF by default) --------------------------------------------------

create table public.push_settings (
  id                        boolean primary key default true check (id),
  enabled                   boolean not null default false,
  -- The shop owner's devices (admin accounts): the same four events as owner SMS alerts.
  ev_owner_new_order        boolean not null default true,
  ev_owner_new_slip         boolean not null default true,
  ev_owner_low_stock        boolean not null default true,
  ev_owner_sms_failed       boolean not null default true,
  -- A customer's own devices: their own order events.
  ev_customer_placed        boolean not null default true,
  ev_customer_shipped       boolean not null default true,
  ev_customer_delivered     boolean not null default true,
  ev_customer_cancelled     boolean not null default true,
  ev_customer_slip_approved boolean not null default true,
  ev_customer_slip_rejected boolean not null default true
);
insert into public.push_settings (id) values (true) on conflict (id) do nothing;

-- Device tokens ---------------------------------------------------------------------------
-- One row per browser/app install. platform leaves room for a mobile app later.

create table public.push_tokens (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.users (id) on delete cascade,
  platform     text not null check (platform in ('web', 'android', 'ios')),
  token        text not null unique check (char_length(token) between 20 and 4096),
  last_seen_at timestamptz not null default now(),
  created_at   timestamptz not null default now()
);
create index push_tokens_user_idx on public.push_tokens (user_id);

-- Send log ------------------------------------------------------------------------------------
-- unique (kind, dedupe): a message is claimed once, before anything is sent. The log
-- holds the event name only, never the message text, and the recipient is masked.

create table public.push_log (
  id         uuid primary key default gen_random_uuid(),
  kind       text not null check (kind in ('owner', 'customer')),
  dedupe     text not null,
  event      text not null check (char_length(event) <= 40),
  recipient  text not null check (char_length(recipient) <= 40),
  status     text not null check (status in ('sent', 'failed', 'skipped')),
  created_at timestamptz not null default now(),
  unique (kind, dedupe)
);
create index push_log_created_idx on public.push_log (created_at desc);

alter table public.push_settings enable row level security;
alter table public.push_tokens enable row level security;
alter table public.push_log enable row level security;
revoke all on table public.push_settings from public, anon, authenticated;
revoke all on table public.push_tokens from public, anon, authenticated;
revoke all on table public.push_log from public, anon, authenticated;

-- register_push_token: saves a device token for the user. At most 10 registrations an
-- hour per user (uses rate_limit_hit from the email migration) and 10 devices per user
-- (the least recently seen one is dropped). A token that already exists moves to this
-- user: the same browser being used by someone else must stop notifying the old person.
-- Returns 'ok', 'invalid' or 'too_many'.

create function public.register_push_token(p_user_id uuid, p_platform text, p_token text)
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_platform not in ('web', 'android', 'ios')
     or p_token is null
     or char_length(p_token) < 20 or char_length(p_token) > 4096 then
    return 'invalid';
  end if;
  if not exists (select 1 from users where id = p_user_id) then
    return 'invalid';
  end if;
  if not public.rate_limit_hit('push-reg:' || p_user_id::text, 10, 3600) then
    return 'too_many';
  end if;

  perform pg_advisory_xact_lock(hashtext('push_tokens:' || p_user_id::text));

  if exists (select 1 from push_tokens where token = p_token) then
    update push_tokens
    set user_id = p_user_id, platform = p_platform, last_seen_at = now()
    where token = p_token;
    return 'ok';
  end if;

  delete from push_tokens
  where id in (
    select id from push_tokens
    where user_id = p_user_id
    order by last_seen_at desc
    offset 9
  );

  insert into push_tokens (user_id, platform, token) values (p_user_id, p_platform, p_token);
  return 'ok';
end;
$$;

-- unregister_push_token: removes ONE of the user's own tokens; someone else's token is
-- never touched. Returns 'ok' or 'not_found'.

create function public.unregister_push_token(p_user_id uuid, p_token text) returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from push_tokens where user_id = p_user_id and token = p_token;
  if found then
    return 'ok';
  end if;
  return 'not_found';
end;
$$;

revoke all on function public.register_push_token(uuid, text, text) from public, anon, authenticated;
grant execute on function public.register_push_token(uuid, text, text) to service_role;
revoke all on function public.unregister_push_token(uuid, text) from public, anon, authenticated;
grant execute on function public.unregister_push_token(uuid, text) to service_role;
