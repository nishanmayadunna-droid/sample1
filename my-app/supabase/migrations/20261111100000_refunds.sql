-- Refunds (Part 16): record the return of an approved advance on a cancelled
-- order. Run by the owner in the SQL editor BEFORE the code that uses it is
-- deployed. Additive: nothing existing is replaced.
--
-- The shop sends the money itself; this only records it. Rows are an audit
-- trail and are never updated or deleted by the app.

create table public.order_refunds (
  id              uuid primary key default gen_random_uuid(),
  order_id        uuid not null references public.orders (id) on delete restrict,
  amount          integer not null check (amount > 0),
  method          text not null check (method in ('bank_transfer', 'cash', 'other')),
  reference       text check (char_length(reference) <= 100),
  note            text check (char_length(note) <= 200),
  idempotency_key text not null unique,
  created_at      timestamptz not null default now()
);

create index order_refunds_order_id_idx on public.order_refunds (order_id);

-- Private: RLS on, no policies, no grants. Everything goes through the secret key.
alter table public.order_refunds enable row level security;
revoke all on public.order_refunds from public, anon, authenticated;

-- record_refund: one refund of (part of) the advance on a cancelled order.
-- Under the order row lock so two admins can never refund more than was paid.
-- The same key returns the earlier row instead of recording twice.
-- Raises order_not_found, bad_state or over_refund.

create function public.record_refund(
  p_order_id  uuid,
  p_amount    integer,
  p_method    text,
  p_reference text,
  p_note      text,
  p_key       text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order    orders%rowtype;
  v_existing uuid;
  v_refunded integer;
  v_id       uuid;
begin
  select * into v_order from orders where id = p_order_id for update;
  if not found then
    raise exception 'order_not_found';
  end if;

  select id into v_existing
  from order_refunds
  where idempotency_key = p_key and order_id = p_order_id;
  if found then
    return v_existing;
  end if;

  if v_order.status <> 'cancelled'
     or v_order.payment_status <> 'advance_paid'
     or v_order.advance_amount <= 0 then
    raise exception 'bad_state';
  end if;

  select coalesce(sum(amount), 0) into v_refunded from order_refunds where order_id = p_order_id;
  if p_amount <= 0 or v_refunded + p_amount > v_order.advance_amount then
    raise exception 'over_refund';
  end if;

  insert into order_refunds (order_id, amount, method, reference, note, idempotency_key)
  values (p_order_id, p_amount, p_method, nullif(p_reference, ''), nullif(p_note, ''), p_key)
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.record_refund(uuid, integer, text, text, text, text) from public, anon, authenticated;
grant execute on function public.record_refund(uuid, integer, text, text, text, text) to service_role;
