# Advance payment by bank transfer, slips and trusted customers (Part 6)

## Understanding

Customers who are not yet trusted must pay a small advance by bank transfer, and upload a photo of the slip, to place a COD order. The admin checks the slip; an approved advance makes the customer **trusted**, and trusted customers order with plain COD (no advance) from then on. The owner can also mark customers trusted by hand (good relationship) and take it away again. Said by the owner: the small advance itself is the verification (no separate verification step); the amount is set by the admin as either a fixed amount or a percentage (admin chooses the mode); the admin page can hold the bank details and a few bank QR images. Later (not here): when a payment gateway exists, "pay first and get a gift or discount". Assumptions: the order is placed first and the slip is uploaded from the order page (the order id is needed for the upload path); an advance order cannot be Confirmed until its advance is approved; no automatic refunds or auto-cancel; no email/SMS; Sinhala/English via `<L>` for customer text, admin pages English; money in cents.

## Global constraints

- Next.js 16 / React 19; read `node_modules/next/dist/docs/` before Next code. Catalog pages stay static/ISR; the root layout must not call `auth()`. Checkout, order and admin pages are dynamic.
- Server Actions return message **codes**; every admin action starts with `await requireAdmin(...)`; customer actions start with `requireUser(...)` and take the user id from the session only.
- Every `public` table has RLS. Migrations are additive, saved in `supabase/migrations/`, and applied by the owner in the SQL editor BEFORE the code is deployed. Never apply them yourself.
- The browser never decides the advance amount or trusted state: the server computes both.
- Payment details, QR images and slips are private: private storage buckets, private tables (no client grants), short-lived signed URLs.
- Pure rules are unit-tested in `lib/*.test.ts`.

## 1. Data (migration `20261105100000_advance_payments.sql`)

- `public.payment_settings` (single row, `id boolean primary key default true check (id)`): `advance_mode text not null default 'off'` check in (`off`,`fixed`,`percent`); `advance_fixed int not null default 50000`; `advance_percent int not null default 10` check 1..100; `advance_min int not null default 50000`; `advance_max int not null default 500000` (cents); `bank_name`, `bank_account_name`, `bank_account_number`, `bank_branch`, `bank_note` (text, default `''`, length-limited). RLS on, `revoke all` from `anon, authenticated`, no policies (read and written only with the secret key). Default mode `off`, so deploying changes nothing until the admin turns it on.
- `public.bank_qr_codes`: `id uuid pk`, `path text unique not null`, `label text not null default ''` (≤ 40), `sort_order int not null`. At most 4 rows (enforced in the app action and by a check on `sort_order between 0 and 3` with `unique (sort_order)`). Same RLS as above.
- `public.payment_slips`: `id uuid pk`, `order_id uuid references orders on delete cascade`, `path text unique not null`, `status text not null default 'pending'` check in (`pending`,`approved`,`rejected`), `reject_reason text` (≤ 200), `created_at`, `reviewed_at`. Same RLS.
- `orders`: add `advance_amount int not null default 0 check (advance_amount >= 0)`; widen `payment_method` to (`cod`,`cod_advance`) and `payment_status` to (`unpaid`,`advance_due`,`slip_uploaded`,`advance_paid`) (drop and re-add the two check constraints). A trusted customer's order stays `cod` / `unpaid` / 0.
- `users`: add `cod_trusted boolean not null default false`, `cod_trusted_source text check (cod_trusted_source in ('advance','admin'))`.
- Storage: private buckets `payment-qr` and `payment-slips` (created in the migration with `public = false`, no storage policies for `anon`/`authenticated`).
- Functions (all `security definer`, `set search_path = public`, `revoke ... from public, anon, authenticated`, `grant execute ... to service_role`):
  - `place_order(...)` replaced with an extra `p_advance int`: when `p_advance > 0` the order is inserted as `cod_advance` / `advance_due` with `advance_amount = p_advance` (must be `<= total`); the existing pending cap, stock locking and idempotency are unchanged. The old 5-argument function is dropped.
  - `set_order_status(...)` additionally raises `advance_unpaid` when moving to `confirmed` an order whose `advance_amount > 0` and `payment_status <> 'advance_paid'`.
  - `add_payment_slip(p_order_id uuid, p_user_id uuid, p_path text) returns uuid`: locks the order; the order must belong to the user, not be cancelled, have `advance_amount > 0` and `payment_status in ('advance_due','slip_uploaded')`; at most 3 slips per order; inserts the slip as `pending` and sets `payment_status = 'slip_uploaded'`.
  - `review_payment_slip(p_slip_id uuid, p_approve boolean, p_reason text) returns void`: locks the slip's order; the slip must be `pending`; approve: slip `approved`, order `payment_status = 'advance_paid'`, user `cod_trusted = true` (and `cod_trusted_source = coalesce(cod_trusted_source, 'advance')`); reject: slip `rejected` with the reason, and the order goes back to `advance_due` when no other slip is pending.

