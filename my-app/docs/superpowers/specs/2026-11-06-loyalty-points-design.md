# Loyalty points (Part 7)

## Understanding

Customers earn points when an order is **delivered** and spend them at checkout as a discount. Said by the owner: points are redeemed as a discount at checkout (option A); the admin decides the value of a point. Chosen defaults (confirmed by the owner): points are earned as 1 point per Rs X of goods; 1 point is worth Rs Y; a cap of Z% of the goods value per order; the earn base excludes shipping and the points discount; a cancelled order (before delivery) gives its used points back; settings changes never touch points already earned (the number is fixed in the ledger), but the current value applies to remaining points. Assumptions: the points discount applies after promotions to goods only (not shipping); the advance (Part 6) is computed on the final total; Sinhala/English via `<L>` for customer text, admin pages English; money in cents; points are whole numbers.

## Global constraints

- Next.js 16 / React 19; read `node_modules/next/dist/docs/` before Next code. Catalog pages stay static/ISR; the root layout must not call `auth()`; checkout, account, order and admin pages are dynamic. Product pages and cards show no points claims.
- Server Actions return message **codes**; admin actions start with `await requireAdmin(...)`; customer actions with `requireUser(...)` (user id from the session only).
- Every `public` table has RLS. Migrations are additive, saved in `supabase/migrations/`, applied by the owner in the SQL editor BEFORE the code is deployed. Never apply them yourself.
- The browser never decides a points discount or a balance: the server recomputes both. Points move only inside `service_role` SQL functions, in the same transaction as the order or status change.
- Pure rules are unit-tested in `lib/*.test.ts`. Real data only (no invented earn estimates beyond what the server computed for that order).

## 1. Data (migration `20261106100000_loyalty_points.sql`)

