-- Loyalty points. Run by the owner in the SQL editor, BEFORE the code that uses
-- these is deployed.
--
-- Points are earned when an order is DELIVERED and spent at checkout as a
-- discount. Everything here is private: RLS is on with no policies and no grants
-- for the public roles, and points move only inside the service_role-only
-- functions below, in the same transaction as the order or status change. The
-- shop starts with points switched OFF, so applying this changes nothing for
-- customers until the admin turns it on.
--
-- NOTE: this REPLACES place_order (new signature with the points arguments), so
-- the checkout code from before this change cannot place orders once it runs.

-- Settings (one row) -------------------------------------------------------

create table public.points_settings (
  id          boolean primary key default true check (id),
  enabled     boolean not null default false,
  earn_per    integer not null default 10000 check (earn_per >= 100),   -- cents of goods per point
  point_value integer not null default 100 check (point_value >= 1),    -- cents one point is worth
  max_percent integer not null default 50 check (max_percent between 1 and 100)
);
insert into public.points_settings default values;

-- Ledger: a customer's balance is the sum of their points ------------------

create table public.points_ledger (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.users (id) on delete cascade,
  order_id   uuid references public.orders (id) on delete set null,
  kind       text not null check (kind in ('earn', 'redeem', 'refund', 'adjust')),
  points     integer not null check (points <> 0),
  note       text check (note is null or length(note) <= 200),
  created_at timestamptz not null default now()
);

create index points_ledger_user_idx on public.points_ledger (user_id, created_at desc);

-- An order earns, redeems and is refunded at most once each.
create unique index points_ledger_once_per_order
  on public.points_ledger (order_id, kind)
  where kind in ('earn', 'redeem', 'refund') and order_id is not null;

alter table public.points_settings enable row level security;
alter table public.points_ledger enable row level security;
revoke all on table public.points_settings from anon, authenticated;
revoke all on table public.points_ledger from anon, authenticated;

-- Orders: what points did to this order ---------------------------------------
-- points_to_earn is worked out by the server when the order is placed, with the
-- settings of that moment; it becomes an 'earn' ledger row at delivery.
-- orders.total already includes the points discount.

alter table public.orders
  add column points_used     integer not null default 0 check (points_used >= 0),
  add column points_discount integer not null default 0 check (points_discount >= 0),
  add column points_to_earn  integer not null default 0 check (points_to_earn >= 0);

-- place_order: the advance version plus points ----------------------------------

drop function public.place_order(uuid, uuid, jsonb, jsonb, jsonb, integer);

create function public.place_order(
  p_user_id         uuid,
  p_key             uuid,
  p_customer        jsonb,
  p_totals          jsonb,
  p_items           jsonb,
  p_advance         integer,
  p_points          integer,
  p_points_discount integer,
  p_points_to_earn  integer
) returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing text;
  v_item     jsonb;
  v_stock    jsonb;
  v_size     text;
  v_left     integer;
  v_order_id uuid;
  v_number   text;
  v_balance  integer;
  v_total    integer := (p_totals ->> 'total')::integer;
