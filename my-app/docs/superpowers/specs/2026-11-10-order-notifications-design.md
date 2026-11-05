# Part 13: Order notifications (SMS) — design

## Goal
Tell the customer by SMS (Text.lk) at the main points of an order's life. Single-owner store, COD + optional advance. Email is out of scope until Part 11 (domain); a `channel` column leaves room for it. No SMS to the owner.

## Understanding (confirmed with the owner)
- Customer events: placed, advance due, slip approved, slip rejected, shipped (+tracking), delivered, cancelled.
- Best-effort: a failed or skipped SMS never blocks or fails an order action.
- Budget is small (Rs 100 top-up), so messages are short and the feature ships **OFF**.
- Accepted limitation: the `pg_cron` auto-cancel of stale advance orders runs inside the database and sends no SMS. The admin's "Cancel stale now" button does.

## Design
**Hook:** after the SQL function/data-layer call succeeded, the server action calls `notifyOrder(order, event, dedupe?)` in `lib/notifications-data.ts` (`server-only`). Hooks: `placeOrder` (placed; plus advance_due folded into the same message for advance orders), `changeOrderStatus` (confirmed is silent; shipped, delivered, cancelled), the shipped SMS is sent once, on the status change to shipped, using the shipment saved on the order at that moment (saving or editing a shipment later sends nothing), slip review actions (approved/rejected, dedupe = slip id), `cancelStaleOrders` (cancelled for the orders it cancelled).

**Once only:** `public.order_notifications` (`id`, `order_id` → orders on delete cascade, `channel` 'sms', `event`, `dedupe` text default '', `phone`, `body`, `status` sent|failed|skipped, `created_at`), `unique(order_id, channel, event, dedupe)`, RLS on, no policies, no grants. `notifyOrder` inserts the row first (conflict → return), then sends and updates the status. A failed row can be retried by the admin (Resend) which re-sends and updates the same row.

**Settings:** `public.notification_settings` (one row, private): `enabled` default false, one boolean per event default true. Sending requires `enabled`, the event toggle, `smsTokenSet()` and a valid phone; otherwise the row is stored as `skipped`. Not tied to the OTP daily cap.

**Text:** `lib/notification-text.ts` (pure): `buildMessage(event, data, lang)` in the store default language (`store_settings.default_lang`), Sinhala or English, ≤ 2 SMS segments (70 Unicode / 160 GSM chars per segment; `segmentCount(text)` exported). Includes the order number; shipped adds courier, tracking number and link; advance_due adds amount and the "pay before" date when expiry is on; delivered adds points earned when > 0; cancelled adds a short reason when the system cancelled (`advance_expired`). Sender id and token come from the existing `sms_settings`/env.

**Pure rules (tested):** `buildMessage` per event and language, `segmentCount`, `shouldSend(settings, event, tokenSet, phone)` → send | skip, dedupe key per event.

**Admin:** `/admin/notifications` (new tab): master switch, per-event toggles, last 100 log rows (time, order, event, status), **Resend** on failed rows. Every action starts with `requireAdmin()`.

**Customer side:** nothing to opt out of (transactional). `/orders/[number]` unchanged.

**Errors:** `sendSms` already never throws or logs the token/message. `notifyOrder` wraps everything in try/catch and logs only an error name.

## Migration
`20261110100000_order_notifications.sql`: both tables, RLS on, no grants, one `notification_settings` row inserted (enabled false). Additive; applied before deploy by Claude via the Supabase plugin (owner delegated this).

## Out of scope
Email, owner alerts, marketing SMS, per-customer language, delivery receipts, DB-level (cron) sends.

## Testing
Vitest for the pure rules. Manual: with the token absent and the switch ON, place/ship/cancel an order and see `skipped` rows; resend works from the admin; switch OFF writes `skipped`. A real send needs the owner's Text.lk token.