## 2. Pure rules

`lib/advance.ts`: `type AdvanceSettings`; `advanceFor(total: number, s: AdvanceSettings): number` (`off` → 0; `fixed` → `min(advance_fixed, total)`; `percent` → `round(total * pct / 100)` clamped to `[advance_min, advance_max]` then to `total`; never negative); `advanceRequired(trusted: boolean, s): boolean` (false when trusted or mode `off`); `parseAdvanceSettings(fields)` (whole-rupee inputs to cents, percent 1-100, `min <= max`, text limits, control characters rejected); slip helpers `slipPathFor(orderId, contentType, now, rand)`, `isValidSlipPath(orderId, path)` (this order's folder only, no `..`, allowed extensions `jpg|png|webp|pdf`), `SLIP_MAX_BYTES = 5 MB`, `MAX_SLIPS = 3`; `paymentStatusLabel(status)` (si/en). `lib/orders.ts` gains the new payment statuses and `OrderMessage` code `advance_setup` (advance required but bank details empty).

## 3. Admin

- New tab **Payments** (`/admin/payments`): advance mode and numbers (a live preview of the advance for a sample order total), the bank fields, and up to 4 QR images (upload straight to the private bucket with a signed upload URL, a label, reorder, remove). Server code `lib/admin-payments.ts`, `app/admin/payments/actions.ts`.
- New tab **Customers** (`/admin/customers`): up to 200 customers newest first (name, email, orders count, trusted yes/no and its source); a toggle sets or clears `cod_trusted` (source `admin` when set by hand). `lib/admin-customers.ts`, `app/admin/customers/actions.ts`.
- `/admin/orders/[number]` gains a **Payment** section: advance amount, payment status, the slips with a 60-second signed view link each, **Approve** and **Reject** (with a reason, up to 200 chars) via `review_payment_slip`; a warning when cancelling an order whose advance was paid ("refund it by hand"). `StatusButtons` hides **Mark confirmed** until the advance is approved.

## 4. Customer

- **Checkout:** the server loads the customer's `cod_trusted` and the payment settings. When `advanceRequired`, the page shows "Advance Rs X by bank transfer now, Rs Y when it arrives" and the order is placed as an advance order; if the bank details are empty and an advance is required the action returns `advance_setup` (the admin has not finished setting up payments) instead of placing the order. Trusted customers and mode `off` see plain COD as in Part 5. `placeOrder` computes the advance itself with `advanceFor` and passes it to `place_order`.
- **Order page** (`/orders/[number]`): for `advance_due` / `slip_uploaded` the customer sees the amount to pay, the bank details, the QR images (signed URLs generated on the server per request) and a slip uploader: `requestSlipUpload(orderNumber, contentType, size)` (ownership and state checked, returns a signed upload URL for `slipPathFor(...)` in `payment-slips`), the browser uploads, then `attachSlip(orderNumber, path)` (checks the path with `isValidSlipPath`, that the file exists, and calls `add_payment_slip`). Their slips are listed with status and any reject reason; a rejected order can upload again (up to `MAX_SLIPS`). Totals show "Advance paid" and "To pay on delivery = total − advance" once approved.
- `/account` shows "✓ Verified customer" for trusted customers.

## Testing

Vitest: `advanceFor` (off, fixed above total, percent rounding, min, max, cap at total), `advanceRequired`, `parseAdvanceSettings` (bad percent, min above max, negative, huge), `isValidSlipPath` (own folder ok; other order's folder, `..`, wrong extension, empty rejected), `slipPathFor`, payment labels. Browser (test data cleaned afterwards; stock restored): admin sets mode and bank details and uploads a QR; an untrusted customer places an advance order and uploads a slip; the order cannot be confirmed until approved; approve makes the customer trusted and their next order is plain COD; reject lets them upload again; another customer cannot upload to or view the slip; Sinhala/English; phone width; `npm run build` keeps `/` and `/products/[id]` static.

## Review focus

- The advance amount and trusted state can't be tampered with from the browser; an advance order can't be confirmed without an approved slip (also with two admins racing).
- Slip and QR files are never public: no public URL, bucket private, signed URLs expire, path traversal and another order's folder rejected.
- A customer cannot attach a slip to, or read slips of, another customer's order; non-admins cannot approve, reject or trust anyone.
- Approving twice, rejecting an approved slip, uploading to a cancelled order, more than 3 slips.
- Cancelling an advance-paid order keeps working (stock restored, warning shown); trusted toggled off mid-checkout.
- Mode `off` or empty bank details never strands a customer in a half-placed order.
- Existing Part 5 orders (`cod`/`unpaid`, no advance) keep working.

## Out of scope

Payment gateway and "pay first, get a gift/discount" (later), automatic refunds, auto-cancel of orders whose advance never arrives, email/SMS, loyalty points (Part 7).