begin
  if p_advance < 0 or p_advance > v_total then
    raise exception 'bad_advance';
  end if;
  if p_points < 0 or p_points_discount < 0 or p_points_to_earn < 0
     or (p_points = 0 and p_points_discount <> 0)
     or (p_points > 0 and p_points_discount = 0) then
    raise exception 'bad_points';
  end if;
  -- The total must be exactly what the parts add up to (defence in depth: the
  -- server computes it, this makes a wrong number impossible to store).
  if v_total <> (p_totals ->> 'subtotal')::integer
                - (p_totals ->> 'discount')::integer
                - p_points_discount
                + (p_totals ->> 'shipping')::integer then
    raise exception 'bad_points';
  end if;

  select order_number into v_existing
  from orders where idempotency_key = p_key and user_id = p_user_id;
  if found then
    return v_existing;
  end if;

  -- Serialise this customer's orders so the pending cap and their points can't
  -- be raced past.
  perform pg_advisory_xact_lock(hashtext(p_user_id::text));

  -- A concurrent call with the same key may have finished while we waited.
  select order_number into v_existing
  from orders where idempotency_key = p_key and user_id = p_user_id;
  if found then
    return v_existing;
  end if;

  if (select count(*) from orders where user_id = p_user_id and status = 'pending') >= 3 then
    raise exception 'too_many_pending';
  end if;

  if p_points > 0 then
    perform 1 from users where id = p_user_id for update;
    select coalesce(sum(points), 0) into v_balance from points_ledger where user_id = p_user_id;
    if p_points > v_balance then
      raise exception 'not_enough_points';
    end if;
  end if;

  begin
    perform 1
    from products
    where id in (select i ->> 'product_id' from jsonb_array_elements(p_items) i)
    order by id
    for update;

    select order_number into v_existing
    from orders where idempotency_key = p_key and user_id = p_user_id;
    if found then
      return v_existing;
    end if;

    for v_item in select * from jsonb_array_elements(p_items) loop
      select stock into v_stock from products where id = v_item ->> 'product_id';
      if not found then
        raise exception '%', format('unknown_product:%s', v_item ->> 'product_id');
      end if;
      v_size := v_item ->> 'size';
      if v_stock is not null and jsonb_typeof(v_stock -> v_size) = 'number' then
        v_left := (v_stock ->> v_size)::integer;
        if (v_item ->> 'quantity')::integer > v_left then
          raise exception '%', format('out_of_stock:%s:%s:%s', v_item ->> 'product_id', v_size, v_left);
        end if;
        update products
        set stock = jsonb_set(stock, array[v_size], to_jsonb(v_left - (v_item ->> 'quantity')::integer))
        where id = v_item ->> 'product_id';
      end if;
    end loop;

    v_number := 'NB-' || nextval('orders_number_seq');
    insert into orders (
      order_number, user_id, idempotency_key, customer_name, phone, address, city, note,
      subtotal, discount, shipping, total, advance_amount, payment_method, payment_status,
      points_used, points_discount, points_to_earn
    ) values (
      v_number, p_user_id, p_key,
      p_customer ->> 'name', p_customer ->> 'phone', p_customer ->> 'address', p_customer ->> 'city',
      nullif(p_customer ->> 'note', ''),
      (p_totals ->> 'subtotal')::integer, (p_totals ->> 'discount')::integer,
      (p_totals ->> 'shipping')::integer, v_total,
      p_advance,
      case when p_advance > 0 then 'cod_advance' else 'cod' end,
      case when p_advance > 0 then 'advance_due' else 'unpaid' end,
      p_points, p_points_discount, p_points_to_earn
    ) returning id into v_order_id;

    insert into order_items (order_id, product_id, product_name, size, quantity, unit_price, compare_at)
    select v_order_id, i ->> 'product_id', i ->> 'product_name', i ->> 'size',
           (i ->> 'quantity')::integer, (i ->> 'unit_price')::integer,
           nullif(i ->> 'compare_at', '')::integer
    from jsonb_array_elements(p_items) i;

    if p_points > 0 then
      insert into points_ledger (user_id, order_id, kind, points)
      values (p_user_id, v_order_id, 'redeem', -p_points);
    end if;
  exception when unique_violation then
    select order_number into v_existing
    from orders where idempotency_key = p_key and user_id = p_user_id;
    if found then
      return v_existing;
    end if;
    raise;
  end;

  return v_number;
end;
$$;

-- set_order_status: as before, plus points earned on delivery and returned on
-- cancel -----------------------------------------------------------------------

