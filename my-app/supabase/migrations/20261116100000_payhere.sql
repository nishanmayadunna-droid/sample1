-- Online card payments with PayHere (Part 22). Run by the owner in the SQL
-- editor BEFORE the code that uses it is deployed. Additive in behaviour: the
-- feature is OFF by default, place_order and set_order_status are NOT replaced,
-- and nothing reads the new tables until the admin switches it on.
--
-- Everything new is private: RLS on, no policies, no grants for the client
-- roles; the app reaches it only through the secret key (service_role). Money
-- state changes only inside confirm_online_payment / set_online_payment_status.

-- Orders: new payment method and status, and what online payment did -----------------

-- Drop whatever check constraints guard these two columns (their generated names
-- are not recorded in the repo), then add named ones that include the new values.
do $$
declare
  c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.orders'::regclass
      and contype = 'c'
      and (pg_get_constraintdef(oid) like '%payment_method%' or pg_get_constraintdef(oid) like '%payment_status%')
  loop
    execute format('alter table public.orders drop constraint %I', c.conname);
  end loop;
end
$$;

alter table public.orders add constraint orders_payment_method_check
  check (payment_method in ('cod', 'cod_advance', 'online'));
alter table public.orders add constraint orders_payment_status_check
  check (payment_status in ('unpaid', 'advance_due', 'slip_uploaded', 'advance_paid', 'online_paid'));

alter table public.orders
  add column if not exists online_discount    integer not null default 0 check (online_discount >= 0),
  add column if not exists online_paid_amount integer not null default 0 check (online_paid_amount >= 0),
  add column if not exists online_paid_at     timestamptz,
  add column if not exists online_gift        text check (online_gift is null or char_length(online_gift) <= 120);

-- Settings (one row, feature OFF, sandbox ON by default) ------------------------------

create table public.payhere_settings (
  id               boolean primary key default true check (id),
  enabled          boolean not null default false,
  -- true = sandbox.payhere.lk (test money), false = live payhere.lk
  sandbox          boolean not null default true,
  -- Percent off the goods (after promotions and points) for paying online, 0 = none.
  discount_percent integer not null default 0 check (discount_percent between 0 and 50),
  -- An optional gift line shown to customers who pay online ("Free tote bag").
  gift_si          text not null default '' check (char_length(gift_si) <= 120),
  gift_en          text not null default '' check (char_length(gift_en) <= 120)
);
insert into public.payhere_settings (id) values (true) on conflict (id) do nothing;

-- One row per payment attempt ----------------------------------------------------------
-- ref is the order_id sent to PayHere, unique per attempt (NB-10001-a1b2c3).
-- amount / discount are cents the SERVER worked out when the attempt began; the
-- notification must match amount exactly.

create table public.online_payments (
  id                 uuid primary key default gen_random_uuid(),
  order_id           uuid not null references public.orders (id) on delete restrict,
  ref                text not null unique check (char_length(ref) <= 50),
  amount             integer not null check (amount > 0),
  discount           integer not null default 0 check (discount >= 0),
  gift               text check (gift is null or char_length(gift) <= 120),
  status             text not null default 'pending'
                       check (status in ('pending', 'paid', 'failed', 'cancelled', 'chargedback', 'overpaid')),
  payhere_payment_id text,
  method             text check (method is null or char_length(method) <= 30),
  created_at         timestamptz not null default now(),
  paid_at            timestamptz
);

create index online_payments_order_idx on public.online_payments (order_id, created_at desc);
-- An order is paid once; a second payment of the same order is 'overpaid' (refund it).
create unique index online_payments_one_paid_per_order
  on public.online_payments (order_id) where status = 'paid';

alter table public.payhere_settings enable row level security;
alter table public.online_payments enable row level security;
revoke all on table public.payhere_settings from public, anon, authenticated;
revoke all on table public.online_payments from public, anon, authenticated;

-- confirm_online_payment: PayHere says this attempt succeeded (the caller already
-- checked the signature). Returns one word:
--   'unknown_ref'      no such attempt
--   'already'          this attempt was already confirmed (a repeated notification)
--   'amount_mismatch'  the amount differs from the attempt: nothing is changed
--   'overpaid'         the order was already paid by another attempt: refund this one
--   'paid'             the order is now paid online
--   'paid_no_order'    money received but the order could not take it (cancelled,
--                      delivered or advance already paid): the admin must refund
-- Under the order row lock, so it cannot race the stale-order cancel or an admin.

create or replace function public.confirm_online_payment(
  p_ref        text,
  p_payment_id text,
  p_amount     integer,
  p_method     text
) returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pay   online_payments%rowtype;
  v_order orders%rowtype;
begin
  select * into v_pay from online_payments where ref = p_ref;
  if not found then
    return 'unknown_ref';
  end if;

  -- Lock the order first (same order as everything else), then re-read the attempt.
  select * into v_order from orders where id = v_pay.order_id for update;
  select * into v_pay from online_payments where ref = p_ref for update;

  if v_pay.status in ('paid', 'overpaid') then
    return 'already';
  end if;
  if p_amount <> v_pay.amount then
    return 'amount_mismatch';
  end if;

  if exists (select 1 from online_payments where order_id = v_pay.order_id and status = 'paid') then
    update online_payments
    set status = 'overpaid', payhere_payment_id = p_payment_id, method = left(p_method, 30), paid_at = now()
    where id = v_pay.id;
    return 'overpaid';
  end if;

  update online_payments
  set status = 'paid', payhere_payment_id = p_payment_id, method = left(p_method, 30), paid_at = now()
  where id = v_pay.id;

  if v_order.status in ('pending', 'confirmed', 'shipped')
     and v_order.payment_status in ('unpaid', 'advance_due', 'slip_uploaded') then
    update orders
    set payment_method    = 'online',
        payment_status    = 'online_paid',
        advance_amount    = 0,
        online_discount   = v_pay.discount,
        online_paid_amount = v_pay.amount,
        online_paid_at    = now(),
        online_gift       = v_pay.gift
    where id = v_order.id;

    -- A slip still waiting for review is no longer needed.
    update payment_slips set status = 'waived', reviewed_at = now()
    where order_id = v_order.id and status = 'pending';
    return 'paid';
  end if;

  return 'paid_no_order';
end;
$$;

-- set_online_payment_status: a failed / cancelled / charged-back notification.
-- failed and cancelled only apply to a pending attempt; chargedback only to a paid one.
-- Returns 'ok', 'unknown_ref' or 'ignored'.

create or replace function public.set_online_payment_status(p_ref text, p_status text) returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pay online_payments%rowtype;
begin
  if p_status not in ('failed', 'cancelled', 'chargedback') then
    return 'ignored';
  end if;
  select * into v_pay from online_payments where ref = p_ref for update;
  if not found then
    return 'unknown_ref';
  end if;
  if (p_status in ('failed', 'cancelled') and v_pay.status = 'pending')
     or (p_status = 'chargedback' and v_pay.status in ('paid', 'overpaid')) then
    update online_payments set status = p_status where id = v_pay.id;
    return 'ok';
  end if;
  return 'ignored';
end;
$$;

revoke all on function public.confirm_online_payment(text, text, integer, text) from public, anon, authenticated;
grant execute on function public.confirm_online_payment(text, text, integer, text) to service_role;
revoke all on function public.set_online_payment_status(text, text) from public, anon, authenticated;
grant execute on function public.set_online_payment_status(text, text) to service_role;
