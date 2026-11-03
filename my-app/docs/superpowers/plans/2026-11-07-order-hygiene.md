# Order hygiene Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Orders whose advance never arrives are cancelled automatically after an admin-set number of hours (stock and points come back), and the admin can waive an advance for a customer they trust.

**Architecture:** One additive migration (a setting, two order columns, a widened slip status, two `service_role` SQL functions built on `set_order_status`) and a separate optional `pg_cron` migration. Pure, tested rules in `lib/advance.ts`; a "Cancel stale now" button is the manual backup for the scheduler.

**Tech Stack:** Next.js 16.2 App Router, React 19.2, Supabase (secret-key writes, SQL functions via `rpc`, `pg_cron`), Auth.js v5, Tailwind v4, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-07-order-hygiene-design.md`

## Global Constraints

- Read the relevant guide under `node_modules/next/dist/docs/` before writing Next code. Catalog pages stay static/ISR; the root layout must not call `auth()`.
- Customer strings in `<L si en>` (attributes via `tr`); admin pages English; Server Actions return message **codes**; admin actions start with `await requireAdmin(...)`.
- Every `public` table has RLS. Migrations are saved in `supabase/migrations/` and applied by the OWNER in the SQL editor BEFORE deploy. Never apply them yourself, never work around a denied permission. The scheduling migration is separate; nothing may depend on `pg_cron`.
- Orders change status only through `set_order_status` (the new functions call it). Never print or read secrets.
- Windows/CRLF: write helper scripts with the Write tool to the scratchpad and run them with node (Bash heredocs with quotes can fail to parse); do NOT chain `check; git commit` — run checks first, commit only when green; `git add` explicit paths, never `git add -A my-app` (it picks up `.claude/launch.json`).
- Latest definitions to build on: `set_order_status` in `20261106100000_loyalty_points.sql` (includes advance, customer-cancel, shipped-cancel and points rules — do NOT redefine it); `payment_slips` and `payment_settings` in `20261105100000_advance_payments.sql`.

## Review Focus

- Slip waiting for review, shipped/confirmed/delivered orders and orders without an advance are never auto-cancelled. Pinned in Task 1 (`isAdvanceStale`) and Task 2 (the function's selection).
- The same order is never cancelled or refunded twice (cron and button at once, two cron runs). Pinned in Task 2 (`set_order_status` status check + per-order exception block).
- Auto-cancel restores stock and returns points exactly like a manual cancel; one failing order doesn't stop the rest. Pinned in Task 2.
- Waiving: right states only, total/stock/points/trust untouched, slips closed, a waived order can be confirmed, no double waive. Pinned in Task 2 and Task 8.
- Setting 0 turns auto-cancel off; changing the hours applies to existing orders. Pinned in Task 1 and Task 2.
- Without `pg_cron` the shop works. Pinned in Task 2 (separate migration) and Task 6.

---

### Task 1: Expiry rules (pure)

**Files:**
- Modify: `lib/advance.ts`, `lib/orders.ts`
- Test: `lib/advance.test.ts`, `lib/orders.test.ts`

**Interfaces:**
- Produces (`lib/advance.ts`):
  - `advanceDeadline(createdAt: string | Date, lastReviewedAt: string | Date | null, hours: number): Date | null` — null when `hours <= 0` or a date is invalid; else the later of `createdAt` and `lastReviewedAt` plus `hours` hours.
  - `isAdvanceStale(order: { status: OrderStatus; paymentStatus: PaymentStatus; advanceAmount: number; createdAt: string | Date }, lastReviewedAt: string | Date | null, hours: number, now: Date): boolean` — true only for `pending` + `advance_due` + `advanceAmount > 0` with a deadline strictly before `now`.
  - `parseAdvanceSettings` gains `expiryHours` (string field `expiryHours`, whole number 0–720, blank is an error) returned in `value` and `errors`; `PaymentSettings`-style consumers get `expiryHours: number` (add it to the object returned by `parseAdvanceSettings` only; the data-layer type is Task 3).
- Produces (`lib/orders.ts`): `type CancelReason = "advance_expired"`; `cancelReasonLabel(reason: CancelReason): { si: string; en: string }`.

- [ ] **Step 1: Write failing tests.** `advance.test.ts`: `advanceDeadline` — hours 0 and -1 → null; created 2026-01-01T10:00Z + 48 → 2026-01-03T10:00Z; a later `lastReviewedAt` wins; an earlier one is ignored; Date and string inputs equal; invalid date → null. `isAdvanceStale` — off (hours 0) false; 47 h old with 48 h → false; 49 h → true; exactly 48 h → false; `slip_uploaded` false; `unpaid`, `advance_paid` false; `confirmed`/`shipped`/`delivered`/`cancelled` false; `advanceAmount` 0 false; a rejection 1 h ago with an order 100 h old and 48 h → false (clock restarted). `parseAdvanceSettings` — extend the valid fixture with `expiryHours: "48"`; `0`, `720` ok; `721`, `-1`, `2.5`, `""`, `abc` give an `expiryHours` error. `orders.test.ts`: `cancelReasonLabel("advance_expired")` has si and en.
- [ ] **Step 2: Run** `npx vitest run lib/advance.test.ts lib/orders.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement** to the Interfaces block (update the existing `parseAdvanceSettings` success expectation in the tests to include `expiryHours`).
- [ ] **Step 4: Run** the same command, then `npm test`, `npx tsc --noEmit` — Expected: green (fix compile errors in callers only enough to compile; wiring is Tasks 3–4).
- [ ] **Step 5: Commit** with explicit paths and the session's Co-Authored-By line.

