# Checkout and orders, cash on delivery (Part 5)

## Understanding

Customers can place real orders paid on delivery (COD); admins process them. Said by the owner: checkout is for signed-in customers only (option A); the status flow is Pending, Confirmed, Shipped, Delivered, plus Cancelled (option A); stock drops when the order is placed; payment gateways come at the very end. Later parts (not built here): Part 6 takes a small advance by bank transfer with a slip upload (paying it is what makes a customer "verified"); Part 7 is a loyalty points system, awarded when an order is Delivered. Assumptions: flat shipping and promotions come from the existing engine (`summarizeCart`); Sinhala/English via `<L>`; prices are cents; no email/SMS.

## Global constraints

- Next.js 16 / React 19; read `node_modules/next/dist/docs/` before Next code. Catalog pages stay static/ISR; the root layout must not call `auth()`. New order pages are per-user, so they are dynamic and live outside the cached catalog routes.
- Every customer string in `<L si en>` (attributes via `tr`). Admin pages English. Server Actions return message **codes**, not text.
- Every `public` table has RLS. The migration is additive, saved in `supabase/migrations/`, and applied by the owner in the SQL editor BEFORE the code is deployed. Never apply it yourself.
- Money in cents. The browser never decides a price: the server recomputes everything from the catalog, promotions and settings.
- Every admin action starts with `await requireAdmin(...)`; customer actions start with `requireUser(...)` and take the user id from the session only.
- Pure rules are unit-tested in `lib/*.test.ts`. No invented data.

## 1. Data

Migration `supabase/migrations/20261104100000_orders.sql`:

- `public.orders`: `id uuid pk default gen_random_uuid()`, `order_number text unique not null` (`NB-` + sequence value, e.g. `NB-10001`; sequence `orders_number_seq` starting at 10001), `user_id uuid not null references users(id)`, `idempotency_key uuid not null unique`, `status text not null default 'pending'` check in (`pending`,`confirmed`,`shipped`,`delivered`,`cancelled`), `payment_method text not null default 'cod'` check in (`cod`), `payment_status text not null default 'unpaid'` check in (`unpaid`), `customer_name`, `phone`, `address`, `city` (all text, length-checked), `note text` (nullable, 500), `subtotal`, `discount`, `shipping`, `total` (integer cents, `>= 0`), `created_at timestamptz default now()`, `confirmed_at`, `shipped_at`, `delivered_at`, `cancelled_at` (nullable). The payment check constraints are widened by Part 6.
- `public.order_items`: `id uuid pk`, `order_id uuid references orders on delete cascade`, `product_id text references products on delete set null`, `product_name text not null`, `size text not null`, `quantity int check (1..99)`, `unit_price int not null` (what one unit cost after promotions), `compare_at int` (nullable).
- RLS on both; `revoke all ... from anon, authenticated`; no policies. Reads and writes go through the secret-key client only, and customer reads always filter by the session user id.
- `public.place_order(p_user_id uuid, p_key uuid, p_customer jsonb, p_totals jsonb, p_items jsonb) returns text`, executable only by `service_role`: in one transaction, if an order with `p_key` exists return its number (double-click safe); lock the product rows `for update`; for each item whose size is tracked in `products.stock`, raise `out_of_stock:<product_id>:<size>:<left>` when `quantity > stock[size]`, else decrement; insert the order and items; return `order_number`. Untracked sizes are never touched.
- `public.set_order_status(p_order_id uuid, p_to text, p_user_id uuid default null) returns void`, executable only by `service_role`: locks the order, checks the transition is allowed (same table as `lib/orders.ts`; when `p_user_id` is given the order must belong to that user and the target must be `cancelled` from `pending`), stamps the matching `*_at`, and on `cancelled` adds each item's quantity back to `products.stock[size]` when that size is tracked and `product_id` is not null.
- `alter table public.reviews add column verified boolean not null default false`, and the public column grant from `20261103190000_reviews_column_grants.sql` is extended with `verified`.

## 2. Pure rules

