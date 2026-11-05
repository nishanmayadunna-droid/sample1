-- Delivery (Part 12): shipping fee by district zone, couriers, and tracking on
-- orders. Run by the owner in the SQL editor. Additive: it replaces no function
-- (place_order is untouched) and the running code ignores everything here, so it
-- can be applied before or after the code that uses it.

-- Shipping zones ---------------------------------------------------------------
-- A zone is a named fee (cents) for a set of districts. The default fee stays in
-- store_settings.shipping_fee and applies to any district that is in no zone.
-- Fees are public (checkout shows them); writes go through the secret key.

create table if not exists public.shipping_zones (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  fee        integer not null check (fee >= 0),
  districts  text[] not null default '{}',
  sort_order integer not null default 0
);

alter table public.shipping_zones enable row level security;

drop policy if exists "Shipping zones are publicly readable" on public.shipping_zones;
create policy "Shipping zones are publicly readable"
  on public.shipping_zones for select to anon, authenticated using (true);

revoke all on table public.shipping_zones from anon, authenticated;
grant select on table public.shipping_zones to anon, authenticated;

-- Couriers -----------------------------------------------------------------------
-- Private: RLS on, no policies, no grants. Only the secret key reads or writes.

create table if not exists public.couriers (
  id                    uuid primary key default gen_random_uuid(),
  name                  text not null,
  tracking_url_template text,
  active                boolean not null default true,
  sort_order            integer not null default 0
);

alter table public.couriers enable row level security;
revoke all on table public.couriers from anon, authenticated;

-- Orders ---------------------------------------------------------------------------
-- Nullable snapshots, so later courier or zone edits never rewrite old orders.

alter table public.orders
  add column if not exists district        text,
  add column if not exists courier_name    text,
  add column if not exists tracking_number text,
  add column if not exists tracking_url    text;

-- Seed ---------------------------------------------------------------------------------
-- One zone with every district at the current default fee, so nothing changes
-- until the admin edits zones. Runs only while the table is empty.

insert into public.shipping_zones (name, fee, districts, sort_order)
select
  'Island-wide',
  coalesce((select shipping_fee from public.store_settings limit 1), 35000),
  array[
    'Ampara', 'Anuradhapura', 'Badulla', 'Batticaloa', 'Colombo', 'Galle',
    'Gampaha', 'Hambantota', 'Jaffna', 'Kalutara', 'Kandy', 'Kegalle',
    'Kilinochchi', 'Kurunegala', 'Mannar', 'Matale', 'Matara', 'Monaragala',
    'Mullaitivu', 'Nuwara Eliya', 'Polonnaruwa', 'Puttalam', 'Ratnapura',
    'Trincomalee', 'Vavuniya'
  ],
  1
where not exists (select 1 from public.shipping_zones);
