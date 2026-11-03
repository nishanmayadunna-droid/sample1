# Order hygiene: stale advance orders and waiving the advance (Part 8)

## Understanding

Advance orders (Part 6) take stock when placed but can wait forever for an advance that never comes, and the admin has no way to let a customer they now trust skip an advance they were already asked for. Said by the owner: orders that are not paid within a number of hours (set by the admin) are cancelled automatically (option A, with `pg_cron`); the admin can also waive an advance. Phone sign-in is Part 9 (not here). Assumptions: only `pending` orders with `payment_status = advance_due` are ever auto-cancelled; an order with a slip waiting for review is never auto-cancelled; a rejected slip restarts the clock; cancelling uses the existing `set_order_status` (stock and points come back); no email/SMS reminders yet; Sinhala/English via `<L>` for customer text, admin pages English; money in cents.

## Global constraints

- Next.js 16 / React 19; read `node_modules/next/dist/docs/` before Next code. Catalog pages stay static/ISR; the root layout must not call `auth()`; order and admin pages are dynamic.
- Server Actions return message **codes**; admin actions start with `await requireAdmin(...)`.
- Every `public` table has RLS. Migrations are additive, saved in `supabase/migrations/`, applied by the owner in the SQL editor BEFORE the code is deployed. Never apply them yourself. The scheduling migration is separate so the functions never depend on `pg_cron`.
- Orders only change status through `set_order_status`; the new functions call it, they never write `status` themselves.
- Pure rules are unit-tested in `lib/*.test.ts`.

## 1. Data (migration `20261107100000_order_hygiene.sql`)

- `payment_settings`: add `advance_expiry_hours integer not null default 48 check (advance_expiry_hours between 0 and 720)`; **0 means never auto-cancel**.
- `orders`: add `cancel_reason text check (cancel_reason in ('advance_expired'))` (null for every other cancel) and `advance_waived_at timestamptz`.
- `payment_slips`: widen the `status` check (drop `payment_slips_status_check`, re-add) to `('pending','approved','rejected','waived')`.
- `public.cancel_stale_advance_orders() returns integer` (`security definer`, `set search_path = public`, `service_role` only): when `advance_expiry_hours > 0`, selects `pending` orders with `payment_status = 'advance_due'` and `advance_amount > 0` whose last activity is older than the limit, where last activity = the later of `created_at` and the latest `reviewed_at` of its slips (a rejection restarts the clock); for each, in `created_at` order, calls `set_order_status(id, 'cancelled')` and sets `cancel_reason = 'advance_expired'`, inside its own `begin ... exception when others then continue end` block so a race or one bad order never stops the rest; returns how many were cancelled. Two runs at once cancel an order once (the second sees it cancelled and is skipped).
- `public.waive_advance(p_order_id uuid) returns void` (same attributes): locks the order; raises `order_not_found` or `bad_state` unless `status in ('pending','confirmed')`, `advance_amount > 0` and `payment_status in ('advance_due','slip_uploaded')`; then sets `advance_amount = 0`, `payment_method = 'cod'`, `payment_status = 'unpaid'`, `advance_waived_at = now()` and marks the order's `pending` slips `waived`. `total` is unchanged (the customer now pays all of it on delivery); stock, points and trust are untouched.
- Separate migration `20261107110000_schedule_stale_cancel.sql`: `create extension if not exists pg_cron;` and `select cron.schedule('cancel-stale-advance-orders', '*/30 * * * *', 'select public.cancel_stale_advance_orders()');`.

## 2. Pure rules

`lib/advance.ts`: `advanceDeadline(createdAt: string | Date, lastReviewedAt: string | Date | null, hours: number): Date | null` (null when `hours <= 0`; otherwise the later of the two dates plus `hours`); `isAdvanceStale(order: { status; paymentStatus; advanceAmount; createdAt }, lastReviewedAt, hours, now: Date): boolean` (true only for `pending` + `advance_due` + `advanceAmount > 0` with a deadline in the past); `parseAdvanceSettings` gains `expiryHours` (whole number 0–720; blank is an error); `PaymentSettings` gains `expiryHours`. `lib/orders.ts`: `cancelReasonLabel(reason)` (si/en).

## 3. Admin

- `/admin/payments`: a field "Cancel orders whose advance hasn't arrived after N hours (0 = never)", with a sentence saying only orders with no slip waiting for review are cancelled.
- `/admin/orders`: a filter "Awaiting advance" (`pending` + advance due or slip uploaded); each row shows its age and a "stale" mark when `isAdvanceStale` says so; a **Cancel stale now** button (`cancelStaleOrdersAction`, `await requireAdmin` first) calling `cancel_stale_advance_orders()` and reporting how many were cancelled.
- `/admin/orders/[number]`: a **Waive advance** button (`waiveAdvanceAction`, `await requireAdmin` first, confirm dialog "The customer will pay the whole total on delivery") when the order qualifies; a hint "This customer is trusted: consider waiving the advance" when the customer is trusted and the order is still waiting for its advance; the cancel reason and "advance waived" shown in the order header.

## 4. Customer

- Advance panel: "Please pay before <date and time, Asia/Colombo>" from `advanceDeadline` (only when expiry is on; real data, not a countdown).
- A cancelled order with `cancel_reason = 'advance_expired'` shows "Cancelled because the advance didn't arrive in time" (its stock and points are returned as for any cancel). A waived order shows "Advance waived: pay the whole amount on delivery" and the advance panel disappears.

## Testing

Vitest: `advanceDeadline` (off, plain, restart after a rejection, string and Date inputs), `isAdvanceStale` (off, not yet due, due, slip uploaded, confirmed, no advance), `parseAdvanceSettings` with `expiryHours` (0, 48, 720, 721, -1, 2.5, blank), `cancelReasonLabel`. Browser: waive an advance order (it can then be confirmed, the panel disappears, the customer sees the waived text); "Cancel stale now" with only fresh orders cancels nothing; the deadline shows and moves when the setting changes; the owner then runs one SQL line to age a test order, and the stale function (button) cancels it, restoring stock and points, and the customer page shows the reason. Test data cleaned afterwards; `npm run build` keeps `/` and `/products/[id]` static.

## Review focus

- An order with a slip waiting for review, a shipped, confirmed or delivered order, or an order with no advance is never auto-cancelled.
- The same order is never cancelled or refunded twice (cron and the button at once; two cron runs).
- Auto-cancel restores stock and returns used points exactly like a manual cancel; a failure on one order doesn't stop the rest.
- Waiving: only the right states; the total, stock, points, and trust are untouched; pending slips are closed; a waived order can be confirmed; waiving twice or after cancel is refused; non-admins cannot waive or run the cancel.
- Changing the expiry setting applies to existing orders sensibly; 0 turns it off.
- Without `pg_cron` the shop still works (the button is the backup).

## Out of scope

Phone sign-in (Part 9), payment gateway, email/SMS reminders and notifications, refunds, any change to how advances are approved.
