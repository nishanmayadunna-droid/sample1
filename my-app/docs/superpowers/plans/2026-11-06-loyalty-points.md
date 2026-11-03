# Loyalty points Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Customers earn points when an order is delivered and spend them at checkout as a discount; the admin sets what a point is worth and how points are earned.

**Architecture:** One additive migration (private settings and ledger tables, three order columns, `service_role` SQL functions that move points in the same transaction as the order or status change). Pure, tested rules in `lib/points.ts` and an extended `planOrder`; the server recomputes the discount and balance, the browser only previews. A server-only data layer (`lib/points-data.ts`).

**Tech Stack:** Next.js 16.2 App Router, React 19.2, Supabase (secret-key writes, SQL functions via `rpc`), Auth.js v5, Tailwind v4, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-06-loyalty-points-design.md`

## Global Constraints

- Read the relevant guide under `node_modules/next/dist/docs/` before writing Next code. Catalog pages stay static/ISR; the root layout must not call `auth()`; product pages and cards show no points claims.
- Customer strings in `<L si en>` (attributes via `tr`); admin pages English; Server Actions return message **codes**; admin actions start with `await requireAdmin(...)`; customer actions with `requireUser(...)` (user id from the session only).
- Every `public` table has RLS. Migrations are saved in `supabase/migrations/` and applied by the OWNER in the SQL editor BEFORE deploy. Never apply them yourself, never work around a denied permission.
- The browser never decides a points discount or balance. Money in cents; points are whole numbers; floor everywhere (no free money). Never print or read secrets.
- Windows/CRLF: write helper scripts to files (not shell one-liners with apostrophes), prefer Edit/Write; do NOT chain `check; git commit` — run checks first and commit only when green; use `git add` with explicit paths, never `git add -A my-app` (it picks up `.claude/launch.json`).
- The latest definitions to build on: `place_order` (6 arguments) in `20261105100000_advance_payments.sql`; `set_order_status` in `20261105110000_advance_payments_hardening.sql` (includes `advance_unpaid`, the customer-cancel rule and the shipped-cancel stock rule — keep all of it).

## Review Focus

- Discount/balance can't be tampered with; negative or fractional points rejected; no double spend (two orders racing on the same points) and the balance never goes below zero. Pinned in Task 1 (`pointsToUse`), Task 2 (user-row lock + `not_enough_points`) and Task 8.
- Earn and refund happen exactly once (admin double click, two admins racing). Pinned in Task 2 (partial unique index + `on conflict do nothing`) and Task 8.
- Shipped → cancelled also refunds the used points; a delivered order is final. Pinned in Task 2.
- Rounding: discount never above goods, whole points. Pinned in Task 1.
- Part 6 interplay: advance on the final total; existing orders (no points) keep working; a points-only purchase never makes the total negative. Pinned in Task 1 (`planOrder`), Task 4 and Task 8.
- Settings changes never rewrite old orders or ledger rows. Pinned in Task 2 (`points_to_earn` snapshot) and Task 6.
- Customers can't read other customers' ledgers; non-admins can't adjust points. Pinned in Tasks 3, 5, 6.

---

### Task 1: Points rules and planning (pure)

**Files:**
- Create: `lib/points.ts`
- Modify: `lib/orders.ts` (`OrderTotals` and `orderTotals`, `OrderMessage`), `lib/order-plan.ts`
- Test: `lib/points.test.ts`, extend `lib/order-plan.test.ts` and `lib/orders.test.ts`

**Interfaces:**
- Produces (`lib/points.ts`):
  - `type PointsSettings = { enabled: boolean; earnPer: number; pointValue: number; maxPercent: number }` (cents; percent 1–100).
  - `pointsToUse(requested: number, balance: number, goods: number, s: PointsSettings): { points: number; discount: number }` — `{0,0}` when off or when any input is not a finite number; otherwise `points = max(0, min(floor(requested), floor(balance), floor(floor(goods * maxPercent / 100) / pointValue)))`; `discount = points * pointValue` (never above `goods`).
  - `pointsToEarn(goods: number, s: PointsSettings): number` — 0 when off or `goods <= 0`, else `floor(goods / earnPer)`.
  - `parsePointsSettings(fields: Record<string, string | undefined>): { ok: true; value: PointsSettings } | { ok: false; errors: Partial<Record<"enabled"|"earnPer"|"pointValue"|"maxPercent", string>> }` — `enabled` is the string `"on"`; `earnPer` and `pointValue` are rupee strings (via `parsePriceToCents`; `earnPer >= 100` cents, `pointValue >= 1` cent); `maxPercent` an integer 1–100.
  - `type LedgerKind = "earn" | "redeem" | "refund" | "adjust"`; `ledgerKindLabel(kind): { si: string; en: string }`.
- Produces (`lib/orders.ts`): `OrderTotals = { subtotal; discount; pointsDiscount; shipping; total }` plus `orderTotals(summary, pointsDiscount = 0)` where `total = summary.total - pointsDiscount`; `OrderMessage` gains `"points_changed"`.
- Produces (`lib/order-plan.ts`): `planOrder` input gains `pointsRequested: number`, `pointsBalance: number`, `pointsSettings: PointsSettings`; success result gains `points: { used: number; toEarn: number }`. Goods base for the discount is `summary.subtotal - (summary.orderDiscount?.amount ?? 0)`; `pointsToEarn` is computed on `goods - pointsDiscount`; `totals.total` includes the points discount and is what `expectedTotal` is compared against (`price_changed`).

- [ ] **Step 1: Write failing tests.** `points.test.ts`: `pointsToUse` — off → 0; requested above balance; above the percent cap (goods 10000 cents? use cents: goods 1,000,000, max 50%, value 100 → cap 5000 points); whole points only (`2.9` → 2); `NaN`/`-3`/`Infinity` → 0; rounding down of the cap; goods 0 → 0; discount equals `points * pointValue` and never exceeds goods (value large). `pointsToEarn` — off, exact multiple, below one point (0), goods 0. `parsePointsSettings` — valid; `earnPer` below Rs 1, `pointValue` 0, percent 0/101/2.5, `abc`, over Rs 1,000,000 rejected. Labels exist for all four kinds. `order-plan.test.ts`: with points enabled (earnPer 10000, pointValue 100, maxPercent 50), requested 100, balance 100: `totals.pointsDiscount === 10000`, `totals.total` is lower by that amount, `points.used === 100`, `points.toEarn` computed on goods minus the points discount (not on shipping); requested above balance is clamped; the expected total of the old (no points) price → `price_changed` with the new total; points off → unchanged behaviour (existing tests keep passing with `pointsRequested: 0`). `orders.test.ts`: `orderTotals(..., pointsDiscount)`.
- [ ] **Step 2: Run** `npx vitest run lib/points.test.ts lib/order-plan.test.ts lib/orders.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement** to the Interfaces block (update existing `planOrder` tests to pass the new inputs with points off).
- [ ] **Step 4: Run** the same command, then `npm test`, `npx tsc --noEmit` — Expected: green (fix callers of `orderTotals`/`planOrder` only enough to compile; the real wiring is Task 4).
- [ ] **Step 5: Commit** with explicit paths (`git add lib/...`) and the session's Co-Authored-By line.

