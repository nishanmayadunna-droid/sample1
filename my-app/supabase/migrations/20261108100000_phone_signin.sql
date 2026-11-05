-- Part 9: phone sign-in with an SMS code. Run by the owner in the SQL editor,
-- BEFORE the code that uses it is deployed. This migration is additive: it
-- replaces no existing function, and nothing reads the new columns/tables until
-- the admin turns the feature on, so the shop keeps working before and after it.
--
-- Everything new is private: RLS is on with no policies and no grants for the
-- client roles; the app reaches it only through the secret key (service_role).

-- Users: a phone account has a phone and no email ---------------------------------

alter table public.users add column if not exists phone text;

-- Plain unique constraint (a unique index would also work); guarded so a re-run
-- does not fail. Postgres allows many NULL phones.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.users'::regclass and conname = 'users_phone_key'
  ) then
    alter table public.users add constraint users_phone_key unique (phone);
  end if;
end
$$;

alter table public.users alter column email drop not null;

-- The old unnamed row check (password_hash or google_id) is named users_check by
-- Postgres. Replace it: at least one login method, phone included.
alter table public.users drop constraint if exists users_check;
alter table public.users drop constraint if exists users_has_login_check;
alter table public.users add constraint users_has_login_check
  check (password_hash is not null or google_id is not null or phone is not null);

-- One-time codes -----------------------------------------------------------------
-- Only a keyed hash of the code is stored, never the code.

create table if not exists public.phone_otps (
  id         uuid primary key default gen_random_uuid(),
  phone      text not null,
  code_hash  text not null,
  expires_at timestamptz not null,
  attempts   integer not null default 0,
  used_at    timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists phone_otps_phone_created_idx
  on public.phone_otps (phone, created_at desc);
create index if not exists phone_otps_created_idx
  on public.phone_otps (created_at);

-- Settings (one row, feature OFF by default) ---------------------------------------

create table if not exists public.sms_settings (
  id        boolean primary key default true check (id),
  enabled   boolean not null default false,
  sender_id text not null default '',
  daily_cap integer not null default 200 check (daily_cap between 1 and 5000)
);

insert into public.sms_settings (id) values (true) on conflict (id) do nothing;

alter table public.phone_otps enable row level security;
alter table public.sms_settings enable row level security;
revoke all on table public.phone_otps from anon, authenticated;
revoke all on table public.sms_settings from anon, authenticated;

-- request_phone_code: the send limits, decided inside one transaction.
-- Returns 'ok' (a new code row was stored: send the SMS), 'too_soon',
-- 'hourly_limit' or 'daily_cap'. The advisory lock serialises every send, so two
-- requests at once cannot both pass the daily cap or the per-phone limits.

create or replace function public.request_phone_code(p_phone text, p_code_hash text) returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cap       integer;
  v_day_start timestamptz;
  v_sent      integer;
begin
  perform pg_advisory_xact_lock(hashtext('sms_send'));

  select daily_cap into v_cap from sms_settings limit 1;
  v_cap := coalesce(v_cap, 200);

  -- Midnight today in Sri Lanka, as an instant.
  v_day_start := date_trunc('day', now() at time zone 'Asia/Colombo') at time zone 'Asia/Colombo';

  select count(*) into v_sent from phone_otps where created_at >= v_day_start;
  if v_sent >= v_cap then
    return 'daily_cap';
  end if;

  if exists (
    select 1 from phone_otps
    where phone = p_phone and created_at > now() - interval '60 seconds'
  ) then
    return 'too_soon';
  end if;

  select count(*) into v_sent from phone_otps
  where phone = p_phone and created_at > now() - interval '1 hour';
  if v_sent >= 5 then
    return 'hourly_limit';
  end if;

  -- Sending again kills the older codes for this phone.
  update phone_otps set used_at = now()
  where phone = p_phone and used_at is null;

  insert into phone_otps (phone, code_hash, expires_at)
  values (p_phone, p_code_hash, now() + interval '5 minutes');

  return 'ok';
end;
$$;

-- verify_phone_code: checks a guess against the newest code for the phone.
-- Returns 'ok' (and uses the code up) or 'invalid'. The row is locked, so
-- parallel guesses queue up and each one is counted; a code that has had 5
-- guesses can never succeed again, even with the right hash.

create or replace function public.verify_phone_code(p_phone text, p_code_hash text) returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row phone_otps%rowtype;
begin
  select * into v_row from phone_otps
  where phone = p_phone
  order by created_at desc
  limit 1
  for update;

  if not found
     or v_row.used_at is not null
     or v_row.expires_at <= now()
     or v_row.attempts >= 5 then
    return 'invalid';
  end if;

  -- Every guess counts, right or wrong.
  update phone_otps set attempts = attempts + 1 where id = v_row.id;

  if v_row.code_hash = p_code_hash then
    update phone_otps set used_at = now() where id = v_row.id;
    return 'ok';
  end if;

  return 'invalid';
end;
$$;

-- cancel_phone_code: removes a code whose SMS could not be sent, so a failed send
-- does not count against the customer or the daily cap.

create or replace function public.cancel_phone_code(p_phone text, p_code_hash text) returns void
language sql
security definer
set search_path = public
as $$
  delete from phone_otps
  where phone = p_phone and code_hash = p_code_hash and used_at is null;
$$;

revoke all on function public.request_phone_code(text, text) from public, anon, authenticated;
grant execute on function public.request_phone_code(text, text) to service_role;
revoke all on function public.verify_phone_code(text, text) from public, anon, authenticated;
grant execute on function public.verify_phone_code(text, text) to service_role;
revoke all on function public.cancel_phone_code(text, text) from public, anon, authenticated;
grant execute on function public.cancel_phone_code(text, text) to service_role;
