-- OPTIONAL: run points expiry every day at 02:00 Asia/Colombo (20:30 UTC).
-- The shop works without this: the admin's "Expire now" button does the same.
-- Needs pg_cron (already enabled if you ran 20261107110000_schedule_stale_cancel.sql).

create extension if not exists pg_cron;

select cron.schedule('expire-points', '30 20 * * *', 'select public.expire_points()');