create or replace function public.set_order_status(
  p_order_id uuid,
  p_to       text,
  p_user_id  uuid default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order orders%rowtype;
  v_item  record;
begin
  select * into v_order from orders where id = p_order_id for update;
  if not found then
    raise exception 'order_not_found';
  end if;

  if p_user_id is not null then
    if v_order.user_id <> p_user_id then
      raise exception 'order_not_found';
    end if;
    if p_to <> 'cancelled'
       or v_order.status <> 'pending'
       or v_order.payment_status in ('slip_uploaded', 'advance_paid') then
      raise exception 'bad_transition';
    end if;
  elsif not (
    (v_order.status = 'pending'   and p_to in ('confirmed', 'cancelled')) or
    (v_order.status = 'confirmed' and p_to in ('shipped', 'cancelled')) or
    (v_order.status = 'shipped'   and p_to in ('delivered', 'cancelled'))
  ) then
    raise exception 'bad_transition';
  end if;

  if p_to = 'confirmed' and v_order.advance_amount > 0 and v_order.payment_status <> 'advance_paid' then
    raise exception 'advance_unpaid';
  end if;

  update orders
  set status       = p_to,
      confirmed_at = case when p_to = 'confirmed' then now() else confirmed_at end,
      shipped_at   = case when p_to = 'shipped'   then now() else shipped_at end,
      delivered_at = case when p_to = 'delivered' then now() else delivered_at end,
      cancelled_at = case when p_to = 'cancelled' then now() else cancelled_at end
  where id = p_order_id;

  -- Points: earned once the parcel is delivered (final), given back on any
  -- cancel. The unique index makes a repeat harmless.
  if p_to = 'delivered' and v_order.points_to_earn > 0 then
    insert into points_ledger (user_id, order_id, kind, points)
    values (v_order.user_id, p_order_id, 'earn', v_order.points_to_earn)
    on conflict do nothing;
  end if;
  if p_to = 'cancelled' and v_order.points_used > 0 then
    insert into points_ledger (user_id, order_id, kind, points)
    values (v_order.user_id, p_order_id, 'refund', v_order.points_used)
    on conflict do nothing;
  end if;

  -- v_order still holds the status from before the update. A shipped parcel is
  -- with the courier, so its stock is not restored automatically.
  if p_to = 'cancelled' and v_order.status in ('pending', 'confirmed') then
    for v_item in
      select product_id, size, quantity
      from order_items
      where order_id = p_order_id and product_id is not null
      order by product_id
    loop
      update products
      set stock = jsonb_set(stock, array[v_item.size], to_jsonb((stock ->> v_item.size)::integer + v_item.quantity))
      where id = v_item.product_id and jsonb_typeof(stock -> v_item.size) = 'number';
    end loop;
  end if;
end;
$$;

-- adjust_points: the admin adds or removes points by hand ------------------------
-- Returns the new balance. Raises bad_points, user_not_found or would_go_negative.

create function public.adjust_points(
  p_user_id uuid,
  p_points  integer,
  p_note    text
) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance integer;
begin
  if p_points = 0 then
    raise exception 'bad_points';
  end if;
  perform 1 from users where id = p_user_id for update;
  if not found then
    raise exception 'user_not_found';
  end if;
  select coalesce(sum(points), 0) into v_balance from points_ledger where user_id = p_user_id;
  if v_balance + p_points < 0 then
    raise exception 'would_go_negative';
  end if;
  insert into points_ledger (user_id, kind, points, note)
  values (p_user_id, 'adjust', p_points, left(p_note, 200));
  return v_balance + p_points;
end;
$$;

revoke all on function public.place_order(uuid, uuid, jsonb, jsonb, jsonb, integer, integer, integer, integer) from public, anon, authenticated;
grant execute on function public.place_order(uuid, uuid, jsonb, jsonb, jsonb, integer, integer, integer, integer) to service_role;
revoke all on function public.set_order_status(uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.set_order_status(uuid, text, uuid) to service_role;
revoke all on function public.adjust_points(uuid, integer, text) from public, anon, authenticated;
grant execute on function public.adjust_points(uuid, integer, text) to service_role;