---

### Task 2: Migration

**Files:**
- Create: `supabase/migrations/20261106100000_loyalty_points.sql`

**Interfaces:**
- Produces (database), exactly as the spec's Data section: `points_settings` (single row, default `enabled = false`), `points_ledger` (+ partial unique index on `(order_id, kind) where kind in ('earn','redeem','refund') and order_id is not null`, index on `(user_id, created_at desc)`), `orders.points_used / points_discount / points_to_earn` (+ check), RLS on with no policies and `revoke all` from `anon, authenticated` on both new tables, and the functions:
  - `place_order(p_user_id uuid, p_key uuid, p_customer jsonb, p_totals jsonb, p_items jsonb, p_advance integer, p_points integer, p_points_discount integer, p_points_to_earn integer) returns text` — drop the 6-argument version first; body = the 6-argument version plus: raise `bad_points` when any of the three is negative or `p_points = 0` with a non-zero discount; when `p_points > 0` lock the user row (`select ... from users where id = p_user_id for update`) BEFORE the idempotency re-check ordering is affected (take the lock after the advisory lock and the pending-cap check, before the product locks), compute the balance as `coalesce(sum(points), 0)` from the ledger, raise `not_enough_points` when `p_points` exceeds it, insert the three order columns, and insert a `redeem` ledger row of `-p_points` linked to the new order. The idempotent early returns stay before any points are taken.
  - `set_order_status(...)` — body = the hardening version plus: after the status update, `if p_to = 'delivered' and v_order.points_to_earn > 0` insert an `earn` row (`+points_to_earn`, order linked) `on conflict do nothing`; `if p_to = 'cancelled' and v_order.points_used > 0` insert a `refund` row (`+points_used`) `on conflict do nothing` (for every status it can be cancelled from, including `shipped`).
  - `adjust_points(p_user_id uuid, p_points integer, p_note text) returns integer` — lock the user row; `p_points = 0` raises `bad_points`; a result below zero raises `would_go_negative`; insert an `adjust` row with `left(p_note, 200)`; return the new balance.