---

### Task 2: Migrations

**Files:**
- Create: `supabase/migrations/20261107100000_order_hygiene.sql`, `supabase/migrations/20261107110000_schedule_stale_cancel.sql`

**Interfaces:**
- Produces (database), exactly as the spec's Data section: `payment_settings.advance_expiry_hours`, `orders.cancel_reason` and `orders.advance_waived_at`, the widened `payment_slips_status_check` (drop and re-add with `waived`), and the functions (`security definer`, `set search_path = public`, `revoke all ... from public, anon, authenticated`, `grant execute ... to service_role`):
  - `cancel_stale_advance_orders() returns integer` — selection and per-order `begin ... exception when others then continue end` block as in the spec (calls `set_order_status(id, 'cancelled')`, then sets `cancel_reason`); do not duplicate stock/points logic.
  - `waive_advance(p_order_id uuid) returns void` — raises `order_not_found` / `bad_state`; otherwise sets `advance_amount = 0`, `payment_method = 'cod'`, `payment_status = 'unpaid'`, `advance_waived_at = now()`, and marks `pending` slips `waived`.
- Second file: `create extension if not exists pg_cron;` then `select cron.schedule('cancel-stale-advance-orders', '*/30 * * * *', 'select public.cancel_stale_advance_orders()');` with a header comment that it is optional and the "Cancel stale now" button is the backup.

- [ ] **Step 1: Write both migrations.** Header comments: run by the owner in the SQL editor BEFORE deploying (the second after the first and only if `pg_cron` is wanted).
- [ ] **Step 2: Read the SQL once** against the spec and `20261106100000_loyalty_points.sql` (the exception block must not swallow errors that should fail the whole call — it only protects the loop; `waive_advance` must lock the order with `for update`; trusted/points/stock are not touched). Do NOT apply it.
- [ ] **Step 3: Commit** `git add supabase/migrations/20261107100000_order_hygiene.sql supabase/migrations/20261107110000_schedule_stale_cancel.sql && git commit -m "Add stale advance cancel and waive advance functions"`.

---

### Task 3: Data layer

**Files:**
- Modify: `lib/payments-data.ts`, `lib/orders-data.ts`

