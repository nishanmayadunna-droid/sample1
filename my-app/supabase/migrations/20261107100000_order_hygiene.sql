-- Order hygiene: cancel advance orders whose advance never arrives, and let the
-- admin waive an advance. Run by the owner in the SQL editor, BEFORE the code
-- that reads the new columns is deployed. This migration is additive: it
-- replaces no existing function, so the shop keeps working before and after it.
--
-- Orders only change status through public.set_order_status; the functions here
-- call it, so stock and loyalty points come back exactly as for a manual cancel.

-- Settings ----------------------------------------------------------------------

-- Hours after which a pending order whose advance hasn't arrived is cancelled.
-- 0 turns it off.
alter table public.payment_settings
  add column advance_expiry_hours integer not null default 48
  check (advance_expiry_hours between 0 and 720);

-- Orders and slips ------------------------------------------------------------------

alter table public.orders
  add column cancel_reason text check (cancel_reason in ('advance_expired')),
  add column advance_waived_at timestamptz;

alter table public.payment_slips drop constraint payment_slips_status_check;
alter table public.payment_slips add constraint payment_slips_status_check
  check (status in ('pending', 'approved', 'rejected', 'waived'));

-- cancel_stale_advance_orders: run by pg_cron (see the next migration) and by the
-- admin's "Cancel stale now" button. Returns how many orders it cancelled.
--
-- Only a PENDING order that is still waiting for its advance (payment_status
-- 'advance_due', so no slip is waiting for review) qualifies. Its clock is the
-- later of the order time and the latest slip review, so a rejected slip gives
-- the customer a fresh window.

create function public.cancel_stale_advance_orders() returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hours integer;
  v_id    uuid;
  v_count integer := 0;
begin
  select advance_expiry_hours into v_hours from payment_settings limit 1;
  if v_hours is null or v_hours <= 0 then
    return 0;
  end if;

  for v_id in
    select o.id
    from orders o
    where o.status = 'pending'
      and o.payment_status = 'advance_due'
      and o.advance_amount > 0
      and greatest(
            o.created_at,
            coalesce((select max(s.reviewed_at) from payment_slips s where s.order_id = o.id), o.created_at)
          ) < now() - make_interval(hours => v_hours)
    order by o.created_at
  loop
    begin
      -- Lock the order and look again: a slip may have been uploaded (add_payment_slip
      -- takes the same lock) or an admin may have acted since the list was read.
      perform 1 from orders
      where id = v_id and status = 'pending' and payment_status = 'advance_due'
      for update;
      if found then
        perform set_order_status(v_id, 'cancelled');
        update orders set cancel_reason = 'advance_expired' where id = v_id;
        v_count := v_count + 1;
      end if;
    exception when others then
      -- One order failing (a race, anything) must not stop the rest. Its own
      -- changes are rolled back by this block; the next run tries it again.
      null;
    end;
  end loop;

  return v_count;
end;
$$;

-- waive_advance: the customer no longer has to pay an advance for this order
-- (for example someone the admin now trusts). The order becomes plain COD: the
-- total is unchanged, so the customer pays all of it on delivery. Stock, points
-- and trust are untouched. Raises order_not_found or bad_state.

create function public.waive_advance(p_order_id uuid) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order orders%rowtype;
begin
  select * into v_order from orders where id = p_order_id for update;
  if not found then
    raise exception 'order_not_found';
  end if;
  if v_order.status not in ('pending', 'confirmed')
     or v_order.advance_amount <= 0
     or v_order.payment_status not in ('advance_due', 'slip_uploaded') then
    raise exception 'bad_state';
  end if;

  update orders
  set advance_amount    = 0,
      payment_method    = 'cod',
      payment_status    = 'unpaid',
      advance_waived_at = now()
  where id = p_order_id;

  update payment_slips
  set status = 'waived', reviewed_at = now()
  where order_id = p_order_id and status = 'pending';
end;
$$;

revoke all on function public.cancel_stale_advance_orders() from public, anon, authenticated;
grant execute on function public.cancel_stale_advance_orders() to service_role;
revoke all on function public.waive_advance(uuid) from public, anon, authenticated;
grant execute on function public.waive_advance(uuid) to service_role;
