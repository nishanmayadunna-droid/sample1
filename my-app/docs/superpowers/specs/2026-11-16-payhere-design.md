# Online card payments with PayHere (Part 22)

## Understanding

Customers can pay a pending order by card through PayHere (Sri Lanka). Paying online can earn a **discount** (a percent off the goods) and a **gift** line, both set by the admin. Built against PayHere's documented Checkout API (https://support.payhere.lk/api-%26-mobile-sdk/checkout-api); the owner has not registered yet, so it ships OFF, in sandbox mode, and does nothing until `PAYHERE_MERCHANT_ID` / `PAYHERE_MERCHANT_SECRET` are set and the admin switches it on.

Assumptions: online payment is a second step on the **order page** (the order is placed first, as today, so stock is held and totals are fixed); it pays the whole order total less the online discount; it replaces a not-yet-paid bank advance; an order whose advance is already approved cannot also be paid online; refunds are made in the PayHere dashboard (the Part 16 refund log covers advances only); phone-only accounts have no email, so PayHere gets a placeholder email until Part 11.

## Constraints

- **The browser never decides money.** `startOnlinePayment(orderNumber)` loads the customer's own order, recomputes the amount and discount on the server (`onlineAmounts`), stores the attempt, and returns a signed form. The merchant secret never leaves the server.
- **Only PayHere's notification marks an order paid.** `POST /api/payhere/notify` verifies `md5sig` (formula from the docs), the merchant id, the currency (LKR) and that the amount equals the stored attempt exactly, then calls the `service_role` SQL function `confirm_online_payment`. The return URL proves nothing.
- Idempotent and race-safe: a repeated notification returns `already`; the function locks the order row; one paid attempt per order (partial unique index), a second is `overpaid`.
- Money that arrives but cannot be applied (order cancelled/delivered, advance already approved) is kept as `paid` with the order unchanged and listed on `/admin/online` under Needs attention; chargebacks too.
- `place_order` and `set_order_status` are **not** replaced. Customers cannot cancel an online-paid order (`canCustomerCancel`); auto-cancel of stale advance orders only touches `advance_due`, so a paid order is safe.
- Every new table has RLS with no grants; migration `20261116100000_payhere.sql` is additive (it widens the two payment check constraints on `orders`).

## Data

`orders`: `payment_method` gains `online`, `payment_status` gains `online_paid`, plus `online_discount`, `online_paid_amount`, `online_paid_at`, `online_gift`. `payhere_settings` (one row: `enabled` false, `sandbox` true, `discount_percent` 0–50, `gift_si`/`gift_en`). `online_payments` (one row per attempt: `ref` = the `order_id` sent to PayHere, `amount`/`discount` cents, `gift`, `status` pending|paid|failed|cancelled|chargedback|overpaid). Functions `confirm_online_payment`, `set_online_payment_status` (service_role only). The order's `total` is never rewritten; `collectOnDelivery` is 0 for `online_paid`.

## Pure rules (`lib/payhere.ts`, tested)

`formatAmount`, `parseAmountToCents`, `checkoutHash`, `notifySignature`, `verifyNotify` (constant time), `parseNotify`, `outcomeForCode`, `canPayOnline`, `onlineAmounts` (percent off goods after promotions and points, never shipping, rounded down, at least Re 1 left), `buildCheckoutForm`, `parsePayhereSettings`, `giftText`.

## UI

Customer `/orders/[number]`: a Pay online section (amount, saving, gift) while payable; after returning from PayHere "we're confirming your payment"; once paid, the payment block says paid online, saved and gift. Admin `/admin/online`: key status (never the values), mode, notify URL (with a warning on localhost), settings, Needs attention, recent attempts. Admin order page: Online payment section.

## Going live (owner)

Register at payhere.lk, add the shop domain, put the sandbox id/secret in `.env.local`/Vercel, test with PayHere's sandbox cards, then switch to live keys and untick Sandbox. `notify_url` cannot work on localhost: it needs the public domain (`NEXT_PUBLIC_SITE_URL`).

## Out of scope

Refunding from the shop, saved cards/tokens, recurring payments, partial online payment, an online-payment note at checkout (the offer is shown on the order page right after placing).
