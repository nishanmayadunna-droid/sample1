-- Orders (cash on delivery). Run by the owner in the SQL editor, BEFORE the code
-- that uses these tables is deployed.
--
-- Everything is read and written only by the server with the secret key: RLS is
-- on and there are no policies or grants for the public roles. Stock is changed
-- only inside the two functions below, in one transaction with the order, so two
-- shoppers can never both get the last unit and a cancel puts units back once.

create sequence public.orders_number_seq start 10001;

create table public.orders (
  id              uuid primary key default gen_random_uuid(),
  order_number    text not null unique,                       -- NB-10001
  user_id         uuid not null references public.users (id),
  idempotency_key uuid not null unique,                       -- one checkout attempt = one order
  status          text not null default 'pending'
                  check (status in ('pending', 'confirmed', 'shipped', 'delivered', 'cancelled')),
  payment_method  text not null default 'cod' check (payment_method in ('cod')),
  payment_status  text not null default 'unpaid' check (payment_status in ('unpaid')),
  customer_name   text not null check (length(customer_name) between 2 and 80),
  phone           text not null check (phone ~ '^07[0-9]{8}$'),
  address         text not null check (length(address) between 5 and 200),
  city            text not null check (length(city) between 2 and 60),
  note            text check (note is null or length(note) <= 500),
  subtotal        integer not null check (subtotal >= 0),
  discount        integer not null check (discount >= 0),
  shipping        integer not null check (shipping >= 0),
  total           integer not null check (total >= 0),
  created_at      timestamptz not null default now(),
  confirmed_at    timestamptz,
  shipped_at      timestamptz,
  delivered_at    timestamptz,
  cancelled_at    timestamptz
);

create index orders_user_created_idx on public.orders (user_id, created_at desc);
create index orders_status_created_idx on public.orders (status, created_at desc);

create table public.order_items (
  id           uuid primary key default gen_random_uuid(),
  order_id     uuid not null references public.orders (id) on delete cascade,
  -- Null once the product is deleted; the name and price below stay as history.
  product_id   text references public.products (id) on delete set null,
  product_name text not null,
  size         text not null,
  quantity     integer not null check (quantity between 1 and 99),
  unit_price   integer not null check (unit_price >= 0),
  compare_at   integer check (compare_at is null or compare_at >= 0)
);

create index order_items_order_idx on public.order_items (order_id);

alter table public.orders enable row level security;
alter table public.order_items enable row level security;
revoke all on table public.orders from anon, authenticated;
revoke all on table public.order_items from anon, authenticated;

-- Places an order. Returns its number. Raises
--   out_of_stock:<product_id>:<size>:<left>   when a tracked size has too few units
--   unknown_product:<product_id>              when a product no longer exists
-- A repeat call with the same key returns the same order and changes nothing.
create function public.place_order(
  p_user_id  uuid,
  p_key      uuid,
  p_customer jsonb,
  p_totals   jsonb,
  p_items    jsonb
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
begin
  select order_number into v_existing
  from orders where idempotency_key = p_key and user_id = p_user_id;
  if found then
    return v_existing;
  end if;

  begin
    -- Lock every involved product row (in id order, so two orders can't deadlock).
    perform 1
    from products
    where id in (select i ->> 'product_id' from jsonb_array_elements(p_items) i)
    order by id
    for update;

    -- A concurrent call with the same key may have finished while we waited for
    -- the locks; return its order instead of taking the stock a second time.
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
      if v_stock is not null and v_stock ? v_size then
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
      subtotal, discount, shipping, total
    ) values (
      v_number, p_user_id, p_key,
      p_customer ->> 'name', p_customer ->> 'phone', p_customer ->> 'address', p_customer ->> 'city',
      nullif(p_customer ->> 'note', ''),
      (p_totals ->> 'subtotal')::integer, (p_totals ->> 'discount')::integer,
      (p_totals ->> 'shipping')::integer, (p_totals ->> 'total')::integer
    ) returning id into v_order_id;

    insert into order_items (order_id, product_id, product_name, size, quantity, unit_price, compare_at)
    select v_order_id, i ->> 'product_id', i ->> 'product_name', i ->> 'size',
           (i ->> 'quantity')::integer, (i ->> 'unit_price')::integer,
           nullif(i ->> 'compare_at', '')::integer
    from jsonb_array_elements(p_items) i;
  exception when unique_violation then
    -- A concurrent call with the same key got there first (the block rolled back).
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

-- Moves an order to a new status. A customer call passes p_user_id and may only
-- cancel their own pending order; an admin call (no p_user_id) follows the full
-- flow. Cancelling gives each line's units back to tracked sizes. Raises
-- order_not_found or bad_transition.
create function public.set_order_status(
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
    if p_to <> 'cancelled' or v_order.status <> 'pending' then
      raise exception 'bad_transition';
    end if;
  elsif not (
    (v_order.status = 'pending'   and p_to in ('confirmed', 'cancelled')) or
    (v_order.status = 'confirmed' and p_to in ('shipped', 'cancelled')) or
    (v_order.status = 'shipped'   and p_to in ('delivered', 'cancelled'))
  ) then
    raise exception 'bad_transition';
  end if;

  update orders
  set status       = p_to,
      confirmed_at = case when p_to = 'confirmed' then now() else confirmed_at end,
      shipped_at   = case when p_to = 'shipped'   then now() else shipped_at end,
      delivered_at = case when p_to = 'delivered' then now() else delivered_at end,
      cancelled_at = case when p_to = 'cancelled' then now() else cancelled_at end
  where id = p_order_id;

  if p_to = 'cancelled' then
    -- Id order, like place_order, so a cancel and an order can't deadlock.
    for v_item in
      select product_id, size, quantity
      from order_items
      where order_id = p_order_id and product_id is not null
      order by product_id
    loop
      update products
      set stock = jsonb_set(stock, array[v_item.size], to_jsonb((stock ->> v_item.size)::integer + v_item.quantity))
      where id = v_item.product_id and stock is not null and stock ? v_item.size;
    end loop;
  end if;
end;
$$;

revoke all on function public.place_order(uuid, uuid, jsonb, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.place_order(uuid, uuid, jsonb, jsonb, jsonb) to service_role;
revoke all on function public.set_order_status(uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.set_order_status(uuid, text, uuid) to service_role;

-- Reviews from customers who received the product show a "Verified buyer" badge.
alter table public.reviews add column verified boolean not null default false;
grant select (verified) on table public.reviews to anon, authenticated;
