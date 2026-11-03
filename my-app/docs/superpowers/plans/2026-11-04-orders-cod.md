# Checkout and orders (COD) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Signed-in customers place cash-on-delivery orders; stock drops atomically; customers see their orders; admins process them; reviews get a verified-buyer badge.

**Architecture:** One additive migration (`orders`, `order_items`, two `service_role`-only SQL functions that do the stock work in one transaction, `reviews.verified`). Pure, tested rules in `lib/orders.ts` and `lib/order-plan.ts` (the server recomputes every price with the existing `summarizeCart`). A server-only data layer (`lib/orders-data.ts`) uses the secret-key client; pages and actions call `requireUser`/`requireAdmin`. Catalog pages stay static; order pages are per-user and dynamic.

**Tech Stack:** Next.js 16.2 App Router, React 19.2, Supabase (secret-key writes, RLS, SQL functions via `rpc`), Auth.js v5, Tailwind v4, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-03-orders-cod-design.md`

## Global Constraints

- Read the relevant guide under `node_modules/next/dist/docs/` before writing Next code (dynamic rendering, server actions, redirects).
- Catalog stays static/ISR; the root layout must not call `auth()`. `/checkout`, `/orders/*` and `/admin/orders*` are dynamic (they call `requireUser`/`requireAdmin`).
- Every customer string in `<L si en>` (attributes via `tr(lang, si, en)`); admin pages English; server actions return message **codes**, not text.
- Every `public` table has RLS. The migration file is saved in `supabase/migrations/`; the OWNER applies it in the SQL editor BEFORE the code is deployed. Never apply it yourself, never work around a denied permission.
- Money in cents via `formatPrice`. The browser never decides a price: `placeOrder` recomputes from fresh catalog, promotions and settings.
- Every admin action starts with `await requireAdmin(...)`; customer actions start with `requireUser(...)` and use the session user id only; customer order reads always filter by that id.
- Never print or read secret values. Windows/CRLF: write helper scripts to files (not shell one-liners with apostrophes) and prefer the Edit/Write tools for multi-line edits.
- Statuses: `pending, confirmed, shipped, delivered, cancelled`. Payment (this part): `payment_method = 'cod'`, `payment_status = 'unpaid'`.

## Review Focus

- Two orders racing for the last unit: exactly one wins. Pinned in Task 2 (`for update` row lock in `place_order`) and Task 9 (manual check with a stock of 1).
- Price/promotion changes between page load and submit return `price_changed` and write nothing. Pinned in Task 2 (`planOrder` test).
- Double-click and retry make one order and one decrement. Pinned in Task 2 (idempotency key in `place_order`), Task 4 (`key` created once per attempt, button disabled) and Task 9.
- A hidden/deleted product in the cart at submit: clear error, nothing written. Pinned in Task 2 (`planOrder` `unknown_product`).
- Cancelling restores stock only for tracked sizes, only once, and tolerates deleted products. Pinned in Task 2 (`set_order_status` SQL) and Task 9.
- Order history survives product deletion (snapshot name/price, `product_id` set null). Pinned in Task 2 (migration).
- A customer cannot read, cancel or guess another customer's order; non-admins cannot change status. Pinned in Tasks 3, 5, 6 (guards, owner filter) and Task 9.
- Empty cart on `/checkout`, and signing out mid-checkout. Pinned in Task 4.

---

### Task 1: Order rules (pure)

**Files:**
- Create: `lib/orders.ts`, `lib/order-plan.ts`
- Test: `lib/orders.test.ts`, `lib/order-plan.test.ts`

**Interfaces:**
- Consumes: `summarizeCart`, `CartSummary` (`lib/cart-summary.ts`), `CartLine` and `sanitizeCartLines` (`lib/cart-rules.ts`), `sizeStock` (`lib/stock.ts`), `Promotion`, `Category`, `Product`.
- Produces (`lib/orders.ts`):
  - `ORDER_STATUSES = ["pending","confirmed","shipped","delivered","cancelled"] as const`; `type OrderStatus`.
  - `nextStatuses(s: OrderStatus): OrderStatus[]` — pending: confirmed, cancelled; confirmed: shipped, cancelled; shipped: delivered, cancelled; delivered/cancelled: none.
  - `canCustomerCancel(s: OrderStatus): boolean` — pending only.
  - `normalizePhone(raw: string): string | null` — accepts `07XXXXXXXX`, `+947XXXXXXXX`, `947XXXXXXXX`, `07X XXX XXXX` (spaces/dashes ignored); returns `07XXXXXXXX` or null.
  - `parseCheckoutDetails(fields: Record<string, string | undefined>): { ok: true; value: CheckoutDetails } | { ok: false; errors: Partial<Record<"name"|"phone"|"address"|"city"|"note", true>> }` with `CheckoutDetails = { name: string; phone: string; address: string; city: string; note: string | null }`; name 2–80, address 5–200, city 2–60, note ≤ 500 (blank → null), all trimmed, control characters other than newline/tab rejected.
  - `orderTotals(s: { subtotal: number; orderDiscount: { amount: number } | null; shipping: number; total: number }): { subtotal: number; discount: number; shipping: number; total: number }`.
  - `statusLabel(s: OrderStatus): { si: string; en: string }`.
  - `type OrderMessage = "placed" | "details" | "empty" | "out_of_stock" | "price_changed" | "error"`.
- Produces (`lib/order-plan.ts`): `planOrder(input: { lines: unknown; products: Product[]; promotions: Promotion[]; shippingFee: number; categories: Category[]; expectedTotal: number }): { ok: true; items: PlannedItem[]; totals: ReturnType<typeof orderTotals> } | { ok: false; error: "empty" | "unknown_product" | "out_of_stock" | "price_changed"; productId?: string; size?: string; left?: number; total?: number }` where `PlannedItem = { productId: string; productName: string; size: string; quantity: number; unitPrice: number; compareAt: number | null }`. Order of checks: sanitize lines (empty → `empty`); any line whose product is missing from `products` (hidden products are never in the list) → `unknown_product`; a size not in `product.sizes` → `unknown_product`; tracked stock below quantity → `out_of_stock` with `left`; recompute with `summarizeCart`; `summary.total !== expectedTotal` → `price_changed` with the new `total`.

- [ ] **Step 1: Write failing tests.** `orders.test.ts`: the full `nextStatuses` table (all five statuses), `canCustomerCancel` (only pending), `normalizePhone` (accepts `0771234567`, `+94771234567`, `94771234567`, `077 123 4567`, `077-123-4567`; rejects `0112345678`, `12345`, `""`, `07712345678`), `parseCheckoutDetails` (valid; blank note → null; name `"A"`, address `"abc"`, city `""`, bad phone, 501-char note, `"x\u0000y"` in address each flag only their field), `orderTotals` (with and without discount). `order-plan.test.ts` (reuse `lib/test-fixtures/promotions.ts`; build minimal `Product` objects with `stock`): empty lines; unknown id; size not offered; stock `{M: 1}` with quantity 2 → `out_of_stock` `left: 1`; untracked stock passes; correct `expectedTotal` → ok with items priced via the promotion; wrong `expectedTotal` → `price_changed` with the right `total`; duplicate lines collapsed by `sanitizeCartLines`.
- [ ] **Step 2: Run** `npx vitest run lib/orders.test.ts lib/order-plan.test.ts` — Expected: FAIL (modules missing).
- [ ] **Step 3: Implement** both files to the Interfaces block (reuse `summarizeCart`; do not re-implement pricing).
- [ ] **Step 4: Run** the same command, then `npm test` — Expected: all green.
- [ ] **Step 5: Commit** `git add lib && git commit -m "Add pure order rules and order planning"` (end with the session's Co-Authored-By line).

---

### Task 2: Migration

**Files:**
- Create: `supabase/migrations/20261104100000_orders.sql`

**Interfaces:**
- Produces (database): tables `orders`, `order_items`; functions `place_order(p_user_id uuid, p_key uuid, p_customer jsonb, p_totals jsonb, p_items jsonb) returns text` and `set_order_status(p_order_id uuid, p_to text, p_user_id uuid default null) returns void`; `reviews.verified boolean not null default false`. Both functions are `security definer` with `set search_path = public`, `revoke all ... from public, anon, authenticated`, `grant execute ... to service_role`.
- `p_customer` keys: `name, phone, address, city, note`. `p_totals` keys: `subtotal, discount, shipping, total`. `p_items` is an array of `{ product_id, product_name, size, quantity, unit_price, compare_at }`. `place_order` returns the `order_number`.
- Errors raised by the functions (message prefixes the data layer maps): `out_of_stock:<product_id>:<size>:<left>`, `order_not_found`, `bad_transition`.

- [ ] **Step 1: Write the migration** exactly as the spec's Data section: sequence `orders_number_seq` starting at 10001; `orders` and `order_items` with the listed columns, checks and `on delete` rules; RLS on, `revoke all` from `anon, authenticated`, no policies; index `orders (user_id, created_at desc)` and `order_items (order_id)`. `place_order`: return the existing number when `p_key` already exists; select the involved `products` rows `for update` ordered by id (no deadlocks); for each item with a tracked size raise `out_of_stock` when `quantity > (stock ->> size)::int`, else write `stock` back with the size decreased (`jsonb_set`); insert order and items; return `order_number = 'NB-' || nextval(...)`. `set_order_status`: `select ... for update`; when `p_user_id` is not null require `user_id = p_user_id`, `p_to = 'cancelled'` and current `pending` (else `bad_transition`); otherwise require the transition to be allowed by the same table as `nextStatuses`; stamp the matching `*_at`; on `cancelled` add each item quantity back to `stock[size]` only where `product_id is not null` and that size is tracked (an `order_items` row of an already-restored order cannot happen because a cancelled order has no transitions). `alter table public.reviews add column verified boolean not null default false;` then `grant select (verified) on table public.reviews to anon, authenticated;` (the earlier column grant list does not include it). Header comment: run by the owner in the SQL editor BEFORE deploying.
- [ ] **Step 2: Review the SQL once** by reading it against the spec (idempotency, row lock, restore only once, deleted-product lines skipped). Do NOT apply it.
- [ ] **Step 3: Commit** `git add supabase && git commit -m "Add orders schema and stock-safe order functions"`.

---

### Task 3: Orders data layer

**Files:**
- Create: `lib/orders-data.ts` (`import "server-only"`, secret-key `supabaseAdmin`)

**Interfaces:**
- Consumes: Task 1 types, Task 2 functions.
- Produces:
  - `type Order = { id; orderNumber; userId; status: OrderStatus; paymentMethod: "cod"; paymentStatus: "unpaid"; customerName; phone; address; city; note: string | null; subtotal; discount; shipping; total; createdAt; items: OrderItem[] }` and `type OrderItem = { productId: string | null; productName; size; quantity; unitPrice; compareAt: number | null }`.
  - `createOrder(userId: string, key: string, details: CheckoutDetails, totals, items: PlannedItem[]): Promise<{ ok: true; orderNumber: string } | { ok: false; error: "out_of_stock"; productId: string; size: string; left: number } | { ok: false; error: "error" }>` — calls `rpc("place_order", …)`, parses the `out_of_stock:` message.
  - `getOrderForUser(orderNumber: string, userId: string): Promise<Order | null>` (filters `user_id`).
  - `listOrdersForUser(userId: string): Promise<Order[]>` (newest first, items included).
  - `getLatestDetailsForUser(userId: string): Promise<CheckoutDetails | null>`.
  - `listOrdersForAdmin(status?: OrderStatus): Promise<Order[]>`, `getOrderForAdmin(orderNumber: string): Promise<Order | null>`.
  - `changeOrderStatus(orderId: string, to: OrderStatus, userId?: string): Promise<"ok" | "bad_transition" | "not_found">` — calls `rpc("set_order_status", …)`.
  - `userHasDeliveredProduct(userId: string, productId: string): Promise<boolean>`.

- [ ] **Step 1: Implement** the module (one private mapper from rows to `Order`; log real errors with `console.error`, return generic codes).
- [ ] **Step 2: Run** `npx tsc --noEmit` and `npx eslint lib` — Expected: clean.
- [ ] **Step 3: Commit** `git add lib && git commit -m "Add the orders data layer"`.

---

### Task 4: Checkout

**Files:**
- Create: `app/checkout/page.tsx`, `app/checkout/actions.ts`, `app/components/CheckoutForm.tsx`
- Modify: `app/components/CartView.tsx` (the Checkout button becomes a link to `/checkout`), `proxy.ts` (add `/checkout/:path*` and `/orders/:path*` matchers with the same `missing: next-action` guard)

**Interfaces:**
- Consumes: `planOrder`, `parseCheckoutDetails`, `OrderMessage` (Task 1); `createOrder`, `getLatestDetailsForUser` (Task 3).
- Produces:
  - `placeOrder(lines: unknown, fields: Record<string, string | undefined>, expectedTotal: number, key: string): Promise<{ message: OrderMessage; orderNumber?: string; productId?: string; size?: string; left?: number; total?: number }>` in `app/checkout/actions.ts` (`"use server"`): `requireUser("/checkout")` first; validate `key` is a UUID; `parseCheckoutDetails` (→ `details`); load products, categories, promotions, settings with the cookie-less readers; `planOrder`; `createOrder`; map results to message codes; `revalidatePath` for `/products/<id>` of each item, `/products`, `/` (stock changed).

- [ ] **Step 1: Read** the `node_modules/next/dist/docs/01-app/` guides on dynamic rendering and Server Actions.
- [ ] **Step 2: Implement `/checkout`**: Server Component calling `requireUser("/checkout")`; reads the catalog data cookie-less and `getLatestDetailsForUser(user.id)`; renders `<CheckoutForm products promotions shippingFee categories initialDetails />`. `CheckoutForm` (client): waits for `useCart().hydrated`; empty cart → "Your cart is empty" with a link to `/products`; shows items and totals with `summarizeCart` + `CartTotals`; fields name, phone, address, city, note (prefilled); "Cash on delivery — pay when it arrives" as the only payment line; creates the idempotency `key` once with `useRef(crypto.randomUUID())`-style initial state, calls `placeOrder` in `startTransition`, disables the button while pending; on `placed` calls `clear()` then `router.push("/orders/" + orderNumber)`; on `price_changed` replaces the shown total with the returned one and asks to confirm again (updates `expectedTotal`); on `out_of_stock` names the product and size and the amount left and links to `/cart`; on `details` highlights the fields; `unknown_product`/`error` shows a retry message. All text via `<L>`/`tr`.
- [ ] **Step 3: Wire the cart**: in `CartView` replace the demo `alert` button with `<Link href="/checkout">` styled as the existing button.
- [ ] **Step 4: Run** `npx tsc --noEmit`, `npx eslint app lib`, `npm test` — Expected: clean.
- [ ] **Step 5: Commit** `git add app lib proxy.ts && git commit -m "Add COD checkout"`.

---

### Task 5: Customer orders

**Files:**
- Create: `app/orders/[number]/page.tsx`, `app/orders/[number]/actions.ts`, `app/components/OrderStatusSteps.tsx`
- Modify: `app/account/page.tsx` (add "My orders")

**Interfaces:**
- Consumes: `getOrderForUser`, `listOrdersForUser`, `changeOrderStatus` (Task 3); `canCustomerCancel`, `statusLabel` (Task 1).
- Produces: `cancelMyOrder(orderNumber: string): Promise<{ message: "cancelled" | "not_allowed" | "error" }>` — `requireUser`, loads the order with the user filter, requires `canCustomerCancel`, calls `changeOrderStatus(id, "cancelled", user.id)`, `revalidatePath` for the order page, `/admin/orders`, `/products`, `/` and each item's product page.

- [ ] **Step 1: Implement** the order page (`requireUser`; `notFound()` when `getOrderForUser` returns null; shows number, status steps, items with snapshot prices, totals, delivery details, "Cash on delivery — pay the courier when it arrives", Cancel button via a small client island using `cancelMyOrder`), and the "My orders" list on `/account` (number, date `en-LK` Asia/Colombo, status label, total, link; empty state text).
- [ ] **Step 2: Run** `npx tsc --noEmit`, `npx eslint app lib` — Expected: clean.
- [ ] **Step 3: Commit** `git add app && git commit -m "Add customer order pages and history"`.

---

### Task 6: Admin orders

**Files:**
- Create: `app/admin/orders/page.tsx`, `app/admin/orders/[number]/page.tsx`, `app/admin/orders/actions.ts`, `app/admin/orders/StatusButtons.tsx`
- Modify: `app/admin/AdminTabs.tsx` (tab `"orders"` after Products, label "Orders")

**Interfaces:**
- Consumes: `listOrdersForAdmin`, `getOrderForAdmin`, `changeOrderStatus` (Task 3); `nextStatuses`, `ORDER_STATUSES` (Task 1).
- Produces: `setOrderStatusAction(orderId: string, to: string): Promise<{ error: string | null }>` — `await requireAdmin("/admin/orders")` first; validates the id is a uuid and `to` is in `ORDER_STATUSES`; maps `bad_transition`/`not_found` to messages; revalidates `/admin/orders`, `/orders/<number>`, `/products`, `/` and each item's product page.

- [ ] **Step 1: Implement** the list page (`requireAdmin`, `?status=` filter links, pending first, number/date/customer/total/status per row) and the detail page (items, totals, customer details with `tel:` phone link, address, note, and `StatusButtons` listing only `nextStatuses(order.status)`; Cancel asks `window.confirm`; follow the pattern of `app/admin/reviews/`).
- [ ] **Step 2: Run** `npx tsc --noEmit`, `npx eslint app lib` — Expected: clean.
- [ ] **Step 3: Commit** `git add app && git commit -m "Add admin order management"`.

---

### Task 7: Verified buyer

**Files:**
- Modify: `lib/reviews.ts` (`Review` gains `verified: boolean`), `lib/catalog.ts` (`getProductReviews` selects and maps `verified`), `app/products/[id]/review-actions.ts`, `app/components/ReviewSection.tsx`

**Interfaces:**
- Consumes: `userHasDeliveredProduct` (Task 3).
- Produces: `submitReview` upserts `verified` (true only when the user has a delivered order containing the product; a failure of that lookup counts as false); the review list shows "✓ Verified buyer" (`<L si="තහවුරු කළ ගැනුම්කරු" en="Verified buyer" />`) beside the author when `review.verified`.

- [ ] **Step 1: Implement** the changes (the lookup runs in `submitReview` before the upsert; keep the existing validation order).
- [ ] **Step 2: Run** `npx tsc --noEmit`, `npx eslint app lib`, `npm test` — Expected: clean (fix any `Review` fixtures).
- [ ] **Step 3: Commit** `git add app lib && git commit -m "Mark reviews from verified buyers"`.

---

### Task 8: Docs

**Files:**
- Modify: `CLAUDE.md` (architecture bullet "Orders (COD)": tables, the two SQL functions and why they own the stock work, `planOrder` recompute-on-server rule, idempotency key, routes `/checkout`, `/orders/[number]`, `/admin/orders`, verified-buyer rule, statuses and the plan for `payment_method`/`payment_status` (Part 6 advance + slip, Part 7 points on `delivered`), migration state `20261104100000_orders.sql` run by the owner BEFORE deploy, `proxy.ts` matcher additions)

- [ ] **Step 1: Edit CLAUDE.md**, keeping its existing style; update the Routes sentence and the "Server vs client" list for `CheckoutForm`.
- [ ] **Step 2: Commit** `git add CLAUDE.md && git commit -m "Document orders"`.

---

### Task 9: Owner migration and verification

- [ ] **Step 1: Ask the owner** to run `supabase/migrations/20261104100000_orders.sql` in the SQL editor and say "done". Stop until they do.
- [ ] **Step 2: Run** `npm test`, `npm run lint`, `npm run build` — Expected: all green; `/` and `/products/[id]` still static/ISR.
- [ ] **Step 3: Browser check** (test data cleaned afterwards; the dev browser may already be signed in as an admin who can also act as a customer): checkout with an empty cart; place an order for an untracked product; set a tracked size's stock to 2 and order 2 (stock becomes 0, the pill shows sold out); try to order 3 of another tracked size with stock 1 and read the out-of-stock message; double-click the place button (one order); cancel in `/orders/<n>` and confirm stock returns; admin moves Pending → Confirmed → Shipped → Delivered; after Delivered a review on that product shows "Verified buyer" once approved; opening another user's order number 404s (use a made-up number); Sinhala and English; phone width. Restore every product's stock, delete test orders/reviews (via admin where possible; if a test order cannot be removed from the UI, tell the owner which `NB-` numbers to delete) and the test cart lines.
- [ ] **Step 4: Commit** any fixes found, each with its failing test first when it is a pure-rule bug.

---

## Final steps (executor)

- Final whole-branch review by one fresh Opus reviewer using the Review Focus list above; fix Critical/Important findings in one TDD pass; list Minors in the PR body.
- Open the PR from `feat/orders-cod` into `main` (body ends with the 🤖 Generated with Claude Code line). Do not merge until the owner says "merge".
