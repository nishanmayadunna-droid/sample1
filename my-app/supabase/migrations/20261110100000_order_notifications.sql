-- Order notifications (SMS). Applied by the controller before the code that uses
-- it is deployed. Strictly additive: nothing reads these tables until the admin
-- turns the feature on (default OFF).
--
-- Both tables are private: RLS on, no policies, no grants for the client roles;
-- the app reaches them only through the secret key (service_role).

create table if not exists public.notification_settings (
  id               boolean primary key default true check (id),
  enabled          boolean not null default false,
  ev_placed        boolean not null default true,
  ev_advance_due   boolean not null default true,
  ev_slip_approved boolean not null default true,
  ev_slip_rejected boolean not null default true,
  ev_shipped       boolean not null default true,
  ev_delivered     boolean not null default true,
  ev_cancelled     boolean not null default true
);

insert into public.notification_settings (id) values (true) on conflict (id) do nothing;

-- One row per message. The unique key is the dedupe: a given event for a given
-- order (and slip, for slip events) is claimed once, before anything is sent.
create table if not exists public.order_notifications (
  id         uuid primary key default gen_random_uuid(),
  order_id   uuid not null references public.orders(id) on delete cascade,
  channel    text not null default 'sms' check (channel in ('sms')),
  event      text not null check (event in
    ('placed','advance_due','slip_approved','slip_rejected','shipped','delivered','cancelled')),
  dedupe     text not null default '',
  phone      text not null,
  body       text not null,
  segments   integer not null default 1,
  status     text not null check (status in ('sent','failed','skipped')),
  created_at timestamptz not null default now(),
  unique (order_id, channel, event, dedupe)
);

create index if not exists order_notifications_created_idx
  on public.order_notifications (created_at desc);

alter table public.notification_settings enable row level security;
alter table public.order_notifications enable row level security;
revoke all on table public.notification_settings from anon, authenticated;
revoke all on table public.order_notifications from anon, authenticated;
