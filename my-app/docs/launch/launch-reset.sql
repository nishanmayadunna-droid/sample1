-- Northbound launch reset: removes the QA / test data so the shop starts clean.
-- Run ONCE, by the owner, in the Supabase SQL editor, shortly before launch.
--
-- Keeps: every user account (including the admin), products and photos,
-- categories, promotions, promises, settings, bank details, QR images.
-- Removes: all orders (and their items and payment slips through cascade), the
-- points ledger, every stored sign-in code, saved carts and reviews, then
-- restarts order numbers at NB-10001.
--
-- Safety: it refuses to run when the shop already has more than 30 orders,
-- so it can't wipe real customers by accident after launch.
--
-- After it: delete the test slip files by hand in the Dashboard
-- (Storage -> payment-slips -> select all -> Delete), because deleting rows
-- here does not remove the files themselves.

begin;

do $$
declare
  v_orders integer;
begin
  select count(*) into v_orders from public.orders;
  if v_orders > 30 then
    raise exception 'launch-reset refused: % orders exist, this script is for test data only', v_orders;
  end if;
end $$;

delete from public.points_ledger;
delete from public.orders;            -- order_items and payment_slips go with them
delete from public.phone_otps;
delete from public.reviews;
delete from public.carts;

-- The next order is NB-10001 again.
select setval('public.orders_number_seq', 10001, false);

-- Check: every count below should be 0, and the user count should be unchanged.
select
  (select count(*) from public.orders)        as orders,
  (select count(*) from public.order_items)   as order_items,
  (select count(*) from public.payment_slips) as payment_slips,
  (select count(*) from public.points_ledger) as points_ledger,
  (select count(*) from public.phone_otps)    as phone_otps,
  (select count(*) from public.reviews)       as reviews,
  (select count(*) from public.carts)         as carts,
  (select count(*) from public.users)         as users_kept;

commit;
