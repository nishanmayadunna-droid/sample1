-- Owner alerts (Part 17): SMS to the shop owner on a new order, a new payment
-- slip, low stock and a failed customer SMS. Run by the owner in the SQL editor
-- BEFORE the code that uses it is deployed. Strictly additive: nothing reads
-- these tables until the admin turns the feature on (default OFF).
--
-- Both tables are private: RLS on, no policies, no grants for the client roles;
-- the app reaches them only through the secret key (service_role).

create table if not exists public.owner_alert_settings (
  id              boolean primary key default true check (id),
  enabled         boolean not null default false,
  -- Sri Lankan mobile, stored as 07XXXXXXXX. Required before the switch can be on.
  phone           text check (phone is null or phone ~ '^07[0-9]{8}$'),
  ev_new_order    boolean not null default true,
  ev_new_slip     boolean not null default true,
  ev_low_stock    boolean not null default true,
  ev_sms_failed   boolean not null default true,
  -- Alert when a tracked size drops to this many or fewer.
  low_stock_at    integer not null default 3 check (low_stock_at between 1 and 50),
  check (not enabled or phone is not null)
);

insert into public.owner_alert_settings (id) values (true) on conflict (id) do nothing;

-- One row per alert. The unique key is the dedupe: an event for a given subject
-- (order, slip, product size and day, failed message) is claimed once, before
-- anything is sent.
create table if not exists public.owner_alerts (
  id         uuid primary key default gen_random_uuid(),
  event      text not null check (event in ('new_order', 'new_slip', 'low_stock', 'sms_failed')),
  dedupe     text not null,
  body       text not null,
  segments   integer not null default 1,
  status     text not null check (status in ('sent', 'failed', 'skipped')),
  created_at timestamptz not null default now(),
  unique (event, dedupe)
);

create index if not exists owner_alerts_created_idx on public.owner_alerts (created_at desc);

alter table public.owner_alert_settings enable row level security;
alter table public.owner_alerts enable row level security;
revoke all on table public.owner_alert_settings from public, anon, authenticated;
revoke all on table public.owner_alerts from public, anon, authenticated;
