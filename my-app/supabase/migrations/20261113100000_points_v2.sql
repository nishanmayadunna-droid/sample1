-- Points v2 (Part 18): bonus-points events, tiers and expiry. Run by the owner in
-- the SQL editor BEFORE the code that uses it is deployed. Additive: place_order
-- and set_order_status are NOT replaced (the server works out an order's
-- points_to_earn, bonus and tier included, exactly as before). The shop keeps
-- behaving as it does today until an admin adds a bonus, a tier or an expiry.
--
-- Everything is private: RLS on, no policies, no grants for the client roles.

-- Expiry: points older than this many days (and not yet spent) expire. 0 = never.
alter table public.points_settings
  add column expiry_days integer not null default 0 check (expiry_days between 0 and 3650);

-- The ledger gains one kind: 'expire' (negative). It has no order, so the
-- per-order uniqueness index does not apply to it.
alter table public.points_ledger drop constraint points_ledger_kind_check;
alter table public.points_ledger add constraint points_ledger_kind_check
  check (kind in ('earn', 'redeem', 'refund', 'adjust', 'expire'));

-- Bonus events: while one is running, orders placed earn bonus_percent more
-- (100 = double). The best running bonus applies; bonuses do not stack.
create table public.points_bonuses (
  id            uuid primary key default gen_random_uuid(),
  name          text not null check (char_length(name) between 1 and 60),
  bonus_percent integer not null check (bonus_percent between 1 and 500),
  starts_at     timestamptz not null,
  ends_at       timestamptz not null,
  active        boolean not null default true,
  created_at    timestamptz not null default now(),
  check (ends_at > starts_at)
);

-- Tiers: a customer's lifetime goods spend on delivered orders picks the highest
-- tier whose min_spend (cents) they have reached; the tier adds bonus_percent.
create table public.points_tiers (
  id            uuid primary key default gen_random_uuid(),
  name          text not null check (char_length(name) between 1 and 30),
  min_spend     integer not null check (min_spend >= 0),
  bonus_percent integer not null default 0 check (bonus_percent between 0 and 500),
  created_at    timestamptz not null default now(),
  unique (min_spend)
);

alter table public.points_bonuses enable row level security;
alter table public.points_tiers enable row level security;
revoke all on table public.points_bonuses from public, anon, authenticated;
revoke all on table public.points_tiers from public, anon, authenticated;

-- expire_points: writes one negative 'expire' row per customer whose oldest
-- unspent points are past the expiry. Spending uses the oldest points first, so
-- the points to expire are (points earned before the cutoff) minus (everything
-- ever spent or expired), never more than the balance. Running it twice in a row
-- expires nothing the second time. Returns how many customers lost points.
-- Run by pg_cron (optional, see the next migration) and by the admin's button.

create function public.expire_points() returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_days      integer;
  v_cutoff    timestamptz;
  v_user      uuid;
  v_old_in    bigint;
  v_consumed  bigint;
  v_balance   bigint;
  v_expirable bigint;
  v_count     integer := 0;
begin
  select expiry_days into v_days from points_settings limit 1;
  if v_days is null or v_days <= 0 then
    return 0;
  end if;
  v_cutoff := now() - make_interval(days => v_days);

  for v_user in
    select user_id from points_ledger
    where points > 0 and created_at < v_cutoff
    group by user_id
  loop
    begin
      -- Same lock place_order takes before it touches a customer's points.
      perform 1 from users where id = v_user for update;

      select coalesce(sum(points) filter (where points > 0 and created_at < v_cutoff), 0),
             coalesce(-sum(points) filter (where points < 0), 0),
             coalesce(sum(points), 0)
      into v_old_in, v_consumed, v_balance
      from points_ledger where user_id = v_user;

      v_expirable := least(v_balance, v_old_in - v_consumed);
      if v_expirable > 0 then
        insert into points_ledger (user_id, kind, points, note)
        values (v_user, 'expire', -v_expirable::integer, 'Expired after ' || v_days || ' days');
        v_count := v_count + 1;
      end if;
    exception when others then
      -- One customer failing must not stop the rest; the next run tries again.
      null;
    end;
  end loop;

  return v_count;
end;
$$;

revoke all on function public.expire_points() from public, anon, authenticated;
grant execute on function public.expire_points() to service_role;
