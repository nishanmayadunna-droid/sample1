-- Hardening for the orders functions (follow-up to 20261104100000). Run by the
-- owner in the SQL editor. The shop code works with or without it, so it can be
-- applied before or after the deploy; it changes three rules:
--
-- 1. A customer may have at most 3 pending orders. COD has no payment, so one
--    account could otherwise reserve the whole stock with made-up orders.
-- 2. Cancelling a SHIPPED order no longer puts its units back on the shelf by
--    itself: the parcel is still with the courier, so the admin adjusts stock
--    once it is really back. Pending and confirmed cancels still restore it.
-- 3. A non-numeric stock value (a hand edit) is treated as "not tracked"
--    instead of wiping the product's whole stock map.

revoke all on sequence public.orders_number_seq from anon, authenticated;

create or replace function public.place_order(
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

  -- Serialise this customer's orders so the pending cap can't be raced past.
  perform pg_advisory_xact_lock(hashtext(p_user_id::text));
  if (select count(*) from orders where user_id = p_user_id and status = 'pending') >= 3 then
    raise exception 'too_many_pending';
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

revoke all on function public.place_order(uuid, uuid, jsonb, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.place_order(uuid, uuid, jsonb, jsonb, jsonb) to service_role;
revoke all on function public.set_order_status(uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.set_order_status(uuid, text, uuid) to service_role;
