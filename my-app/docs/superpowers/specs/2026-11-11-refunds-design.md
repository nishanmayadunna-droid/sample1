# Refunds for cancelled advance orders (Part 16)

## Understanding

When an order whose advance was **approved** (`payment_status = 'advance_paid'`) is cancelled, the customer's money is still with the shop and the admin currently has to remember to send it back by hand. This part lets the admin **record** each refund (the shop sends the bank transfer itself; nothing is paid from the app), shows how much is still owed, and lets the customer see what was returned. Assumptions: only the advance is ever refunded (COD money is never collected before delivery); only `cancelled` orders qualify; partial refunds are allowed up to the advance; refunds are never edited or deleted (a mistake is fixed by an admin SQL correction, the table is an audit trail); no email/SMS yet (Part 11 / notifications can hook in later); money in cents; customer text in both languages with `<L>`, admin pages English.

## Global constraints

- Next.js 16 / React 19; read `node_modules/next/dist/docs/` before Next code. Admin and order pages are dynamic; catalog pages stay static.
- Server Actions return message **codes/strings**, admin actions start with `await requireAdmin(...)`.
- Every `public` table has RLS. Migration is additive, saved in `supabase/migrations/`, run by the owner in the SQL editor BEFORE the code is deployed. Never apply it yourself.
- Money state changes only inside a `service_role` SQL function, under the order row lock.
- Pure rules are unit-tested in `lib/*.test.ts`.

## 1. Data (migration `20261111100000_refunds.sql`)

- `public.order_refunds`: `id uuid pk default gen_random_uuid()`, `order_id uuid not null references orders(id) on delete restrict`, `amount integer not null check (amount > 0)`, `method text not null check (method in ('bank_transfer','cash','other'))`, `reference text check (char_length(reference) <= 100)`, `note text check (char_length(note) <= 200)`, `idempotency_key text not null unique`, `created_at timestamptz not null default now()`. Index on `order_id`. RLS on, no policies, no grants (all access via the secret key).
- `public.record_refund(p_order_id uuid, p_amount integer, p_method text, p_reference text, p_note text, p_key text) returns uuid` (`security definer`, `set search_path = public`, `service_role` only): if a row with `p_key` exists for the same order, return its id (a double click or retry never refunds twice); lock the order `for update`; raise `order_not_found`; raise `bad_state` unless `status = 'cancelled'`, `payment_status = 'advance_paid'` and `advance_amount > 0`; raise `over_refund` when existing refunds + `p_amount` exceed `advance_amount`; insert and return the id.

## 2. Pure rules (`lib/refunds.ts`)

`REFUND_METHODS`, `refundMethodLabel(method)`; `canRefund(order: { status; paymentStatus; advanceAmount })`; `refundSummary(advanceAmount, refunds[])` → `{ refunded, remaining, state: 'none' | 'partial' | 'full' }`; `parseRefundForm({ amount, method, reference, note }, remaining)` → `{ ok: true, value }` or `{ ok: false, errors }` (amount in rupees → cents via `parsePriceToCents`, > 0 and ≤ `remaining`; method in the list; reference ≤ 100 and note ≤ 200 with no control characters).

## 3. Admin

`/admin/orders/[number]`: for a refundable order, a **Refund** section: "Advance paid Rs X · refunded Rs Y · still owed Rs Z", the list of refunds (date, amount, method, reference, note) and a form (amount prefilled with the remaining, method, reference, note). `recordRefundAction` (`requireAdmin` first, a fresh idempotency key per form render). `/admin/orders` gets a **Refund due** badge on cancelled advance-paid orders that still owe money, and a filter `?view=refunds`.

## 4. Customer

`/orders/[number]`, cancelled order with a paid advance: "Your advance of Rs X will be returned to you" until fully refunded, then "Advance refunded: Rs X on <date>" (partial shows the amount returned so far). Always the session user's own order.

## Testing

Vitest: `canRefund` (each status and payment state), `refundSummary` (none, partial, full), `parseRefundForm` (blank, zero, negative, 2.5 rupees, over remaining, bad method, long note, control characters), method labels. Browser (owner has a cancelled advance-paid test order): refund part, then the rest; refund more than owed is refused; double-submit records one row; customer page text changes; non-refundable orders show no section. Test data cleaned afterwards.

## Review focus

- Never refund more than the advance in total, even with two admins at once (order row lock) or a retried request (idempotency key).
- Only cancelled + advance-paid orders; waived or unpaid advances never qualify.
- Non-admins cannot call the action; customers only see their own order.
- The function and table are unreachable by the public/anon/authenticated roles.

## Out of scope

Refunds after delivery (returns), refunding COD money, automatic payouts, refund emails/SMS, editing or deleting a refund.
