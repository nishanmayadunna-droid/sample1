-- Email (Part 11): order emails, password reset, email verification and a
-- double opt-in newsletter. Run by the owner in the SQL editor BEFORE the code
-- that uses it is deployed. Additive: nothing is replaced, and nothing is sent
-- until the admin switches email on (default OFF) and the provider keys exist.
--
-- Everything new is private: RLS on, no policies, no grants for the client
-- roles; the app reaches it only through the secret key (service_role).

-- Users: email verification ---------------------------------------------------------

alter table public.users add column if not exists email_verified_at timestamptz;

-- Settings (one row, OFF by default) and the send log -------------------------------

create table public.email_settings (
  id           boolean primary key default true check (id),
  enabled      boolean not null default false,
  order_emails boolean not null default true
);
insert into public.email_settings (id) values (true) on conflict (id) do nothing;

-- One row per message. unique (kind, dedupe) is the dedupe: a given message is
-- claimed once, before anything is sent. The recipient is stored masked.
create table public.email_log (
  id         uuid primary key default gen_random_uuid(),
  kind       text not null check (kind in ('order', 'reset', 'verify', 'newsletter_confirm')),
  dedupe     text not null,
  recipient  text not null check (char_length(recipient) <= 120),
  subject    text not null check (char_length(subject) <= 200),
  status     text not null check (status in ('sent', 'failed', 'skipped')),
  created_at timestamptz not null default now(),
  unique (kind, dedupe)
);
create index email_log_created_idx on public.email_log (created_at desc);

-- One-time tokens (password reset and email verification) ---------------------------
-- Only a SHA-256 hash of the token is stored, never the token.

create table public.auth_tokens (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.users (id) on delete cascade,
  kind       text not null check (kind in ('reset', 'verify')),
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at    timestamptz,
  created_at timestamptz not null default now()
);
create index auth_tokens_user_idx on public.auth_tokens (user_id, kind, created_at desc);

-- Small rate-limit buckets (per IP and the like) ----------------------------------------

create table public.rate_hits (
  key        text not null,
  created_at timestamptz not null default now()
);
create index rate_hits_key_idx on public.rate_hits (key, created_at desc);
create index rate_hits_created_idx on public.rate_hits (created_at);

-- Newsletter: double opt-in -------------------------------------------------------------
-- An address only counts once its owner clicked the link in the confirmation email.
-- subscribe_newsletter (single opt-in) stays in the database but is no longer called.

alter table public.newsletter_subscribers
  add column if not exists confirmed_at       timestamptz,
  add column if not exists confirm_token_hash text,
  add column if not exists confirm_expires_at timestamptz,
  add column if not exists confirm_sent_at    timestamptz;

alter table public.email_settings enable row level security;
alter table public.email_log enable row level security;
alter table public.auth_tokens enable row level security;
alter table public.rate_hits enable row level security;
revoke all on table public.email_settings from public, anon, authenticated;
revoke all on table public.email_log from public, anon, authenticated;
revoke all on table public.auth_tokens from public, anon, authenticated;
revoke all on table public.rate_hits from public, anon, authenticated;

-- rate_limit_hit: true = allowed (and counted), false = over the limit. One advisory
-- lock per key so two requests at once cannot both slip under it.

create function public.rate_limit_hit(p_key text, p_limit integer, p_window_seconds integer) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  if p_key is null or p_limit < 1 or p_window_seconds < 1 then
    return false;
  end if;
  perform pg_advisory_xact_lock(hashtext('rl:' || p_key));
  delete from rate_hits where created_at < now() - interval '1 day';
  select count(*) into v_count from rate_hits
  where key = p_key and created_at > now() - make_interval(secs => p_window_seconds);
  if v_count >= p_limit then
    return false;
  end if;
  insert into rate_hits (key) values (p_key);
  return true;
end;
$$;

-- create_auth_token: stores the hash of a new token for the user. At most 3 per kind
-- per hour (a person cannot be mail-bombed from the form); a new token replaces any
-- earlier unused one of the same kind. Returns 'ok' or 'too_many'.

