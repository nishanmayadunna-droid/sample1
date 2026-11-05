# Order Notifications (SMS) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Send the customer a short SMS (Text.lk) at order placed / advance due / slip approved / slip rejected / shipped / delivered / cancelled, best-effort, once per event, switchable and logged in admin.

**Architecture:** Pure rules and message text in `lib/notifications.ts` (tested). A `server-only` data layer `lib/notifications-data.ts` claims a unique log row, then sends with the existing `sendSms`. Server actions call `notifyOrder` after the SQL function succeeded and never let a failure surface. Admin tab `/admin/notifications` shows switches, the log and Resend.

**Tech Stack:** Next.js 16 server actions, Supabase (secret-key client, RLS-on private tables), Vitest.

**Spec:** `docs/superpowers/specs/2026-11-10-order-notifications-design.md`

## Global Constraints
- Next.js 16: read the relevant guide under `node_modules/next/dist/docs/` before new Next code (project rule).
- Tables are private: RLS on, **no policies, no grants**; access only via `supabaseAdmin` (`lib/supabase/admin.ts`), files `import "server-only"`.
- Every admin server action starts with `await requireAdmin(...)`.
- Server actions return message codes/plain English for admin; customer-facing SMS text is Sinhala or English by `getStoreSettings().defaultLang` (`lib/storefront.ts`). Sinhala copy needs the owner's review.
- A notification failure must never fail or block an order action: `notifyOrder` never throws.
- The SMS token and message text are never logged. Feature ships **OFF** (`enabled=false`).
- Money via `formatPrice` (`lib/products.ts`), cents everywhere. Phones are `07XXXXXXXX` (`normalizePhone`, `lib/orders.ts`); `sendSms(phone, message, senderId)` (`lib/sms.ts`) converts them.
- Sender id comes from `getSmsSettings().senderId` (`lib/sms-data.ts`); empty sender id → skipped.
- No `Co-Authored-By` omissions: commits end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## Review Focus
- Same event fired twice (double click, retry) → one SMS only (unique claim).
- Token missing / switch off / event toggle off / bad phone / empty sender id → row stored `skipped`, nothing thrown.
- Sinhala message exceeding 2 segments (70 chars each) — a long courier name or tracking link must not blow past the budget silently (`segmentCount` reported in the log, text truncated field-wise).
- `cancel_stale_advance_orders` returns only a count: the sweep must notify exactly the orders cancelled with `cancel_reason='advance_expired'` and never twice.
- A user cancelling their own order (`cancelMyOrder`) also notifies once.

---

### Task 1: Pure rules and message text

**Files:**
- Create: `lib/notifications.ts`
- Test: `lib/notifications.test.ts`

**Interfaces:**
- Produces:
  - `export const NOTIFICATION_EVENTS = ["placed","advance_due","slip_approved","slip_rejected","shipped","delivered","cancelled"] as const; export type NotificationEvent = (typeof NOTIFICATION_EVENTS)[number];`
  - `export type NotificationSettings = { enabled: boolean; events: Record<NotificationEvent, boolean> }`
  - `export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings` (enabled false, all events true)
  - `export type MessageData = { orderNumber: string; total: number; advanceAmount?: number; payBefore?: Date | null; courierName?: string | null; trackingNumber?: string | null; trackingUrl?: string | null; pointsEarned?: number; systemCancelled?: boolean; rejectReason?: string }`
  - `export function buildMessage(event: NotificationEvent, data: MessageData, lang: Lang): string`
  - `export function segmentCount(text: string): number` (GSM-7 160 / Unicode 70 per single segment; multipart 153 / 67)
  - `export function shouldSend(input: { settings: NotificationSettings; event: NotificationEvent; tokenSet: boolean; phone: string; senderId: string }): "send" | "skip"`
  - `export function parseNotificationSettings(fields: Record<string, string | undefined>): NotificationSettings` (checkbox fields `enabled`, `event_<name>` equal to `"on"`)
  - `export function dedupeKey(event: NotificationEvent, slipId?: string): string` (slip events → slip id, others → `""`)
- Consumes: `Lang` from `@/lib/i18n`, `formatPrice` from `@/lib/products`.