- `public.points_settings` (single row, `id boolean primary key default true check (id)`): `enabled boolean not null default false`, `earn_per integer not null default 10000` (cents of goods per point, `>= 100`), `point_value integer not null default 100` (cents one point is worth, `>= 1`), `max_percent integer not null default 50` (1–100). RLS on, no client grants, no policies. Default **off**, so applying the migration changes nothing until the admin turns it on.
- `public.points_ledger`: `id uuid pk`, `user_id uuid not null references users(id) on delete cascade`, `order_id uuid references orders(id) on delete set null`, `kind text not null` check in (`earn`,`redeem`,`refund`,`adjust`), `points integer not null check (points <> 0)` (earn/refund/adjust-up positive; redeem/adjust-down negative), `note text` (≤ 200), `created_at timestamptz default now()`. Partial unique index `(order_id, kind) where kind in ('earn','redeem','refund') and order_id is not null` (each order earns, redeems and refunds at most once). Index `(user_id, created_at desc)`. RLS on, no client grants. **Balance = sum of `points` for the user.**
- `orders`: add `points_used integer not null default 0`, `points_discount integer not null default 0` (cents), `points_to_earn integer not null default 0` (computed by the server when the order is placed with the settings of that moment; becomes an `earn` row at delivery). `orders.total` already includes the points discount (`total = subtotal - discount - points_discount + shipping`); a check `points_used >= 0 and points_discount >= 0 and points_to_earn >= 0`.
- Functions (`security definer`, `set search_path = public`, revoked from `public, anon, authenticated`, granted to `service_role`):
  - `place_order(...)` replaced: extra `p_points integer`, `p_points_discount integer`, `p_points_to_earn integer` (the 6-argument version is dropped). When `p_points > 0`: lock the user row (`for update`), compute the balance from the ledger, raise `not_enough_points` when `p_points` exceeds it, store the three order columns and insert a `redeem` row of `-p_points`. The advisory lock, pending cap, stock locking, idempotency and advance behaviour are unchanged.
  - `set_order_status(...)` replaced: moving to `delivered` inserts the `earn` row (`points_to_earn`, when > 0); moving to `cancelled` inserts the `refund` row (`points_used`, when > 0) for any status it can be cancelled from; both are no-ops if the row already exists (the unique index), and both run in the same transaction as the status change. Stock and advance rules are exactly as in Part 6 (including `advance_unpaid` and the hardening migration's customer-cancel rule).
  - `adjust_points(p_user_id uuid, p_points integer, p_note text) returns integer`: admin adjustment; locks the user row, refuses a result below zero (`would_go_negative`), inserts an `adjust` row and returns the new balance.

## 2. Pure rules

`lib/points.ts`: `type PointsSettings = { enabled: boolean; earnPer: number; pointValue: number; maxPercent: number }`; `pointsToUse(requested: number, balance: number, goods: number, s: PointsSettings): { points: number; discount: number }` — `0` when off; the points actually usable = `min(requested, balance, floor(floor(goods * maxPercent / 100) / pointValue))`, never negative, whole numbers; `discount = points * pointValue` (never above `goods`); `pointsToEarn(goodsAfterAllDiscounts: number, s): number` (`0` when off; `floor(goods / earnPer)`); `parsePointsSettings(fields)` (rupee inputs → cents, `earnPer >= Rs 1`, `pointValue >= Rs 0.01`, percent 1–100, amounts under Rs 1,000,000); `ledgerKindLabel(kind)` (si/en). `lib/order-plan.ts`: `planOrder` gains `pointsRequested: number`, `pointsBalance: number`, `pointsSettings: PointsSettings`; the goods base is `subtotal - orderDiscount`; the plan's `totals` gain `pointsDiscount`, `pointsUsed`, `pointsToEarn` and `total` already includes the points discount; `expectedTotal` is compared against that final total (the existing `price_changed`). `lib/orders.ts`: `OrderTotals` gains the three fields; `OrderMessage` gains `points_changed`.

## 3. Admin

- New tab **Points** (`/admin/points`): the on/off switch, "1 point per Rs X", "1 point is worth Rs Y", "up to Z% of an order", and a live example ("an order of Rs 10,000 earns N points; N points are worth Rs M").
- **Customers** tab: a points balance column (one grouped query) and an "Adjust points" control (signed whole number plus a required note) calling `adjust_points`.
- The admin order page shows points used, the points discount and the points to be earned.

## 4. Customer

- **Checkout:** when points are on and the customer has a balance, a "Use my points" control (a number input prefilled with the most they can use, plus a checkbox to switch it off) shows `- Rs Z`; the summary total includes it; the advance preview uses the final total. `placeOrder` gains `pointsRequested` and recomputes with `pointsToUse`; if the discount or total differs from what the form showed it returns `price_changed` as today; `not_enough_points` from the database returns `points_changed` (the form refreshes and asks again).
- **Order page:** "Points used: N (- Rs Z)" and, while the order is not delivered or cancelled, "You'll earn N points when it's delivered"; delivered orders show "N points earned"; cancelled orders show "N points returned".
- **Account page:** the balance, "N points ≈ Rs M", and the history from the ledger (kind, points, order link, date), newest first (last 50).
- Points never appear on product pages or cards.

## Testing

Vitest: `pointsToUse` (off, requested above balance, above the cap, whole points only, rounding down, zero goods), `pointsToEarn` (off, exact, below one point), `parsePointsSettings`, `planOrder` with points (total includes the discount, `price_changed` when the form's total ignored the points, points base excludes shipping). Browser (test data cleaned afterwards): admin switches points on and sets values; an order is delivered and earns points exactly once; checkout uses points and the total, the advance and the order page agree; cancelling returns the points once; two simultaneous uses of the same points can't both succeed; admin adjusts a balance; Sinhala/English; phone width; `npm run build` keeps `/` and `/products/[id]` static.

## Review focus

- The points discount and balance can't be tampered with from the browser; negative or fractional points rejected; points can't be spent twice (race with two orders) and the balance never goes below zero.
- Earn and refund happen exactly once even if the admin clicks twice or two admins race.
- A cancelled order never keeps points it earned (it can't have: earn is only on delivered, and delivered is final) and always returns the points it used; shipped → cancelled also refunds.
- Rounding: no free money (discount never above goods, whole points, floor everywhere).
- Interaction with Part 6: advance computed on the final total; trusted logic unchanged; existing orders (no points) keep working; a points-only purchase never makes the total negative.
- Settings changes don't rewrite old orders or ledger rows.
- Customers can't read other customers' ledgers; non-admins can't adjust points.

## Out of scope

The payment gateway "pay first, get a gift or discount", bonus points for reviews or first orders, expiry, tiers, email/SMS, points shown on product pages.