create function public.create_auth_token(p_user_id uuid, p_kind text, p_hash text, p_ttl_seconds integer)
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_kind not in ('reset', 'verify') or p_ttl_seconds < 60 or p_ttl_seconds > 1209600 then
    return 'too_many';
  end if;
  perform pg_advisory_xact_lock(hashtext('auth_token:' || p_user_id::text || ':' || p_kind));
  if (select count(*) from auth_tokens
      where user_id = p_user_id and kind = p_kind and created_at > now() - interval '1 hour') >= 3 then
    return 'too_many';
  end if;
  update auth_tokens set used_at = now()
  where user_id = p_user_id and kind = p_kind and used_at is null;
  insert into auth_tokens (user_id, kind, token_hash, expires_at)
  values (p_user_id, p_kind, p_hash, now() + make_interval(secs => p_ttl_seconds));
  return 'ok';
end;
$$;

-- consume_auth_token: uses the token up and returns its user, or null when the token
-- is unknown, already used or expired. Atomic (one UPDATE), so a link works once.
-- Using a reset token also retires the user's other reset tokens.

create function public.consume_auth_token(p_hash text, p_kind text) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid;
begin
  update auth_tokens set used_at = now()
  where token_hash = p_hash and kind = p_kind and used_at is null and expires_at > now()
  returning user_id into v_user;
  if v_user is null then
    return null;
  end if;
  if p_kind = 'reset' then
    update auth_tokens set used_at = now()
    where user_id = v_user and kind = 'reset' and used_at is null;
  end if;
  return v_user;
end;
$$;

-- request_newsletter_subscription: the double opt-in entry point. Returns
--   'send'  a confirmation email should be sent now (the hash is stored)
--   'noop'  nothing to send (already confirmed, unsubscribed, or asked a moment ago)
--   'busy'  too many new addresses today
-- An unsubscribed address stays suppressed and never gets a confirmation.

create function public.request_newsletter_subscription(p_email text, p_source text, p_hash text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(btrim(p_email));
  v_row   newsletter_subscribers%rowtype;
begin
  select * into v_row from newsletter_subscribers where lower(email) = v_email for update;
  if found then
    if v_row.confirmed_at is not null or v_row.unsubscribed_at is not null then
      return 'noop';
    end if;
    if v_row.confirm_sent_at is not null and v_row.confirm_sent_at > now() - interval '10 minutes' then
      return 'noop';
    end if;
    update newsletter_subscribers
    set confirm_token_hash = p_hash,
        confirm_expires_at = now() + interval '7 days',
        confirm_sent_at    = now()
    where id = v_row.id;
    return 'send';
  end if;

  if (select count(*) from newsletter_subscribers where created_at > now() - interval '24 hours') >= 500 then
    return 'busy';
  end if;

  begin
    insert into newsletter_subscribers (email, source, confirm_token_hash, confirm_expires_at, confirm_sent_at)
    values (v_email, coalesce(nullif(btrim(p_source), ''), 'footer'), p_hash, now() + interval '7 days', now());
  exception when unique_violation then
    return 'noop';
  end;
  return 'send';
end;
$$;

-- confirm_newsletter: the link in the confirmation email. 'ok' or 'invalid'.

create function public.confirm_newsletter(p_hash text) returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  update newsletter_subscribers
  set confirmed_at = now(), confirm_token_hash = null, confirm_expires_at = null
  where confirm_token_hash = p_hash
    and confirm_expires_at > now()
    and confirmed_at is null
    and unsubscribed_at is null;
  if found then
    return 'ok';
  end if;
  return 'invalid';
end;
$$;

revoke all on function public.rate_limit_hit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.rate_limit_hit(text, integer, integer) to service_role;
revoke all on function public.create_auth_token(uuid, text, text, integer) from public, anon, authenticated;
grant execute on function public.create_auth_token(uuid, text, text, integer) to service_role;
revoke all on function public.consume_auth_token(text, text) from public, anon, authenticated;
grant execute on function public.consume_auth_token(text, text) to service_role;
revoke all on function public.request_newsletter_subscription(text, text, text) from public, anon, authenticated;
grant execute on function public.request_newsletter_subscription(text, text, text) to service_role;
revoke all on function public.confirm_newsletter(text) from public, anon, authenticated;
grant execute on function public.confirm_newsletter(text) to service_role;
