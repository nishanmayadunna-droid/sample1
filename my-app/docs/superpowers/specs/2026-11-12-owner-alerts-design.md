# Owner alerts (Part 17)

## Understanding

The owner finds out about new orders, payment slips, low stock and failed customer SMS only by opening the admin. This part texts the owner's own phone for those four events, using the existing Text.lk token and sender ID. Assumptions: English, plain ASCII messages (one or two SMS parts); default OFF; one owner number; no email (waits for Part 11); sending never blocks or fails the customer's action.

## Constraints

- Owner and customer pipelines stay separate: new private tables, the customer `order_notifications` code only gains one hook.
- Every `public` table has RLS; the migration is additive, saved in `supabase/migrations/`.
- `alertOwner` never throws and never logs message text, the owner's number or the token.
- Pure rules are unit-tested in `lib/owner-alerts.test.ts`.

## Data (`20261112100000_owner_alerts.sql`)

- `owner_alert_settings` (one row): `enabled` (default false), `phone` (`07XXXXXXXX`, required when enabled, DB check), a toggle per event, `low_stock_at` (1 to 50, default 3).
- `owner_alerts` log: `event`, `dedupe`, `body`, `segments`, `status` sent|failed|skipped, `unique (event, dedupe)`. Both tables RLS on, no grants.

## Behaviour

- Events and subjects (dedupe): `new_order` (order id), `new_slip` (order id + file path), `low_stock` (product + size + Colombo day, so at most once a size a day), `sms_failed` (the failed log row id).
- The log row is claimed before sending, so a repeat is a no-op. While the switch is off nothing is logged or sent.
- Cap: at most 40 sent/failed alerts per 24 hours; an unreadable count counts as over the cap.
- Low stock: after an order is placed, the ordered sizes are checked against `products.stock`; tracked sizes at or under the threshold alert (max 3 per order). Untracked sizes never alert.
- Hooks: `placeOrder` (new order, low stock), `attachPaymentSlip` (new slip), `notifyOrder` (customer SMS failed to send).
- Admin: an "Alerts to you" section on `/admin/notifications` (switch, number, threshold, event toggles, last 50 alerts); the action starts with `requireAdmin` and refuses the switch without the server token.

## Out of scope

Email alerts, more than one recipient, reply handling, delivery receipts.
