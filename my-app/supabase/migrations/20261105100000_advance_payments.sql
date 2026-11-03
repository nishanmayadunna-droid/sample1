-- Advance payment by bank transfer, payment slips and trusted customers. Run by
-- the owner in the SQL editor, BEFORE the code that uses these is deployed.
--
-- Everything here is private: RLS is on with no policies and no grants for the
-- public roles, the storage buckets are private, and the payment-state changes
-- happen only inside the service_role-only functions below, each in one
-- transaction. The shop starts with the advance switched OFF, so applying this
-- changes nothing for customers until the admin turns it on.

-- Settings (one row) -------------------------------------------------------

create table public.payment_settings (
  id                  boolean primary key default true check (id),
  advance_mode        text not null default 'off' check (advance_mode in ('off', 'fixed', 'percent')),
  advance_fixed       integer not null default 50000 check (advance_fixed >= 0),
  advance_percent     integer not null default 10 check (advance_percent between 1 and 100),
  advance_min         integer not null default 50000 check (advance_min >= 0),
  advance_max         integer not null default 500000 check (advance_max >= 0),
  bank_name           text not null default '' check (length(bank_name) <= 120),
  bank_account_name   text not null default '' check (length(bank_account_name) <= 120),
  bank_account_number text not null default '' check (length(bank_account_number) <= 120),
  bank_branch         text not null default '' check (length(bank_branch) <= 120),
  bank_note           text not null default '' check (length(bank_note) <= 500)
);
insert into public.payment_settings default values;

-- Bank QR images (at most four) ---------------------------------------------

create table public.bank_qr_codes (
  id         uuid primary key default gen_random_uuid(),
  path       text not null unique check (length(path) <= 200),
  label      text not null default '' check (length(label) <= 40),
  sort_order integer not null unique check (sort_order between 0 and 3)
);

-- Slips ---------------------------------------------------------------------

create table public.payment_slips (
  id            uuid primary key default gen_random_uuid(),
  order_id      uuid not null references public.orders (id) on delete cascade,
  path          text not null unique check (length(path) <= 200),
  status        text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reject_reason text check (reject_reason is null or length(reject_reason) <= 200),
  created_at    timestamptz not null default now(),
  reviewed_at   timestamptz
);
create index payment_slips_order_idx on public.payment_slips (order_id);

alter table public.payment_settings enable row level security;
alter table public.bank_qr_codes enable row level security;
alter table public.payment_slips enable row level security;
revoke all on table public.payment_settings from anon, authenticated;
revoke all on table public.bank_qr_codes from anon, authenticated;
revoke all on table public.payment_slips from anon, authenticated;

-- Orders and users ------------------------------------------------------------

alter table public.orders
  add column advance_amount integer not null default 0 check (advance_amount >= 0);
alter table public.orders drop constraint orders_payment_method_check;
alter table public.orders add constraint orders_payment_method_check
  check (payment_method in ('cod', 'cod_advance'));
alter table public.orders drop constraint orders_payment_status_check;
alter table public.orders add constraint orders_payment_status_check
  check (payment_status in ('unpaid', 'advance_due', 'slip_uploaded', 'advance_paid'));

-- A trusted customer orders with plain COD. Set when an advance is approved, or
-- by the admin by hand.
alter table public.users
  add column cod_trusted boolean not null default false,
  add column cod_trusted_source text check (cod_trusted_source in ('advance', 'admin'));

-- Private storage buckets ------------------------------------------------------
-- No storage policies for anon/authenticated: files are reached only through
-- signed URLs the server hands out.

insert into storage.buckets (id, name, public)
values ('payment-qr', 'payment-qr', false), ('payment-slips', 'payment-slips', false)
on conflict (id) do nothing;

-- place_order: the Part 5 function plus the advance --------------------------------

drop function public.place_order(uuid, uuid, jsonb, jsonb, jsonb);

