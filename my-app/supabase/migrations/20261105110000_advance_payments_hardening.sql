-- Hardening for advance payments (follow-up to 20261105100000). Run by the owner
-- in the SQL editor. The shop code works with or without it, so it can be applied
-- before or after the deploy.
--
-- 1. The storage buckets enforce the file rules themselves (5 MB; images and PDF
--    for slips, images for QR). Until now only the browser checked them.
-- 2. A customer can no longer cancel an order whose slip is uploaded or whose
--    advance is paid (the shop cancels and refunds by hand), so a paid advance
--    can't be lost track of. The shop's own pages already hide the button.

update storage.buckets
set file_size_limit = 5242880,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
where id = 'payment-slips';

update storage.buckets
set file_size_limit = 5242880,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
where id = 'payment-qr';

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

revoke all on function public.set_order_status(uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.set_order_status(uuid, text, uuid) to service_role;
