-- PayHere review fixes (Part 22). Run by the owner in the SQL editor. It only
-- REPLACES two functions and widens one check constraint, so it is safe to run
-- before or after the matching code is deployed.
--
-- 1. An order whose bank slip is under review ('slip_uploaded') can no longer be
--    paid online: the customer's bank transfer would be lost (advance_amount was
--    set to 0). Such a payment is kept on the attempt and listed under "Needs
--    attention" instead. Only 'unpaid' and 'advance_due' orders take an online
--    payment.
-- 2. A shipped order cannot take an online payment either (the waybill already
--    says "collect on delivery"). Only 'pending' and 'confirmed' orders can.
-- 3. A charged-back attempt never goes back to 'paid' (a replayed notification
--    cannot hide a chargeback), and a chargeback puts the order back to cash on
--    delivery so it cannot ship for free.
-- 4. A notification whose amount differs from the attempt is now recorded as
--    status 'mismatch' (shown under Needs attention) instead of leaving the
--    attempt 'pending'.

do $$
declare
  c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.online_payments'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) like '%status%'
  loop
    execute format('alter table public.online_payments drop constraint %I', c.conname);
  end loop;
end
$$;

alter table public.online_payments add constraint online_payments_status_check
  check (status in ('pending', 'paid', 'failed', 'cancelled', 'chargedback', 'overpaid', 'mismatch'));

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

  -- paid / overpaid / chargedback are final: a repeated or replayed notification changes nothing.
  if v_pay.status in ('paid', 'overpaid', 'chargedback') then
    return 'already';
  end if;

  if p_amount <> v_pay.amount then
    update online_payments
    set status = 'mismatch', payhere_payment_id = p_payment_id, method = left(p_method, 30), paid_at = now()
    where id = v_pay.id;
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

  if v_order.status in ('pending', 'confirmed')
     and v_order.payment_status in ('unpaid', 'advance_due') then
    update orders
    set payment_method     = 'online',
        payment_status     = 'online_paid',
        advance_amount     = 0,
        online_discount    = v_pay.discount,
        online_paid_amount = v_pay.amount,
        online_paid_at     = now(),
        online_gift        = v_pay.gift
    where id = v_order.id;

    update payment_slips set status = 'waived', reviewed_at = now()
    where order_id = v_order.id and status = 'pending';
    return 'paid';
  end if;

  -- Money arrived that the order cannot take (slip under review, advance approved,
  -- shipped, delivered, cancelled): the attempt stays 'paid' and the admin refunds it.
  return 'paid_no_order';
end;
$$;

create or replace function public.set_online_payment_status(p_ref text, p_status text) returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id uuid;
  v_pay      online_payments%rowtype;
begin
  if p_status not in ('failed', 'cancelled', 'chargedback') then
    return 'ignored';
  end if;

  select order_id into v_order_id from online_payments where ref = p_ref;
  if not found then
    return 'unknown_ref';
  end if;

  -- Same lock order as confirm_online_payment: the order, then the attempt.
  perform 1 from orders where id = v_order_id for update;
  select * into v_pay from online_payments where ref = p_ref for update;

  if (p_status in ('failed', 'cancelled') and v_pay.status = 'pending')
     or (p_status = 'chargedback' and v_pay.status in ('paid', 'overpaid')) then
    update online_payments set status = p_status where id = v_pay.id;

    -- A charged-back payment is no payment: the order goes back to cash on delivery
    -- (the courier collects the full total) instead of shipping for free.
    if p_status = 'chargedback' and v_pay.status = 'paid' then
      update orders
      set payment_method = 'cod', payment_status = 'unpaid'
      where id = v_order_id and payment_status = 'online_paid';
    end if;
    return 'ok';
  end if;
  return 'ignored';
end;
$$;

revoke all on function public.confirm_online_payment(text, text, integer, text) from public, anon, authenticated;
grant execute on function public.confirm_online_payment(text, text, integer, text) to service_role;
revoke all on function public.set_online_payment_status(text, text) from public, anon, authenticated;
grant execute on function public.set_online_payment_status(text, text) to service_role;