**Interfaces:**
- Produces:
  - `payments-data.ts`: `PaymentSettings` gains `expiryHours: number` (`getPaymentSettings` reads `advance_expiry_hours`, default 48 when the row/column is missing; `savePaymentSettings` writes it; keep the `SETTINGS_COLUMNS` select in step).
  - `orders-data.ts`: `Order` gains `cancelReason: CancelReason | null` and `advanceWaivedAt: string | null` (select `cancel_reason, advance_waived_at`); `listAwaitingAdvanceOrders(): Promise<{ order: Order; lastReviewedAt: string | null }[]>` (orders with `status = 'pending'`, `advance_amount > 0`, `payment_status` in `advance_due | slip_uploaded`, oldest first, limit 300, each with the latest slip `reviewed_at` from one extra query over their ids); `cancelStaleOrders(): Promise<number>` (rpc `cancel_stale_advance_orders`); `waiveAdvance(orderId: string): Promise<"ok" | "not_found" | "bad_state">` (rpc `waive_advance`).

- [ ] **Step 1: Implement** (log real errors, return codes; map messages `order_not_found`, `bad_state`).
- [ ] **Step 2: Run** `npx tsc --noEmit`, `npx eslint lib app`, `npm test` — fix callers only enough to compile (the admin form gets the field in Task 4) — Expected: clean.
- [ ] **Step 3: Commit** with explicit paths: `git commit -m "Add stale and waive support to the data layer"`.

---

### Task 4: Admin

**Files:**
- Modify: `app/admin/payments/PaymentSettingsForm.tsx`, `app/admin/payments/actions.ts` (nothing else: `parseAdvanceSettings` already validates `expiryHours`), `app/admin/orders/page.tsx`, `app/admin/orders/actions.ts`, `app/admin/orders/[number]/page.tsx`
- Create: `app/admin/orders/CancelStaleButton.tsx`, `app/admin/orders/WaiveAdvanceButton.tsx`

**Interfaces:**
- Consumes: `isAdvanceStale`, `advanceDeadline` (Task 1); `listAwaitingAdvanceOrders`, `cancelStaleOrders`, `waiveAdvance`, `isUserTrusted` (Tasks 3 and Part 6).
- Produces (`app/admin/orders/actions.ts`, each `await requireAdmin("/admin/orders")` first):
  - `cancelStaleOrdersAction(): Promise<{ error: string | null; cancelled: number }>` — calls `cancelStaleOrders()`, revalidates `/admin/orders`, `/admin/orders/[number]` (page), `/orders/[number]` (page), `/account`, `/`, `/products` (stock changed).
  - `waiveAdvanceAction(orderId: string): Promise<{ error: string | null }>` — validates the uuid, maps `not_found` ("That order no longer exists.") and `bad_state` ("The advance can't be waived for this order."); revalidates the order pages and `/admin/orders`.
- Admin payments form: an "Cancel orders after N hours without the advance (0 = never)" field with the sentence "Only orders with no slip waiting for review are cancelled; a rejected slip restarts the clock." and the saved value.
- `/admin/orders`: a link-style filter "Awaiting advance" (`?view=advance`) listing `listAwaitingAdvanceOrders()` rows with age ("2 d 3 h"), the deadline (when expiry is on), and a "stale" mark from `isAdvanceStale(order, lastReviewedAt, expiryHours, now)`; `CancelStaleButton` shown on that view with the result ("Cancelled 2 orders" / "Nothing to cancel").
- `/admin/orders/[number]`: `WaiveAdvanceButton` (confirm "The customer will pay the whole total on delivery.") when the order is `pending`/`confirmed`, `advanceAmount > 0` and payment status is `advance_due`/`slip_uploaded`; a hint "This customer is trusted: consider waiving the advance." when `isUserTrusted(order.userId)`; the header shows "Cancelled: advance expired" (from `cancelReason`) and "Advance waived" (from `advanceWaivedAt`).

- [ ] **Step 1: Implement** following the patterns of `app/admin/orders/` and `app/admin/payments/`.
- [ ] **Step 2: Run** `npx tsc --noEmit`, `npx eslint app lib`, `npm test` — Expected: clean.
- [ ] **Step 3: Commit** with explicit paths: `git commit -m "Add stale order tools and waive advance to the admin"`.

---

### Task 5: Customer

**Files:**
- Modify: `app/orders/[number]/page.tsx`, `app/components/PaymentPanel.tsx`

