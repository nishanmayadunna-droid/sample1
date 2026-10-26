# Cart Sync to Account — Design

Date: 2026-10-26
Status: Approved in brainstorming, pending written-spec review
Scope: Spec 2 of 2. Builds on Spec 1 (`2026-10-25-nextauth-design.md`, branch
`feat/auth`, PR #1). This work lives on `feat/cart-sync`, branched from `feat/auth`.

## Goal

A signed-in shopper's cart is saved to their account, so it follows them across
devices and browsers. Guests keep today's browser-only cart.

Success means:

- Items added as a guest are kept when the shopper signs in (merged into the
  account cart).
- After signing in on another device, the shopper sees the same cart.
- After signing out, the browser shows an empty cart; signing in again brings the
  account cart back.
- The cart UI stays instant and keeps working if a save fails.
- Catalog pages stay static/ISR, and the `useCart()` API is unchanged.

## Decisions

| Topic | Decision |
|---|---|
| Guest cart on sign-in | Merge with the account cart; for the same `id + size`, keep the **larger** quantity |
| Sign-out | Clear the browser cart |
| Sync model | Browser (`localStorage`) stays the source of truth for the UI; the server is the account's copy |
| Save | Whole cart, debounced 1 second after the last change, via a Server Action |
| Load | On page load and on window focus, replace the browser cart with the account cart |
| Concurrent edits on two devices | Last save wins (whole cart) |

## Data

New migration `supabase/migrations/<version>_create_carts.sql`, applied to the
remote project and saved locally with the matching version.

```sql
create table public.carts (
  user_id    uuid primary key references public.users(id) on delete cascade,
  lines      jsonb not null default '[]'::jsonb,   -- [{ id, size, quantity }]
  updated_at timestamptz not null default now()
);

alter table public.carts enable row level security;
-- No policies. Only the server's secret key can read or write this table.
revoke all on table public.carts from anon, authenticated;
```

One row per user. Saves always replace the whole cart, so a `jsonb` array is
simpler than one row per line.

## Modules

| File | Responsibility |
|---|---|
| `lib/cart-rules.ts` | Pure, no I/O: `CartLine` type, `sanitizeCartLines`, `mergeCartLines`, `decideSync`. |
| `lib/carts.ts` | Server-only: `getCart(userId)`, `saveCart(userId, lines)` (upsert) via `lib/supabase/admin.ts`. |
| `app/cart/actions.ts` | Server Actions `loadAccountCart()` and `saveAccountCart(lines)`. |
| `app/context/CartContext.tsx` | Adds `replaceCart(lines)`, the cart owner key, and a way to observe changes for syncing. `useCart()` is unchanged. |
| `app/components/CartSync.tsx` | Client component that renders nothing and runs the sync. |
| `app/components/Header.tsx` | Renders `CartSync` inside the existing `SessionProvider`. |
| `app/components/SignOutButton.tsx` | Flushes a pending save before signing out. |

`CartLine` moves to `lib/cart-rules.ts` (re-exported from `CartContext.tsx` so
existing imports keep working).

### Pure rules

- `sanitizeCartLines(raw: unknown): CartLine[]`
  - Non-arrays become `[]`.
  - A line is kept only if `id` and `size` are non-empty strings and `quantity`
    is an integer from 1 to 99. Invalid lines are dropped.
  - Duplicate `id + size` lines collapse into one, keeping the larger quantity.
  - At most 50 lines are kept, in input order.
- `mergeCartLines(local, account): CartLine[]`
  - Account lines first, in their order, then local lines not already present.
  - For an `id + size` in both, the larger quantity wins.
  - The result goes through the same 50-line cap.
- `decideSync(input): SyncAction`, where `input` is
  `{ status: "authenticated" | "unauthenticated" | "loading"; userId: string | null; owner: string | null }`
  and the result is one of:
  - `"wait"`: status is `loading`, or authenticated without a `userId`.
  - `"merge"`: authenticated and `owner === null` (a guest cart, just signed in).
  - `"pull"`: authenticated and `owner !== null` — either this user's own cart,
    or another user's leftover cart (session expired without a clear). The
    other user's lines are replaced, never merged into this account.
  - `"clear"`: unauthenticated and `owner !== null`.
  - `"none"`: unauthenticated and `owner === null` (guest).

### Server Actions

- `loadAccountCart(): Promise<CartLine[] | null>`: returns `null` when signed
  out, otherwise the sanitized stored lines (`[]` when there is no row).
- `saveAccountCart(lines: unknown): Promise<void>`: does nothing when signed
  out; otherwise sanitizes and upserts.
- Both take the user id from `auth()` only. A user id sent by the client is
  never trusted.
- Product ids are not checked against the catalog. `CartView` already skips ids
  it can't find (`app/components/CartView.tsx:52`), so a stale id is harmless.

## Client flow

`CartSync` reads `useSession()` and the cart owner, calls `decideSync`, and acts:

| Action | Steps |
|---|---|
| `merge` | `loadAccountCart()` → `mergeCartLines(local, account)` → `replaceCart(merged)` → `saveAccountCart(merged)` → owner = user id |
| `pull` | `loadAccountCart()` → `replaceCart(account)` → owner = user id. No merge, so items removed on another device don't come back. Runs on page load and on window focus. |
| `clear` | `replaceCart([])`, owner = null |
| `none` / `wait` | Nothing |

While the owner is the signed-in user, every cart change schedules
`saveAccountCart` 1 second after the last change.

Rules that keep this correct:

- **No pull while a save is pending.** Otherwise a change the shopper just made
  would be overwritten by the older server copy.
- **Applying a server cart doesn't schedule a save.** No save loops.
- **Sign-out:** `SignOutButton` flushes any pending save, then calls `signOut`.
  After the redirect, `CartSync` sees `clear` and empties the browser cart.
- **Cross-tab:** the owner lives in `localStorage` (`storefront:cart:owner`) next
  to the cart (`storefront:cart:v1`), so tabs share it through the existing
  `storage` event handling.

## Error handling

- A failed load or save is logged with `console.error` and otherwise ignored;
  the browser cart keeps working.
- A failed save is retried on the next cart change or window focus (the pending
  flag stays set until a save succeeds, so a focus pull doesn't overwrite it).
- A failed load during `merge` leaves the owner unset, so the merge is retried on
  the next focus or page load.

## Testing

**Unit (Vitest)** in `lib/cart-rules.test.ts`:

- `sanitizeCartLines`: non-array → `[]`; drops bad `id`/`size`/`quantity`
  (0, 100, 1.5, "2", missing); collapses duplicates keeping the larger quantity;
  caps at 50.
- `mergeCartLines`: disjoint lines keep account-then-local order; overlapping
  line keeps the larger quantity (both directions); result capped at 50.
- `decideSync`: every case listed above, including a different user signing in
  on a browser still owned by someone else (`pull`, not `merge`).

**Manual checklist** (in-app browser, dev server, password test account):

1. As a guest, add 2 items; sign in to an account whose cart has 1 different
   item and 1 overlapping item with a smaller quantity → cart shows 3 lines, the
   overlap at the larger quantity; `select lines from public.carts` matches.
2. Sign out → cart is empty. Sign in again → the 3 lines return.
3. With two tabs signed in, remove an item in tab A, wait 2 seconds, focus tab B
   → tab B no longer shows it.
4. Change a quantity and sign out within 1 second → after signing back in, the
   change is there (flush on sign-out).
5. Guest cart still works with no network calls to the cart actions.

**Build checks:** `npm test`, `npm run lint` and `npm run build` pass; `/`,
`/cart` and `/products/[id]` stay static/ISR.

## Out of scope

- Stock checks, orders and checkout
- Realtime sync between open devices
- Line-level merging of simultaneous edits on two devices
- Showing a sync status or error in the UI