create function public.place_order(
  p_user_id  uuid,
  p_key      uuid,
  p_customer jsonb,
  p_totals   jsonb,
  p_items    jsonb,
  p_advance  integer
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
  v_total    integer := (p_totals ->> 'total')::integer;
begin
  if p_advance < 0 or p_advance > v_total then
    raise exception 'bad_advance';
  end if;

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
      subtotal, discount, shipping, total, advance_amount, payment_method, payment_status
    ) values (
      v_number, p_user_id, p_key,
      p_customer ->> 'name', p_customer ->> 'phone', p_customer ->> 'address', p_customer ->> 'city',
      nullif(p_customer ->> 'note', ''),
      (p_totals ->> 'subtotal')::integer, (p_totals ->> 'discount')::integer,
      (p_totals ->> 'shipping')::integer, v_total,
      p_advance,
      case when p_advance > 0 then 'cod_advance' else 'cod' end,
      case when p_advance > 0 then 'advance_due' else 'unpaid' end
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

-- set_order_status: as before, but an advance order can't be confirmed until its
-- advance is approved ------------------------------------------------------------

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

-- add_payment_slip: the customer's uploaded file becomes a pending slip -----------
-- Raises order_not_found, bad_state or too_many_slips.

create function public.add_payment_slip(
  p_order_id uuid,
  p_user_id  uuid,
  p_path     text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order orders%rowtype;
  v_id    uuid;
begin
  select * into v_order from orders where id = p_order_id for update;
  if not found or v_order.user_id <> p_user_id then
    raise exception 'order_not_found';
  end if;
  if v_order.status = 'cancelled'
     or v_order.advance_amount <= 0
     or v_order.payment_status not in ('advance_due', 'slip_uploaded') then
    raise exception 'bad_state';
  end if;
  if (select count(*) from payment_slips where order_id = p_order_id) >= 3 then
    raise exception 'too_many_slips';
  end if;

  insert into payment_slips (order_id, path) values (p_order_id, p_path) returning id into v_id;
  update orders set payment_status = 'slip_uploaded' where id = p_order_id;
  return v_id;
end;
$$;

-- review_payment_slip: the admin approves or rejects a pending slip -----------------
-- Approving marks the advance paid and the customer trusted. Raises
-- slip_not_found, slip_not_pending or bad_state.

create function public.review_payment_slip(
  p_slip_id uuid,
  p_approve boolean,
  p_reason  text
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id uuid;
  v_order    orders%rowtype;
  v_status   text;
begin
  select order_id into v_order_id from payment_slips where id = p_slip_id;
  if not found then
    raise exception 'slip_not_found';
  end if;

  -- Lock the order first, so two admins reviewing slips of one order take turns.
  select * into v_order from orders where id = v_order_id for update;
  select status into v_status from payment_slips where id = p_slip_id for update;
  if v_status <> 'pending' then
    raise exception 'slip_not_pending';
  end if;
  if v_order.status = 'cancelled' then
    raise exception 'bad_state';
  end if;

  if p_approve then
    update payment_slips set status = 'approved', reviewed_at = now() where id = p_slip_id;
    update orders set payment_status = 'advance_paid' where id = v_order_id;
    update users
    set cod_trusted = true,
        cod_trusted_source = coalesce(cod_trusted_source, 'advance')
    where id = v_order.user_id;
  else
    update payment_slips
    set status = 'rejected', reject_reason = left(coalesce(p_reason, ''), 200), reviewed_at = now()
    where id = p_slip_id;
    if not exists (select 1 from payment_slips where order_id = v_order_id and status = 'pending') then
      update orders set payment_status = 'advance_due'
      where id = v_order_id and payment_status = 'slip_uploaded';
    end if;
  end if;
end;
$$;

revoke all on function public.place_order(uuid, uuid, jsonb, jsonb, jsonb, integer) from public, anon, authenticated;
grant execute on function public.place_order(uuid, uuid, jsonb, jsonb, jsonb, integer) to service_role;
revoke all on function public.set_order_status(uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.set_order_status(uuid, text, uuid) to service_role;
revoke all on function public.add_payment_slip(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.add_payment_slip(uuid, uuid, text) to service_role;
revoke all on function public.review_payment_slip(uuid, boolean, text) from public, anon, authenticated;
grant execute on function public.review_payment_slip(uuid, boolean, text) to service_role;