- All functions: `security definer`, `set search_path = public`, `revoke all ... from public, anon, authenticated`, `grant execute ... to service_role`.

- [ ] **Step 1: Write the migration** per the Interfaces block. Header comment: run by the owner in the SQL editor BEFORE deploying; the shop starts with points OFF.
- [ ] **Step 2: Read the SQL once** against `20261105100000_advance_payments.sql` and `20261105110000_advance_payments_hardening.sql` (all existing rules preserved: advisory lock, pending cap, product lock order, idempotency, `jsonb_typeof` guards, `advance_unpaid`, customer-cancel rule, shipped-cancel stock rule) and for deadlocks (lock order: advisory → user row → products; `set_order_status`: order → products; `adjust_points`: user row only). Do NOT apply it.
- [ ] **Step 3: Commit** `git add supabase/migrations/20261106100000_loyalty_points.sql && git commit -m "Add loyalty points schema and functions"`.

---

### Task 3: Points data layer

**Files:**
- Create: `lib/points-data.ts` (`import "server-only"`, `supabaseAdmin`)
- Modify: `lib/orders-data.ts` (`Order` gains `pointsUsed`, `pointsDiscount`, `pointsToEarn`; select the columns; `createOrder` gains `points: { used: number; discount: number; toEarn: number }` and passes `p_points`, `p_points_discount`, `p_points_to_earn`; map `not_enough_points` → `{ ok: false, error: "not_enough_points" }`, `bad_points` → `error`)

