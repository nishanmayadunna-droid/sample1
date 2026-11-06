# Points v2: bonus events, tiers and expiry (Part 18)

## Understanding

Part 7 gave plain points: earn on delivery, spend at checkout. This adds three things the owner can switch on independently: **bonus events** (a time-boxed "double points weekend"), **tiers** (a level from lifetime spend that earns extra) and **expiry** (unspent points lapse after N days). Assumptions: with no bonus, tier or expiry configured, nothing changes; the extra percent is added to what an order *earns* only (what points are worth when spent is unchanged); the best running bonus applies (no stacking of bonuses) plus the customer's tier bonus, capped at +500%; tier spend = goods (total minus shipping) of the customer's **delivered** orders; expiry is first-in-first-out (spending uses the oldest points first); product pages and cards still never mention points; customer text in both languages with `<L>`, admin pages English.

## Constraints

- `place_order` and `set_order_status` are **not** replaced: the server already hands `place_order` the order's `points_to_earn`, so the bonus is simply part of that number. Orders already placed keep the number they were promised.
- Points only move inside `service_role` SQL functions; the new one is `expire_points()`.
- Every `public` table has RLS (new tables are private: no policies, no grants). Migration is additive; the owner's pg_cron schedule is a separate optional file.
- The browser never sends or decides the bonus; `placeOrder` reads it on the server. Unreadable tiers or bonuses count as 0.
- Pure rules are unit-tested.

## Data (`20261113100000_points_v2.sql`)

- `points_settings.expiry_days` (0 to 3650, default 0 = never).
- `points_ledger.kind` gains `'expire'` (negative, no order).
- `points_bonuses` (`name`, `bonus_percent` 1 to 500, `starts_at`, `ends_at`, `active`) and `points_tiers` (`name`, `min_spend` cents unique, `bonus_percent` 0 to 500; at most 5, enforced by the app).
- `expire_points()` (`service_role` only): per customer, under the customer's row lock, writes one `expire` row for `min(balance, points earned before the cutoff − everything ever spent or expired)`. A second run expires nothing. One customer failing never stops the rest. Returns how many customers lost points.
- Optional `20261113110000_schedule_expire_points.sql`: daily `pg_cron` job (02:00 Colombo). The admin's **Expire now** button does the same.

## Pure rules (`lib/points-v2.ts`)

`activeBonus`, `tierFor`, `nextTier`, `earnBonusPercent`, `expiryPicture` (the TypeScript mirror of the SQL expiry, used for the customer's "expires soon" line), `parseBonusForm`, `parseTierForm`, `parseExpiryDays`. `pointsToEarn` (lib/points.ts) takes an optional `bonusPercent` and does one integer rounding down: `floor(goods × (100 + bonus) / (earnPer × 100))`.

## Admin (`/admin/points`)

Expiry (days + Expire now), Bonus events (list with running/scheduled/ended, switch on/off, delete, add with Colombo times), Tiers (list, add, delete). Every action starts with `requireAdmin`.

## Customer (`/account`)

Level and progress to the next level, a running-bonus line, and "N points expire by <date>" within 30 days. Order pages already show the earn number, which now includes the bonus.

## Out of scope

Per-product bonuses, bonus for sign-up or reviews, tier-specific discounts, expiry warnings by SMS, changing points on already-placed orders.