`lib/orders.ts`: `ORDER_STATUSES`, `nextStatuses(status)` (pending: confirmed, cancelled; confirmed: shipped, cancelled; shipped: delivered, cancelled; delivered and cancelled: none), `canCustomerCancel(status)` (pending only), `parseCheckoutDetails(fields)` returning `{ ok, value } | { ok: false, errors }` (name 2-80 chars, phone a Sri Lankan mobile `07XXXXXXXX` or `+947XXXXXXXX` normalised to `07XXXXXXXX`, address 5-200, city 2-60, note up to 500, control characters rejected), `orderTotals(summary)` mapping a `summarizeCart` result to `{ subtotal, discount, shipping, total }`, `statusLabel(status)` (si/en), `isOrderMessage`. Codes: `placed | details | empty | out_of_stock | price_changed | error`.

## 3. Checkout

- The cart's "Checkout" button (CartView and the drawer) links to `/checkout`. `/checkout` is a Server Component that reads products, promotions, settings and categories cookie-less and calls `requireUser("/checkout")`, then renders a client `CheckoutForm`; the form reads the browser cart, shows the summary through the same `summarizeCart`/`CartTotals`, the details fields (prefilled from the user's latest order), "Cash on delivery" as the only payment option, and a place-order button that disables on submit.
- `placeOrder(lines, details, expectedTotal, key)` (`app/checkout/actions.ts`): `requireUser`; sanitize lines (`sanitizeCartLines`); load fresh products and promotions; reject unknown or hidden products; run `clampToStock`-style checks; recompute with `summarizeCart`; if `total !== expectedTotal` return `price_changed` (the form shows the new total and asks to confirm again); call `place_order`; map `out_of_stock` to a code plus the product id and size; return `{ message: "placed", orderNumber }`. The client then clears the cart (a normal local edit that syncs) and navigates to `/orders/<number>`.
- `key` is a `crypto.randomUUID()` the form creates once per checkout attempt, so double-clicks and retries create one order.

## 4. Customer orders

- `/orders/[number]`: `requireUser`; loads the order only when `user_id` matches (else `notFound()`); shows number, status steps, items, totals, delivery details, payment ("Cash on delivery, pay when it arrives"), and a Cancel button when `canCustomerCancel` (calls `cancelMyOrder(number)`, which uses `set_order_status` with the user id).
- `/account` gains an "My orders" list (number, date, status, total, link).

## 5. Admin

- `/admin/orders` (new tab "Orders" in `AdminTabs`): status filter, pending first then newest; each row links to `/admin/orders/[number]` with items, customer details (phone as a `tel:` link), totals and buttons for `nextStatuses` only. `lib/admin-orders.ts` (secret key, `server-only`) and `app/admin/orders/actions.ts` (every action starts with `requireAdmin`; calls `set_order_status`; `revalidatePath` for `/admin/orders`, the order page, `/`, `/products`, `/products/<id>` for each item, and `/orders/<number>`).

## 6. Verified buyer

`submitReview` sets `verified = true` when the user has a `delivered` order containing that `product_id` at submit time (an `order_items` join through the secret client). `ReviewSection` shows "Verified buyer" beside the author when `review.verified`. `Review` and `getProductReviews` gain `verified`.

## Testing

Vitest: `nextStatuses` table, `canCustomerCancel`, `parseCheckoutDetails` (phone formats, bad phone, short name, over-long note, control chars), `orderTotals`. Browser (with test data cleaned afterwards): place an order, stock drops, stock below quantity is refused with a clear message, double-click makes one order, cancel restores stock, status flow in admin, another customer cannot open the order (404), verified badge after Delivered, Sinhala and English, phone width. `npm run build` keeps `/` and `/products/[id]` static.

## Review focus

- Two orders racing for the last unit: exactly one succeeds (row lock in `place_order`).
- Price or promotion changes between the checkout page load and submit: `price_changed`, no order at the old price.
- Double-click and retry: one order, one stock decrement.
- A hidden or deleted product in the cart at submit: clear error, nothing written.
- Cancelling restores stock only for tracked sizes and only once; cancelling a deleted product's line does not fail.
- Product deleted later: the order and its history keep the name and price snapshot.
- A customer cannot read, cancel or guess another customer's order; non-admins cannot change status.
- Signing out mid-checkout, and an empty cart on `/checkout`.

## Out of scope

Payment gateways, advance payment and slip upload (Part 6), loyalty points (Part 7), email/SMS notifications, refunds, courier integration, saved address book.
