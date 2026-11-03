-- OPTIONAL: run the stale-advance cancel on a schedule. Run by the owner in the
-- SQL editor AFTER 20261107100000_order_hygiene.sql, and only if you want orders
-- cancelled automatically. The shop works without it: the admin's "Cancel stale
-- now" button runs the same function by hand.
--
-- Every 30 minutes. The function does nothing while the admin's setting is 0.

create extension if not exists pg_cron;

select cron.schedule(
  'cancel-stale-advance-orders',
  '*/30 * * * *',
  'select public.cancel_stale_advance_orders()'
);