**Interfaces:**
- Consumes: `advanceDeadline` (Task 1), `getPaymentSettings` (already read for the panel), `cancelReasonLabel`, `Order.cancelReason`, `Order.advanceWaivedAt`.
- Produces: the advance panel shows "Please pay before <date and time, Asia/Colombo>" when `advanceDeadline(order.createdAt, lastSlipReviewedAt, expiryHours)` is not null (it needs the latest slip `reviewed_at`: extend `listSlipsForOrder`'s `Slip` with `reviewedAt: string | null`, or compute from the slips the page already loads); a cancelled order with `cancelReason` shows `cancelReasonLabel`; a waived order (`advanceWaivedAt` set) shows "Advance waived: pay the whole amount on delivery" and no panel (the page already hides the panel once `advanceAmount` is 0).

- [ ] **Step 1: Implement** (bilingual `<L>`; props to the client `PaymentPanel` are plain strings/numbers; the deadline is passed as an ISO string and formatted with `en-LK`, Asia/Colombo).
- [ ] **Step 2: Run** `npx tsc --noEmit`, `npx eslint app lib`, `npm test` — Expected: clean.
- [ ] **Step 3: Commit** with explicit paths: `git commit -m "Show the advance deadline and why an order was cancelled"`.

---

### Task 6: Docs

**Files:**
- Modify: `CLAUDE.md` (an "Order hygiene (Part 8)" bullet: the setting and 0 = off, which orders qualify and why slips under review never do, the restart after a rejection, the two functions and that cancelling goes through `set_order_status` so stock and points return, `cancel_reason`, `waive_advance` and what it leaves untouched, `pg_cron` in its own optional migration with the "Cancel stale now" backup, migration state `20261107100000_order_hygiene.sql` run by the owner BEFORE deploy (the order query selects the new columns) and `20261107110000_schedule_stale_cancel.sql` optional; update the "Later" sentence to mention phone sign-in as Part 9)

- [ ] **Step 1: Edit CLAUDE.md** (write the edit script to the scratchpad; the file is CRLF).
- [ ] **Step 2: Commit** `git add CLAUDE.md && git commit -m "Document order hygiene"`.

---

### Task 7: Owner migration and verification

- [ ] **Step 1: Ask the owner** to run `supabase/migrations/20261107100000_order_hygiene.sql` in the SQL editor and say "done" (additive; the current production code keeps working before and after it). Stop until they do.
- [ ] **Step 2: Run** `npm test`, `npm run lint`, `npm run build` — Expected: all green; `/` and `/products/[id]` still static.
- [ ] **Step 3: Browser check** (the dev browser is signed in as the admin, who is also the test customer; save the cart snapshot first and restore it afterwards): `/admin/payments` set the advance on (Fixed Rs 500, temporary bank details) and expiry 48; place an order (advance due) and see "Please pay before …" on the order page; change the setting to 0 and the deadline disappears, back to 48; the admin "Awaiting advance" view lists it with its age and no stale mark; "Cancel stale now" cancels nothing ("Nothing to cancel"); **Waive advance** on it: the panel disappears, the customer sees "Advance waived", the admin can Confirm, then cancel it to restore stock; place a second advance order, upload a slip and check "Cancel stale now" still cancels nothing; then ask the owner to run `update public.orders set created_at = now() - interval '3 days' where order_number = '<that order>'` and press "Cancel stale now" again: a pending, slip-less advance order of that age is cancelled and its page shows the reason (test this with a THIRD order that has no slip; the order with the slip must stay). Cleanup: set the advance back off and the bank details empty, expiry 48, cancel remaining test orders, restore the cart; tell the owner which `NB-` orders remain.
- [ ] **Step 4: Commit** any fixes found, each with its failing test first when it is a pure-rule bug.

---

## Final steps (executor)

- Final whole-branch review by one fresh Opus reviewer using the Review Focus list (tell it to read the migration as a Postgres expert, including the exception block and the `pg_cron` migration); fix Critical/Important findings in one TDD pass; list Minors in the PR body.
- Open the PR from `feat/order-hygiene` into `main` (body ends with the 🤖 Generated with Claude Code line; say plainly that the first migration is additive and the second optional). Do not merge until the owner says "merge".