- [ ] **Step 1: Write failing tests** in `lib/notifications.test.ts`:
  - `buildMessage("placed", {orderNumber:"NB-10001", total:450000}, "en")` contains `NB-10001` and `Rs 4,500` (use `formatPrice`'s exact output in the assertion).
  - `buildMessage("shipped", {orderNumber, total, courierName:"Pronto", trackingNumber:"AB1234", trackingUrl:"https://t.example/AB1234"}, "en")` contains `Pronto`, `AB1234` and the URL; with `trackingUrl: null` it omits any `http`.
  - `advance_due` includes the advance amount; with `payBefore` a `Date` it includes the date as `YYYY-MM-DD` in Asia/Colombo; with `payBefore: null` it has no "before" clause.
  - `delivered` with `pointsEarned: 20` mentions `20`; with `0` it does not mention points.
  - `cancelled` with `systemCancelled: true` mentions the advance not received (en: contains `advance`); without it no such text.
  - `slip_rejected` includes `rejectReason`.
  - Every event × both langs: `segmentCount(buildMessage(...)) <= 2` for a worst case (courier name 20 chars, tracking 15 chars, 60-char URL, total 9,999,999.00 → the URL is dropped from the text first if the limit would be exceeded, keeping courier + tracking number).
  - `segmentCount("a".repeat(160)) === 1`, `("a".repeat(161)) === 2`, `("අ".repeat(70)) === 1`, `("අ".repeat(71)) === 2`, `("අ".repeat(134)) === 2`, `("අ".repeat(135)) === 3`.
  - `shouldSend`: "send" for enabled+event on+token+phone `0771234567`+senderId `NB`; "skip" for each of: enabled false, event off, tokenSet false, phone `""`, phone `"123"`, senderId `""`.
  - `parseNotificationSettings({enabled:"on", event_placed:"on"})` → enabled true, only `placed` true, others false; `{}` → everything false.
  - `dedupeKey("slip_approved","abc")==="abc"`, `dedupeKey("placed","abc")===""`.

- [ ] **Step 2: Run** `npx vitest run lib/notifications.test.ts` — Expected: FAIL (module not found).

- [ ] **Step 3: Implement `lib/notifications.ts`** with the signatures above. Texts (drafts, English / Sinhala; fill `Rs` amounts with `formatPrice`):
  - placed: `Northbound: order {n} received. Total {total}. Thank you!` / `Northbound: ඔබේ ඇණවුම {n} ලැබුණා. මුළු මුදල {total}. ස්තූතියි!`
  - advance_due: `Northbound: order {n} placed. Please pay the {advance} advance{ before D} and upload the slip on your order page.` / `Northbound: ඇණවුම {n} ලැබුණා. අත්තිකාරම {advance} {D දිනට පෙර} ගෙවා, ඇණවුම් පිටුවේ slip එක upload කරන්න.`
  - slip_approved: `Northbound: advance for {n} confirmed. Thank you!` / `Northbound: {n} සඳහා අත්තිකාරම තහවුරු විය. ස්තූතියි!`
  - slip_rejected: `Northbound: your slip for {n} was not accepted: {reason}. Please upload a new one.` / `Northbound: {n} සඳහා slip එක පිළිගත නොහැකි විය: {reason}. නැවත upload කරන්න.`
  - shipped: `Northbound: order {n} is on its way via {courier}, tracking {no}. {url}` / `Northbound: {n} {courier} මගින් යවා ඇත. Tracking {no}. {url}`
  - delivered: `Northbound: order {n} delivered. You earned {p} points. Thank you!` (points sentence only when > 0) / Sinhala equivalent
  - cancelled: `Northbound: order {n} was cancelled.` plus ` Your advance did not arrive in time.` when `systemCancelled` / Sinhala equivalents.
  If a message's `segmentCount` is over 2, first drop the tracking URL, then truncate `rejectReason` to fit (add `…`). Date formatting via `Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Colombo"})`.

- [ ] **Step 4: Run** the test file — Expected: all PASS. Then `npm test` — Expected: whole suite green.

- [ ] **Step 5: Commit** `git add lib/notifications.ts lib/notifications.test.ts && git commit -m "Add notification rules and message text"`

### Task 2: Migration and data layer

**Files:**
- Create: `supabase/migrations/20261110100000_order_notifications.sql`
- Create: `lib/notifications-data.ts`

**Interfaces:**
- Consumes: Task 1 exports; `supabaseAdmin`; `sendSms`, `smsTokenSet` (`lib/sms.ts`); `getSmsSettings` (`lib/sms-data.ts`); `getStoreSettings` (`lib/storefront.ts`); `getPaymentSettings` (`lib/payments-data.ts`, field `expiryHours`); `advanceDeadline` (`lib/advance.ts`); `Order` type (`lib/orders-data.ts`).
- Produces (all in `lib/notifications-data.ts`, `import "server-only"`):
  - `getNotificationSettings(): Promise<NotificationSettings>` (any error → defaults/off)
  - `saveNotificationSettings(value: NotificationSettings): Promise<void>`
  - `notifyOrder(order: Order, event: NotificationEvent, opts?: { slipId?: string; rejectReason?: string; lastReviewedAt?: string | null }): Promise<void>` — never throws
  - `sweepStaleCancelNotices(): Promise<void>` — notifies recent orders with `cancel_reason='advance_expired'` (limit 100, newest first); safe to call repeatedly
  - `type NotificationRow = { id: string; orderNumber: string; event: NotificationEvent; status: "sent"|"failed"|"skipped"; segments: number; createdAt: string }`
  - `listNotifications(limit = 100): Promise<NotificationRow[]>`
  - `resendNotification(id: string): Promise<"ok" | "not_found" | "not_failed" | "failed_again">`

- [ ] **Step 1: Write the migration** `20261110100000_order_notifications.sql`:
  - `create table public.notification_settings (id boolean primary key default true check (id), enabled boolean not null default false, ev_placed boolean not null default true, ev_advance_due ..., ev_slip_approved, ev_slip_rejected, ev_shipped, ev_delivered, ev_cancelled boolean not null default true);` insert the single row `on conflict do nothing`; `alter table ... enable row level security;` (no policies, no grants; `revoke all ... from anon, authenticated`).
  - `create table public.order_notifications (id uuid primary key default gen_random_uuid(), order_id uuid not null references public.orders(id) on delete cascade, channel text not null default 'sms' check (channel in ('sms')), event text not null check (event in (<7 events>)), dedupe text not null default '', phone text not null, body text not null, segments int not null default 1, status text not null check (status in ('sent','failed','skipped')), created_at timestamptz not null default now(), unique (order_id, channel, event, dedupe));` index on `created_at desc`; RLS on, revoke from anon, authenticated.
  Note `public.orders` may have no row deletes except test reset; cascade is fine.

- [ ] **Step 2: Apply the migration** with the Supabase plugin (`mcp__plugin_supabase_supabase__apply_migration`, project `dtytkwxlpvkervhkhcpu`, name `order_notifications`) — the owner delegated applying migrations. Then verify with `execute_sql`: both tables exist, `relrowsecurity` true, `notification_settings` has one row with `enabled=false`, no grants to anon/authenticated (`information_schema.role_table_grants`). Also run `get_advisors` (security) and confirm no new warnings for these tables.

- [ ] **Step 3: Implement `lib/notifications-data.ts`.** `notifyOrder`: wrap in try/catch (log only `error.name`/code). Steps: read settings, sms settings, store settings; compute `shouldSend` (token via `smsTokenSet()`, `senderId` from sms settings); build `MessageData` from the order (advance_due: `advanceAmount: order.advanceAmount`, `payBefore: advanceDeadline(order.createdAt, opts.lastReviewedAt ?? null, expiryHours)`; delivered: `pointsEarned: order.pointsToEarn`; cancelled: `systemCancelled: order.cancelReason === "advance_expired"`); `placed` for an advance order (`order.advanceAmount > 0`) is sent as the `advance_due` text under event `advance_due` and **not** also as `placed` (one SMS); insert the row with `status` `skipped` or a provisional `failed` using `.insert(...)`; on unique violation (`23505`) return; if "send": `await sendSms(order.phone, body, senderId)` then update the row `sent`/`failed`. `sweepStaleCancelNotices`: select up to 100 orders `status='cancelled' and cancel_reason='advance_expired'` order by `created_at desc` → map with the same column list as `orders-data` by calling `getOrderForAdmin(orderNumber)` per order, then `notifyOrder(order,"cancelled")` (dedupe makes repeats no-ops). `resendNotification`: load the row, require `status='failed'`, re-run send with the stored `body`/`phone` (checks token + enabled + sender id; if skipped conditions now hold false return `failed_again`), update status.

- [ ] **Step 4: Typecheck** `rm -rf .next/types .next/dev/types && npx tsc --noEmit` — Expected: no errors.

- [ ] **Step 5: Smoke test the data layer via SQL**: with the Supabase plugin insert nothing; instead confirm in Task 5 browser flow. Commit: `git add supabase/migrations/20261110100000_order_notifications.sql lib/notifications-data.ts && git commit -m "Add notification log, settings and sender"`

### Task 3: Hook into the order actions

**Files:**
- Modify: `app/checkout/actions.ts` (after `setOrderDistrict`), `app/admin/orders/actions.ts` (`setOrderStatusAction`, `reviewSlipAction`, `cancelStaleOrdersAction`), `app/orders/[number]/actions.ts` (`cancelMyOrder`)

**Interfaces:** Consumes `notifyOrder`, `sweepStaleCancelNotices` (Task 2), `getOrderForUser`/`getOrderForAdmin` (`lib/orders-data.ts`), `getSlip…`: for `reviewSlipAction` load the slip's order via `supabaseAdmin.from("payment_slips").select("order_id").eq("id", slipId)` then the order by id (add `getOrderById(id): Promise<Order | null>` to `lib/orders-data.ts` next to `getOrderForAdmin`, same columns).

- [ ] **Step 1:** In `placeOrder` after the district write and before `revalidatePath`, `const placed = await getOrderForUser(result.orderNumber, user.id); if (placed) await notifyOrder(placed, "placed");` inside its own `try/catch {}` that only logs (notifyOrder already never throws; the catch also covers the read).
- [ ] **Step 2:** In `setOrderStatusAction`, after `outcome` is ok: `const order = await getOrderById(orderId)`; map `to` → event (`shipped`→`shipped`, `delivered`→`delivered`, `cancelled`→`cancelled`; `confirmed` and `pending` send nothing) and call `notifyOrder`. Use the same mapping in `cancelMyOrder` (event `cancelled`).
- [ ] **Step 3:** In `reviewSlipAction` after `outcome === "ok"`: load the order via the slip, call `notifyOrder(order, approve ? "slip_approved" : "slip_rejected", { slipId, rejectReason: cleanReason })`.
- [ ] **Step 4:** In `cancelStaleOrdersAction` after `cancelStaleOrders()` call `await sweepStaleCancelNotices()` (wrapped so a failure does not change the returned `cancelled` count).
- [ ] **Step 5:** `npx tsc --noEmit`, `npm run lint`, `npm test` — Expected: clean/green. Commit: `git add -A app lib && git commit -m "Send order notifications from the order actions"` (check `git status` first so only intended files are staged).

### Task 4: Admin page

**Files:**
- Modify: `app/admin/AdminTabs.tsx` (add `"notifications"` to `AdminTab` and a tab `/admin/notifications`, label "Notifications", placed after "SMS")
- Create: `app/admin/notifications/page.tsx`, `app/admin/notifications/actions.ts`, `app/admin/notifications/NotificationSettingsForm.tsx` (client), `app/admin/notifications/ResendButton.tsx` (client)

**Interfaces:** Consumes `getNotificationSettings`, `saveNotificationSettings`, `listNotifications`, `resendNotification`, `parseNotificationSettings`, `smsTokenSet`. Mirror `app/admin/sms/{page,actions,SmsSettingsForm}.tsx` for structure and styling.

- [ ] **Step 1:** `actions.ts` (`"use server"`): `saveNotificationSettingsAction(_prev, formData)` — `requireAdmin("/admin/notifications")` first; parse with `parseNotificationSettings`; refuse switching `enabled` on when `!smsTokenSet()` (error `"Set TEXTLK_API_TOKEN on the server first"`); save; `revalidatePath("/admin/notifications")`; returns `{ errors, saved }`. `resendNotificationAction(id)` — `requireAdmin` first, id must match the UUID regex, returns `{ error: string | null }`, revalidates the page.
- [ ] **Step 2:** Page: `requireAdmin("/admin/notifications")`, `AdminTabs active="notifications"`, settings form (master switch + one checkbox per event with a one-line label each), token status line, a note that Sinhala SMS costs more per message and that auto-cancel by the schedule sends no SMS (only "Cancel stale now" does), and a log table (time in Asia/Colombo, order number link to `/admin/orders/<n>`, event, status, segments) with `ResendButton` on `failed` rows.
- [ ] **Step 3:** `npx tsc --noEmit` and `npm run lint` — Expected: clean. Commit: `git add app/admin && git commit -m "Add the notifications admin page"`

### Task 5: Docs and live check

**Files:** Modify `CLAUDE.md` (add a **Notifications (Part 13)** bullet after the Delivery bullet: tables, `notifyOrder` once-only claim, hooks, defaults OFF, the cron limitation + `sweepStaleCancelNotices`, admin page, **Migration state:** `20261110100000_order_notifications.sql` applied before the code is deployed; add the client components to the "Server vs client" list).

- [ ] **Step 1:** Edit `CLAUDE.md` as above.
- [ ] **Step 2: Live check** (dev server `preview_start "my-app"`; admin signed in by the owner): at `/admin/notifications` switch on (token absent → expect the error message). Temporarily enable via SQL is NOT done; instead verify the skipped path by placing a Rs 600 test order while the switch is OFF and confirm a `skipped` row appears (`select event,status from order_notifications order by created_at desc limit 5`), change its status in admin (confirm → no row; ship with a shipment → `shipped` skipped row; cancel → `cancelled` row), and confirm firing `shipped` twice is impossible by re-checking the unique count. Clean up the test order through the admin cancel flow only; leave rows in the log (they cascade with a reset).
- [ ] **Step 3:** `npm test`, `npm run lint`, `npx tsc --noEmit` — Expected: all green. Commit: `git add CLAUDE.md && git commit -m "Document order notifications"`.