**Interfaces:**
- Produces (`lib/points-data.ts`):
  - `getPointsSettings(): Promise<PointsSettings>` (row missing → defaults, enabled false); `savePointsSettings(value: PointsSettings): Promise<void>`.
  - `getPointsBalance(userId: string): Promise<number>` (sum of the user's ledger).
  - `type LedgerEntry = { id: string; kind: LedgerKind; points: number; note: string | null; orderNumber: string | null; createdAt: string }`; `listLedgerForUser(userId: string, limit = 50): Promise<LedgerEntry[]>` (newest first; order number from a joined `orders(order_number)`).
  - `adjustPoints(userId: string, points: number, note: string): Promise<{ ok: true; balance: number } | { ok: false; error: "would_go_negative" | "not_found" | "bad_points" }>` (rpc `adjust_points`).
  - `balancesForUsers(userIds: string[]): Promise<Map<string, number>>` (one query over the ledger for those ids, summed in code).
  - Extend `AdminCustomer` consumers in Task 6 (do not change `payments-data.ts` here).

- [ ] **Step 1: Implement** both files (log real errors with `console.error`, return codes).
- [ ] **Step 2: Run** `npx tsc --noEmit`, `npx eslint lib app`, `npm test` — fix callers (`createOrder` in `app/checkout/actions.ts` gets a temporary all-zero `points` argument) so everything compiles — Expected: clean.
- [ ] **Step 3: Commit** with explicit paths: `git commit -m "Add the points data layer"`.

---

### Task 4: Checkout with points

**Files:**
- Modify: `app/checkout/page.tsx`, `app/checkout/actions.ts`, `app/components/CheckoutForm.tsx`

**Interfaces:**
- Consumes: Task 1 (`pointsToUse`, `pointsToEarn`, `planOrder`), Task 3 (`getPointsSettings`, `getPointsBalance`, `createOrder`).
- Produces: `placeOrder(lines, fields, expectedTotal, key, expectedAdvance, pointsRequested: number)`: after the existing validation it loads the points settings and the user's balance (failures → points treated as off, logged), calls `planOrder` with `pointsRequested`, `pointsBalance`, `pointsSettings`; the advance is computed on `plan.totals.total` (already net of points); passes `plan.points` to `createOrder`; `not_enough_points` → `{ message: "points_changed" }`; the checkout page passes `pointsInfo: { settings: PointsSettings; balance: number } | null` (null when points are off or the balance is 0) so the form can preview with the same `pointsToUse`.
- `CheckoutForm`: a "Use my points" block (checkbox + number input prefilled with the maximum usable, clamped on input) showing "- Rs Z" and the new total; the summary total, the advance preview and the sent `expectedTotal`/`expectedAdvance` all use the points-adjusted total; `points_changed` refreshes the page with a bilingual message; points the customer didn't ask for are never used.

- [ ] **Step 1: Read** the `node_modules/next/dist/docs/01-app/` guide on Server Actions if anything about argument passing is unclear.
- [ ] **Step 2: Implement** the server side, then the form (keep the Part 5/6 behaviour when `pointsInfo` is null).
- [ ] **Step 3: Run** `npx tsc --noEmit`, `npx eslint app lib`, `npm test` — Expected: clean.
- [ ] **Step 4: Commit** with explicit paths: `git commit -m "Use points at checkout"`.

---

### Task 5: Customer order page and account

**Files:**
- Modify: `app/orders/[number]/page.tsx`, `app/account/page.tsx`

**Interfaces:**
- Consumes: Task 3 (`getPointsBalance`, `listLedgerForUser`, `getPointsSettings`), `ledgerKindLabel` (Task 1), `Order` points fields.
- Produces: the order page shows "Points used: N (- Rs Z)" in the totals when `pointsUsed > 0`; "You'll earn N points when it's delivered" while the order is not delivered or cancelled and `pointsToEarn > 0`; "N points earned" when delivered; "N points returned" when cancelled with points used. `/account` shows the balance and "N points ≈ Rs M" (using the current `pointValue`) and the last 50 ledger entries (kind label, signed points, order link, date); hidden entirely when points are off and the user has no entries; every read falls back (logged) so a failure never breaks the page.

- [ ] **Step 1: Implement** the changes (bilingual `<L>`).
- [ ] **Step 2: Run** `npx tsc --noEmit`, `npx eslint app lib`, `npm test` — Expected: clean.
- [ ] **Step 3: Commit** with explicit paths: `git commit -m "Show points on the order page and account"`.

---

### Task 6: Admin points

**Files:**
- Create: `app/admin/points/page.tsx`, `app/admin/points/actions.ts`, `app/admin/points/PointsSettingsForm.tsx`, `app/admin/customers/AdjustPoints.tsx`
- Modify: `app/admin/AdminTabs.tsx` (tab `"points"` after Customers), `app/admin/customers/page.tsx` + `actions.ts`, `app/admin/orders/[number]/page.tsx`, `lib/payments-data.ts` (`AdminCustomer` unchanged; the page merges balances from `balancesForUsers`)

**Interfaces:**
- Consumes: `parsePointsSettings`, `pointsToEarn`, `pointsToUse` (Task 1); `getPointsSettings`, `savePointsSettings`, `adjustPoints`, `balancesForUsers` (Task 3).
- Produces: `savePointsSettingsAction(prev, formData): Promise<{ errors: Record<string,string>; saved: boolean }>` (`await requireAdmin("/admin/points")` first; revalidates `/admin/points`, `/checkout`, `/account`); `adjustPointsAction(userId: string, points: number, note: string): Promise<{ error: string | null }>` in `app/admin/customers/actions.ts` (`await requireAdmin("/admin/customers")` first; validates uuid, a non-zero safe integer within ±1,000,000, a non-empty note ≤ 200 chars; maps `would_go_negative` to "That would take the balance below zero."; revalidates `/admin/customers`, `/account`). The Points page has the on/off switch, "1 point per Rs X", "1 point is worth Rs Y", "up to Z% of an order" and a live example (an order of a typed total earns N points, and N points are worth Rs M, using the same pure functions). The Customers page adds a Points column and `AdjustPoints` (signed number + required note). The admin order page shows points used, the points discount and points to earn.

- [ ] **Step 1: Implement** the files following `app/admin/payments/` and `app/admin/customers/` patterns.
- [ ] **Step 2: Run** `npx tsc --noEmit`, `npx eslint app lib`, `npm test` — Expected: clean.
- [ ] **Step 3: Commit** with explicit paths: `git commit -m "Add admin points settings and adjustments"`.

---

### Task 7: Docs

**Files:**
- Modify: `CLAUDE.md` (architecture bullet "Loyalty points (Part 7)": ledger + balance = sum, earn on delivered / redeem at checkout / refund on cancel / adjust, the SQL functions that own point movement and why, `points_to_earn` snapshot, server-recomputed discount via `planOrder`/`pointsToUse`, default OFF, routes `/admin/points` and the Customers adjust control, account and order page display, migration state `20261106100000_loyalty_points.sql` run by the owner BEFORE deploy (checkout calls the new `place_order` signature); update the Orders/Advance bullets' "Later parts" sentences)

- [ ] **Step 1: Edit CLAUDE.md** in its existing style (write the edit script to a file; the file is CRLF).
- [ ] **Step 2: Commit** `git add CLAUDE.md && git commit -m "Document loyalty points"`.

---

### Task 8: Owner migration and verification

- [ ] **Step 1: Ask the owner** to run `supabase/migrations/20261106100000_loyalty_points.sql` in the SQL editor and say "done". Warn that it replaces `place_order`, so production checkout stops working until this branch is deployed (the owner decides the timing, as in Part 6). Stop until they confirm.
- [ ] **Step 2: Run** `npm test`, `npm run lint`, `npm run build` — Expected: all green; `/` and `/products/[id]` still static.
- [ ] **Step 3: Browser check** (the dev browser is signed in as the admin, who is also the test customer; save the cart snapshot first and restore it afterwards): `/admin/points` turn on with Rs 100 per point, 1 point = Rs 1, max 50%; place an order for the test customer (advance mode `off`, so plain COD); admin moves it to Delivered and the customer earns the shown points exactly once (a second admin click is refused); `/account` shows balance and history; a new checkout shows "Use my points", the total, the advance preview (turn the advance on briefly if cheap) and the order page agree; place it and see the balance drop; cancel it and the points return once; a second order using more points than the balance is refused / clamped; admin adjusts +50 with a note and −1000 is refused; settings off hides the block; Sinhala/English; phone width. Cleanup: set points back off and the values back; zero the test balance with `adjust` entries; cancel test orders; restore the cart; tell the owner which `NB-` orders and ledger rows remain.
- [ ] **Step 4: Commit** any fixes found, each with its failing test first when it is a pure-rule bug.

---

## Final steps (executor)

- Final whole-branch review by one fresh Opus reviewer using the Review Focus list above (tell it to read the migration line by line as a Postgres expert, including lock order and the earn/refund idempotency); fix Critical/Important findings in one TDD pass; list Minors in the PR body.
- Open the PR from `feat/loyalty-points` into `main` (body ends with the 🤖 Generated with Claude Code line, and says plainly that the migration replaces `place_order`). Do not merge until the owner says "merge".
