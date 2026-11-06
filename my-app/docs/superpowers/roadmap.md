# Roadmap: remaining work

Each part follows the repo's habit: spec, plan, migration (owner runs it in the SQL editor), code, tests, CLAUDE.md section.

## Can be built now (no domain needed)

| Part | Scope |
|---|---|
| 16 Refunds | record refunds on cancelled advance-paid orders (amount, method, date, note), show on order pages |
| 17 Owner alerts | SMS to the owner on new order, new slip, low stock, failed SMS |
| 18 Points v2 | bonus-points events, expiry, tiers |
| 19 Phone account | link a phone to an email account, change phone number (both with an SMS code) |
| 20 Shipping v2 | weight on products, weight-based fee bands per zone, SMS delivery receipts |
| 21 POS stock sync | needs the POS API details from the owner |
| 22 Payment gateway | PayHere sandbox: pay-first option, gift/discount for paying online, webhook with signature check |

## Needs the domain (build the code now, switch on later)

| Part | Scope |
|---|---|
| 11 Email | provider setup, order emails, password reset, email verification |
| 11b Newsletter | double opt-in, per-IP limits, then campaigns (must land before any send) |

## Launch tasks (owner)

Domain + `NEXT_PUBLIC_SITE_URL`, Vercel Analytics and Speed Insights switches, `TEXTLK_API_TOKEN`,
optional `pg_cron` migration, real product photos, Sinhala copy / size tables / legal drafts review,
`docs/launch/checklist.md`, then `launch-reset.sql`.
