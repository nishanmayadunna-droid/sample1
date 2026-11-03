# Advance payments, slips and trusted customers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Untrusted customers pay a small bank-transfer advance (amount set by the admin) and upload a slip; the admin approves it, which makes the customer trusted for plain COD; the admin can also trust or untrust customers by hand.

**Architecture:** One additive migration (private settings/QR/slip tables, private buckets, `orders.advance_amount`, `users.cod_trusted`, and `service_role`-only SQL functions that do the payment-state changes atomically). Pure, tested rules in `lib/advance.ts`; a server-only data layer (`lib/payments-data.ts`); the server computes the advance and trusted state; files live in private buckets and are shown through short-lived signed URLs.

**Tech Stack:** Next.js 16.2 App Router, React 19.2, Supabase (secret-key writes, private Storage, SQL functions via `rpc`), Auth.js v5, Tailwind v4, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-05-advance-payments-design.md`

## Global Constraints

- Read the relevant guide under `node_modules/next/dist/docs/` before writing Next code. Catalog pages stay static/ISR; the root layout must not call `auth()`; checkout, order and admin pages are dynamic.
- Customer strings in `<L si en>` (attributes via `tr`); admin pages English; Server Actions return message **codes**; every admin action starts with `await requireAdmin(...)`; customer actions start with `requireUser(...)` (user id from the session only).
- Every `public` table has RLS. Migrations are saved in `supabase/migrations/` and applied by the OWNER in the SQL editor BEFORE deploy. Never apply them yourself, never work around a denied permission.
- The browser never decides the advance amount or trusted state. Payment details, QR images and slips are private (private buckets, no client grants, signed URLs ≤ 60 s for slips and QR).
- Money in cents; never print or read secrets. Windows/CRLF: write helper scripts to files (not shell one-liners with apostrophes), prefer the Edit/Write tools, and when a Bash step chains `tsc && …; git commit` remember `;` still commits — run checks first and commit only when green.
- Payment methods: `cod`, `cod_advance`. Payment statuses: `unpaid`, `advance_due`, `slip_uploaded`, `advance_paid`.

## Review Focus

- Advance amount and trusted state can't be tampered with from the browser; an advance order can't be confirmed without an approved slip. Pinned in Task 1 (`advanceFor`), Task 2 (`set_order_status` `advance_unpaid`), Task 4 (server computes) and Task 10.
- Slip/QR files never public; traversal and another order's folder rejected. Pinned in Task 1 (`isValidSlipPath`), Task 2 (private buckets), Task 5 and Task 10.
- A customer cannot attach a slip to, or view slips of, another customer's order; non-admins cannot approve/reject/trust. Pinned in Task 2 (`add_payment_slip` ownership), Tasks 5–8 (guards) and Task 10.
- Approving twice, rejecting an approved slip, uploading to a cancelled order, more than 3 slips. Pinned in Task 2 (function guards) and Task 1 (`MAX_SLIPS`).
- Cancelling an advance-paid order still restores stock and warns the admin about the refund. Pinned in Task 8.
- Mode `off` or empty bank details never strands a customer in a half-placed order. Pinned in Task 1 (`advanceRequired`) and Task 4 (`advance_setup` before `place_order`).
- Existing Part 5 orders (`cod`/`unpaid`) keep working. Pinned in Task 2 (defaults) and Task 10.

---

### Task 1: Advance rules (pure)

**Files:**
- Create: `lib/advance.ts`
- Modify: `lib/orders.ts` (payment method/status types and labels, `advance_setup` message code)
- Test: `lib/advance.test.ts`, extend `lib/orders.test.ts`

**Interfaces:**
- Produces (`lib/advance.ts`):
  - `type AdvanceMode = "off" | "fixed" | "percent"`; `type AdvanceSettings = { mode: AdvanceMode; fixed: number; percent: number; min: number; max: number }` (cents; `percent` 1–100).
  - `advanceFor(total: number, s: AdvanceSettings): number` — `off` → 0; `fixed` → `min(fixed, total)`; `percent` → `round(total * percent / 100)` clamped to `[min, max]` then to `total`; never negative, never above `total`.
  - `advanceRequired(trusted: boolean, s: AdvanceSettings): boolean` — false when trusted or mode `off`.
  - `parseAdvanceSettings(fields: Record<string, string | undefined>): { ok: true; value: AdvanceSettings & BankDetails } | { ok: false; errors: Partial<Record<string, string>> }` where `BankDetails = { bankName; accountName; accountNumber; branch; note }` (text, each ≤ 120 chars, `note` ≤ 500, control characters other than newline rejected); fields `mode`, `fixed`, `percent`, `min`, `max` come as rupee strings (whole or `850.00`) → cents via `parsePriceToCents`-style integer math (blank/zero allowed only for `min`); percent integer 1–100; `min <= max`; amounts under Rs 1,000,000.
  - `SLIP_MAX_BYTES = 5 * 1024 * 1024`; `MAX_SLIPS = 3`; `SLIP_TYPES = ["image/jpeg","image/png","image/webp","application/pdf"]`.
  - `slipPathFor(orderId: string, contentType: string, now: number, rand: string): string | null` → `<orderId>/<now>-<rand>.<ext>` (ext from the type; null for an unsupported type; `rand` is `[a-z0-9]{6,12}`).
  - `isValidSlipPath(orderId: string, path: string): boolean` — exactly this order's folder, one segment after it, `[a-z0-9-]` base name, extension `jpg|png|webp|pdf`; rejects `..`, extra slashes, other orders' folders, empty.
  - `PaymentStatus = "unpaid"|"advance_due"|"slip_uploaded"|"advance_paid"`; `paymentStatusLabel(s): { si: string; en: string }`.
- Produces (`lib/orders.ts`): `type PaymentMethod = "cod" | "cod_advance"`, `type PaymentStatus` (re-exported or defined here and imported by advance.ts — keep one definition), `OrderMessage` gains `"advance_setup"`.

- [ ] **Step 1: Write failing tests.** `advance.test.ts`: `advanceFor` — off → 0; fixed 50000 on total 1000000 → 50000, on total 30000 → 30000 (cap); percent 10 on 1000000 → 100000; percent 10 on 100000 with min 50000 → 50000; percent 50 on 10000000 with max 500000 → 500000; percent rounding (333 cents at 10% → 33); total 0 → 0. `advanceRequired` — trusted false, off false, untrusted fixed/percent true. `parseAdvanceSettings` — valid fixed and percent forms; percent 0/101/2.5 rejected; `min` above `max` rejected; negative and `abc` rejected; amount 1,000,000 rejected; over-long bank name; control char in note; mode not in the list. `slipPathFor`/`isValidSlipPath` — round trip is valid; `../x.jpg`, `other-order/1-abc.jpg`, `order/a/b.jpg`, `order/1-abc.exe`, `""`, a path for a different order id all invalid; unsupported type → null. Labels exist for all four statuses.
- [ ] **Step 2: Run** `npx vitest run lib/advance.test.ts lib/orders.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement** `lib/advance.ts` and the `lib/orders.ts` additions to the Interfaces block (integer money math only).
- [ ] **Step 4: Run** the same command, then `npm test`, `npx tsc --noEmit` — Expected: green.
- [ ] **Step 5: Commit** `git add lib && git commit -m "Add pure advance payment rules"` (end with the session's Co-Authored-By line).

---

### Task 2: Migration

**Files:**
- Create: `supabase/migrations/20261105100000_advance_payments.sql`

**Interfaces:**
- Produces (database), exactly as the spec's Data section: `payment_settings` (single row, default mode `off`), `bank_qr_codes` (`sort_order` 0–3, unique), `payment_slips`, `orders.advance_amount`, widened `orders.payment_method`/`payment_status` checks (drop `orders_payment_method_check` and `orders_payment_status_check`, re-add), `users.cod_trusted` + `cod_trusted_source`, private buckets `payment-qr` and `payment-slips` (`insert into storage.buckets (id, name, public) values (..., false) on conflict do nothing`), and the functions:
  - `place_order(p_user_id uuid, p_key uuid, p_customer jsonb, p_totals jsonb, p_items jsonb, p_advance integer) returns text` — drop the 5-argument version first; same body as `20261104110000_orders_hardening.sql` plus: raise `bad_advance` when `p_advance < 0` or `p_advance > total`; when `p_advance > 0` insert `payment_method = 'cod_advance'`, `payment_status = 'advance_due'`, `advance_amount = p_advance`.
  - `set_order_status(...)` — same body as the hardening version plus: when moving to `confirmed`, raise `advance_unpaid` if `advance_amount > 0 and payment_status <> 'advance_paid'`.
  - `add_payment_slip(p_order_id uuid, p_user_id uuid, p_path text) returns uuid` and `review_payment_slip(p_slip_id uuid, p_approve boolean, p_reason text) returns void`, behaving exactly as the spec describes (errors raised: `order_not_found`, `bad_state`, `too_many_slips`, `slip_not_found`, `slip_not_pending`).
- All new functions: `security definer`, `set search_path = public`, `revoke all ... from public, anon, authenticated`, `grant execute ... to service_role`. All new tables: RLS on, `revoke all` from `anon, authenticated`, no policies.

- [ ] **Step 1: Write the migration** per the Interfaces block and spec (`review_payment_slip` locks the slip's order row with `for update` before reading the slip status, so two admins racing approve once; approving sets `users.cod_trusted = true` and `cod_trusted_source = coalesce(cod_trusted_source, 'advance')`; rejecting returns the order to `advance_due` only when no other slip is `pending`; both refuse a cancelled order). Header comment: run by the owner in the SQL editor BEFORE deploying.
- [ ] **Step 2: Read the SQL once** against the spec and `20261104110000_orders_hardening.sql` (same locking order, `jsonb_typeof` guards kept, existing grants repeated for the replaced functions). Do NOT apply it.
- [ ] **Step 3: Commit** `git add supabase && git commit -m "Add advance payment schema and functions"`.

---

### Task 3: Payments data layer

**Files:**
- Create: `lib/payments-data.ts` (`import "server-only"`, `supabaseAdmin`)
- Modify: `lib/orders-data.ts` (`Order` gains `advanceAmount`, `paymentMethod: PaymentMethod`, `paymentStatus: PaymentStatus`; select the new columns; `createOrder(..., advance: number)` passes `p_advance`; map `bad_advance` → `error`)

**Interfaces:**
- Consumes: Task 1 types, Task 2 database objects.
- Produces (`lib/payments-data.ts`):
  - `type PaymentSettings = AdvanceSettings & BankDetails`; `getPaymentSettings(): Promise<PaymentSettings>` (secret key; row missing → defaults with mode `off`); `savePaymentSettings(value: PaymentSettings): Promise<void>`; `bankDetailsComplete(s: PaymentSettings): boolean` (bank name, account name and account number non-empty).
  - `type QrCode = { id: string; path: string; label: string; sortOrder: number }`; `listQrCodes(): Promise<QrCode[]>`; `addQrCode(path: string, label: string): Promise<"ok" | "full">`; `removeQrCode(id: string): Promise<string | null>` (returns the path, then best-effort deletes the file); `createQrUpload(path: string)` and `createSlipUpload(path: string)` (signed upload URLs); `qrSignedUrls(codes: QrCode[]): Promise<{ id: string; label: string; url: string }[]>` (60 s); `objectExists(bucket: "payment-qr" | "payment-slips", path: string): Promise<boolean>`.
  - `type Slip = { id: string; orderId: string; path: string; status: "pending" | "approved" | "rejected"; rejectReason: string | null; createdAt: string }`; `listSlipsForOrder(orderId: string): Promise<Slip[]>`; `attachSlip(orderId: string, userId: string, path: string): Promise<"ok" | "bad_state" | "too_many" | "not_found">` (rpc `add_payment_slip`); `reviewSlip(slipId: string, approve: boolean, reason: string): Promise<"ok" | "not_found" | "not_pending" | "bad_state">`; `slipSignedUrl(path: string): Promise<string | null>` (60 s).
  - `isUserTrusted(userId: string): Promise<boolean>`; `type AdminCustomer = { id: string; name: string | null; email: string; trusted: boolean; trustedSource: "advance" | "admin" | null; orderCount: number; createdAt: string }`; `listCustomersForAdmin(): Promise<AdminCustomer[]>` (limit 200, newest first; order counts from one grouped query); `setUserTrusted(userId: string, trusted: boolean): Promise<boolean>` (source `admin` when set, cleared when unset; false when no such user).

- [ ] **Step 1: Implement** both files (log real errors with `console.error`, return the codes above; private helpers for bucket access).
- [ ] **Step 2: Run** `npx tsc --noEmit`, `npx eslint lib`, `npm test` — Expected: clean.
- [ ] **Step 3: Commit** `git add lib && git commit -m "Add the payments data layer"`.

---

### Task 4: Checkout with advance

**Files:**
- Modify: `app/checkout/page.tsx`, `app/checkout/actions.ts`, `app/components/CheckoutForm.tsx`

**Interfaces:**
- Consumes: `advanceFor`, `advanceRequired` (Task 1); `getPaymentSettings`, `bankDetailsComplete`, `isUserTrusted` (Task 3); `createOrder` with `advance` (Task 3).
- Produces: `placeOrder` unchanged in signature; after `planOrder` succeeds it loads `isUserTrusted(user.id)` and the payment settings, computes `required = advanceRequired(trusted, settings)`; when `required && !bankDetailsComplete(settings)` returns `{ message: "advance_setup" }` BEFORE calling `createOrder`; otherwise `advance = required ? advanceFor(plan.totals.total, settings) : 0` and passes it to `createOrder`. The checkout page passes `advance: { required: boolean; settingsMode; ... }` as a plain prop: `advanceInfo: { required: boolean; mode: AdvanceMode; fixed; percent; min; max } | null` (null when not required) so the form can show the advance for the current cart with the same `advanceFor`.

- [ ] **Step 1: Implement** the server side (`page.tsx` loads trusted + settings; `actions.ts` as above; message code `advance_setup`).
- [ ] **Step 2: Implement `CheckoutForm`**: when `advanceInfo` is present show "Advance Rs X by bank transfer after you place the order (bank details and slip upload are on the next page), and Rs Y when it arrives" (`<L>`), the place-order button text unchanged; handle `advance_setup` with a bilingual "Payments aren't set up yet, please contact us" message. Trusted/off customers see exactly the Part 5 form.
- [ ] **Step 3: Run** `npx tsc --noEmit`, `npx eslint app lib`, `npm test` — Expected: clean.
- [ ] **Step 4: Commit** `git add app lib && git commit -m "Show and charge the advance at checkout"`.

---

### Task 5: Customer payment and slip upload

**Files:**
- Create: `app/orders/[number]/payment-actions.ts`, `app/components/PaymentPanel.tsx`
- Modify: `app/orders/[number]/page.tsx`

**Interfaces:**
- Consumes: Task 3 (`getPaymentSettings`, `listQrCodes`, `qrSignedUrls`, `listSlipsForOrder`, `createSlipUpload`, `objectExists`, `attachSlip`), Task 1 (`slipPathFor`, `isValidSlipPath`, `SLIP_MAX_BYTES`, `SLIP_TYPES`, `MAX_SLIPS`).
- Produces:
  - `requestSlipUpload(orderNumber: string, contentType: string, size: number): Promise<{ path: string; token: string } | { error: "not_allowed" | "bad_file" | "error" }>` — `requireUser`; loads the order with the user filter; requires `advanceAmount > 0`, status not `cancelled`, `paymentStatus` in `advance_due | slip_uploaded`, fewer than `MAX_SLIPS` slips; validates type and size; returns a signed upload URL for `slipPathFor(order.id, contentType, Date.now(), random)`.
  - `attachPaymentSlip(orderNumber: string, path: string): Promise<{ message: "saved" | "not_allowed" | "bad_file" | "too_many" | "error" }>` — `requireUser`; order with user filter; `isValidSlipPath(order.id, path)`; `objectExists("payment-slips", path)`; `attachSlip(order.id, user.id, path)`; `revalidatePath` for the order page and `/admin/orders`.
  - `PaymentPanel` (client) props: `orderNumber`, `advanceAmount`, `total`, `paymentStatus`, `bank: { bankName, accountName, accountNumber, branch, note }`, `qr: { id, label, url }[]`, `slips: { id, status, rejectReason, createdAt }[]`, `canUpload: boolean`. Shows amount to pay now and the rest on delivery, the bank details, the QR images, the slip list with status chips and reject reasons, and a file input (JPEG/PNG/WebP/PDF ≤ 5 MB) that calls `requestSlipUpload`, uploads with `createClient().storage.from("payment-slips").uploadToSignedUrl(path, token, file)` (same pattern as `ProductForm`), then calls `attachPaymentSlip` and `router.refresh()`.
- The order page renders `PaymentPanel` when `order.advanceAmount > 0` (payment details and signed QR URLs are fetched server-side per request); shows "Advance paid Rs X" and "To pay on delivery = total − advance" when `advance_paid`; the existing Part 5 payment text for plain COD.

- [ ] **Step 1: Read** the `node_modules/next/dist/docs/01-app/` guide on Server Actions and look at how `ProductForm` calls `uploadToSignedUrl`.
- [ ] **Step 2: Implement** the actions, `PaymentPanel` and the page changes.
- [ ] **Step 3: Run** `npx tsc --noEmit`, `npx eslint app lib`, `npm test` — Expected: clean.
- [ ] **Step 4: Commit** `git add app lib && git commit -m "Add advance payment panel and slip upload"`.

---

### Task 6: Admin payments settings

**Files:**
- Create: `app/admin/payments/page.tsx`, `app/admin/payments/actions.ts`, `app/admin/payments/PaymentSettingsForm.tsx`, `app/admin/payments/QrManager.tsx`, `lib/admin-payments.ts` only if the pages need a wrapper beyond `lib/payments-data.ts` (otherwise reuse it)
- Modify: `app/admin/AdminTabs.tsx` (tab `"payments"` after Orders, label "Payments")

**Interfaces:**
- Consumes: `parseAdvanceSettings`, `advanceFor` (Task 1); Task 3 (`getPaymentSettings`, `savePaymentSettings`, `listQrCodes`, `addQrCode`, `removeQrCode`, `createQrUpload`, `objectExists`, `qrSignedUrls`).
- Produces (`app/admin/payments/actions.ts`, every action starting with `await requireAdmin("/admin/payments")`): `savePaymentSettingsAction(prev, formData): Promise<{ errors: Record<string,string>; saved?: boolean }>`; `requestQrUpload(contentType: string, size: number): Promise<{ path: string; token: string } | { error: string }>` (JPEG/PNG/WebP ≤ 5 MB, path `qr-<epoch>-<rand>.<ext>`); `addQrAction(path: string, label: string)` (validates the path pattern, existence, label ≤ 40, max 4); `removeQrAction(id: string)`. Revalidate `/admin/payments`, `/checkout`, `/orders/[number]` paths as appropriate (`revalidatePath("/orders/[number]", "page")`).
- The page shows: mode radio (Off / Fixed / Percent) with the fields that apply, a live preview "advance for an order of Rs [input]" using `advanceFor`, the bank fields, and `QrManager` (grid of QR thumbnails via `qrSignedUrls`, label input, upload, remove; max 4).

- [ ] **Step 1: Implement** the files following the patterns of `app/admin/settings/` and the photo upload in `ProductForm.tsx`.
- [ ] **Step 2: Run** `npx tsc --noEmit`, `npx eslint app lib`, `npm test` — Expected: clean.
- [ ] **Step 3: Commit** `git add app lib && git commit -m "Add admin payments settings and bank QR upload"`.

---

### Task 7: Admin customers and verified badge

**Files:**
- Create: `app/admin/customers/page.tsx`, `app/admin/customers/actions.ts`, `app/admin/customers/TrustToggle.tsx`
- Modify: `app/admin/AdminTabs.tsx` (tab `"customers"` after Payments), `app/account/page.tsx` ("✓ Verified customer")

**Interfaces:**
- Consumes: `listCustomersForAdmin`, `setUserTrusted`, `isUserTrusted` (Task 3).
- Produces: `setTrustedAction(userId: string, trusted: boolean): Promise<{ error: string | null }>` — `await requireAdmin("/admin/customers")` first; validates the id is a uuid; calls `setUserTrusted`; revalidates `/admin/customers` and `/account`.

- [ ] **Step 1: Implement** the list page (name, email, orders count, trusted yes/no with source, toggle with a `window.confirm` when removing trust) and the account badge (`<L si="තහවුරු කළ පාරිභෝගික" en="Verified customer" />`, shown only when `isUserTrusted`; a failed lookup hides the badge).
- [ ] **Step 2: Run** `npx tsc --noEmit`, `npx eslint app lib`, `npm test` — Expected: clean.
- [ ] **Step 3: Commit** `git add app lib && git commit -m "Add admin customers and the verified customer badge"`.

---

### Task 8: Admin order payment review

**Files:**
- Create: `app/admin/orders/PaymentReview.tsx`
- Modify: `app/admin/orders/[number]/page.tsx`, `app/admin/orders/StatusButtons.tsx`, `app/admin/orders/actions.ts`

**Interfaces:**
- Consumes: `listSlipsForOrder`, `slipSignedUrl`, `reviewSlip` (Task 3); `paymentStatusLabel` (Task 1).
- Produces: `reviewSlipAction(slipId: string, approve: boolean, reason: string): Promise<{ error: string | null }>` in `app/admin/orders/actions.ts` — `await requireAdmin("/admin/orders")` first; validates uuid, `reason` ≤ 200 chars (required when rejecting); maps `not_pending`/`bad_state`/`not_found` to messages; revalidates `/admin/orders`, the order pages and `/account`. The admin order page shows a **Payment** section (advance amount, `paymentStatusLabel`, each slip with a "View" link to `slipSignedUrl`, status and reason, and `PaymentReview` Approve/Reject buttons for pending slips; a reject asks for a reason with `window.prompt`). `StatusButtons` gets a prop `advanceUnpaid: boolean` and hides "Mark confirmed" with the note "Waiting for the advance" while true; its cancel confirm text adds "The advance was paid: refund it by hand." when `advance_paid`. `changeOrderStatus` maps the database error `advance_unpaid` to a message.

- [ ] **Step 1: Implement** the changes (`lib/orders-data.ts` `changeOrderStatus` returns `"advance_unpaid"` as an extra result).
- [ ] **Step 2: Run** `npx tsc --noEmit`, `npx eslint app lib`, `npm test` — Expected: clean.
- [ ] **Step 3: Commit** `git add app lib && git commit -m "Review advance slips on the admin order page"`.

---

### Task 9: Docs

**Files:**
- Modify: `CLAUDE.md` (architecture bullet "Advance payments (Part 6)": private tables and buckets, why payment changes go through `add_payment_slip`/`review_payment_slip`/`set_order_status` SQL functions, server-computed advance (`advanceFor`/`advanceRequired`), trusted rule (advance approved or admin toggle), `advance_setup` guard, signed URL lifetimes, routes `/admin/payments`, `/admin/customers`, the migration state `20261105100000_advance_payments.sql` run by the owner BEFORE deploy, and the note that default mode is `off`; update the Orders bullet's "Later parts" sentence)

- [ ] **Step 1: Edit CLAUDE.md** in its existing style.
- [ ] **Step 2: Commit** `git add CLAUDE.md && git commit -m "Document advance payments"`.

---

### Task 10: Owner migration and verification

- [ ] **Step 1: Ask the owner** to run `supabase/migrations/20261105100000_advance_payments.sql` in the SQL editor and say "done". Stop until they do.
- [ ] **Step 2: Run** `npm test`, `npm run lint`, `npm run build` — Expected: all green; `/` and `/products/[id]` still static.
- [ ] **Step 3: Browser check** (the dev browser may be signed in as an admin who is also a customer; the admin account is untrusted by default for this purpose; restore everything afterwards): `/admin/payments` set mode Fixed Rs 500 plus bank details and upload a QR; place an order and see the advance panel; try Mark confirmed (blocked); upload a slip (a small PNG) and see it in the admin order; Reject with a reason, upload again, Approve; the customer is now trusted (`/admin/customers`, `/account` badge) and the next order has no advance; toggle trust off and on; switch to Percent and check the preview; set mode Off; a made-up order number on the slip actions is refused; Sinhala and English; phone width. Cleanup: cancel the test orders, set mode back to Off, remove the test QR, clear test bank details, set the admin account's trust back to its original state, and tell the owner which `NB-` orders and slip files remain (orders cannot be deleted from the UI).
- [ ] **Step 4: Commit** any fixes found, each with its failing test first when it is a pure-rule bug.

---

## Final steps (executor)

- Final whole-branch review by one fresh Opus reviewer using the Review Focus list above (also tell it to read the migration line by line as a Postgres expert); fix Critical/Important findings in one TDD pass; list Minors in the PR body.
- Open the PR from `feat/advance-payments` into `main` (body ends with the 🤖 Generated with Claude Code line). Do not merge until the owner says "merge".
