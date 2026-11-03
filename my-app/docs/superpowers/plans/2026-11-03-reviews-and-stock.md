# Reviews, ratings and real stock Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Customers can leave admin-approved reviews; admins can set per-size stock that disables sold-out sizes and caps the cart. Real data only.

**Architecture:** One additive migration (`reviews` table, `products.stock jsonb`). Pure, tested rules in `lib/stock.ts`, `lib/reviews.ts`, `clampToStock` in `lib/cart-rules.ts`. The catalog (cookie-less) embeds approved ratings and stock so pages stay ISR; the review form is a client island with its own `SessionProvider`; writes go through Server Actions guarded by `requireUser()`/`requireAdmin()`.

**Tech Stack:** Next.js 16.2 App Router, React 19.2, Supabase (secret-key writes, RLS), Auth.js v5, Tailwind v4, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-03-reviews-and-stock-design.md`

## Global Constraints

- Read the relevant guide under `node_modules/next/dist/docs/` before writing Next code (server actions, caching).
- Catalog stays static/ISR (`revalidate = 60`), cookie-less clients only; root layout must not call `auth()`.
- Every customer string in `<L si en>` (attributes via `tr(lang, si, en)`); admin pages English. Server actions return message **codes**, not text.
- No invented ratings, counts, stock or urgency; nothing shown when there is no data.
- Every `public` table has RLS. The migration file is saved in `supabase/migrations/`; the OWNER applies it in the SQL editor BEFORE the code is deployed. Never apply it yourself and never work around a denied permission.
- Every admin action starts with `await requireAdmin(...)`; the review action starts with `requireUser(...)` and takes the user id from the session only.
- Money in cents via `formatPrice`; never print or read secret values.
- Windows/CRLF: when scripting edits normalise with `.replace(/\r\n/g,"\n")`; write helper scripts to files, not shell one-liners with apostrophes.

## Review Focus

- A product with no reviews and no stock data renders exactly as today (no stars, no pills changed). Pinned in Task 4 (`summarizeRatings([])` null) and Task 1 (`stock: null` untracked).
- A signed-out user cannot post; one user posting twice edits the same row and returns it to `pending`; a non-admin cannot moderate. Pinned in Task 7 (manual check) and by action guards in Tasks 6–7.
- Review text is rendered as plain text, never HTML. Pinned in Task 2 (control-char rejection) and Task 7 (rendered inside `{review.body}` only, `whitespace-pre-line`).
- Stock lowered while the item is in the cart: the line is clamped with a notice. Pinned in Task 3 (`clampToStock`) and Task 8.
- Hidden products' reviews/ratings never appear. Pinned in Task 4 (the embed lives in the `published = true` select) and Task 7 (review list fetched only via `getProduct` success).

---

### Task 1: Stock rules (pure)

**Files:**
- Create: `lib/stock.ts`
- Test: `lib/stock.test.ts`

**Interfaces:**
- Produces:
  - `export const LOW_STOCK = 5`
  - `export type StockMap = Record<string, number> | null`
  - `sizeStock(p: { stock: StockMap }, size: string): { tracked: boolean; quantity: number }` (`quantity` is `Infinity` when untracked)
  - `isSoldOut(p, size): boolean`; `allSoldOut(p: { sizes: string[]; stock: StockMap }): boolean` (true only when `sizes` non-empty and every size tracked and 0)
  - `lowStockLeft(p, size): number | null` (N when `1 <= N < LOW_STOCK`)
  - `maxQuantity(p, size): number` (`Infinity` when untracked)
  - `parseStockField(raw: string | undefined, sizes: string[]): { ok: true; value: Record<string, number> | null } | { ok: false }` — `raw` is a JSON object; blank/`{}` → `value: null`; keys must be in `sizes`; values integers 0..9999 (else `ok: false`); malformed JSON, arrays, non-objects → `ok: false`.

- [ ] **Step 1: Write failing tests** in `lib/stock.test.ts`: `stock: null` → every size untracked, not sold out, `maxQuantity` Infinity; `{M:0}` → `isSoldOut(M)` true, `isSoldOut(L)` false (missing key = untracked); `{M:3}` → `lowStockLeft` 3, `{M:5}` → null, `{M:0}` → null; `allSoldOut` true for `{M:0,L:0}` with sizes `["M","L"]`, false for `{M:0}` (L untracked), false for empty sizes; `maxQuantity` returns the number; `parseStockField` cases: `undefined`, `""`, `"{}"` → value null; `'{"M":4,"L":0}'` → that object; `'{"M":-1}'`, `'{"M":1.5}'`, `'{"M":10000}'`, `'{"XL":2}'` (unknown size), `'[1]'`, `'not json'`, `'{"M":"3"}'` → `ok: false`.
- [ ] **Step 2: Run** `npx vitest run lib/stock.test.ts` — Expected: FAIL (module missing).
- [ ] **Step 3: Implement** `lib/stock.ts` per the Interfaces block.
- [ ] **Step 4: Run** `npx vitest run lib/stock.test.ts` — Expected: all pass.
- [ ] **Step 5: Commit** `git add lib/stock.ts lib/stock.test.ts && git commit -m "Add pure stock rules"` (end the message with the Co-Authored-By line from the session attribution).

---

### Task 2: Review rules (pure)

**Files:**
- Create: `lib/reviews.ts`
- Test: `lib/reviews.test.ts`

**Interfaces:**
- Produces:
  - `export const MAX_REVIEW_LENGTH = 1000`
  - `export type RatingSummary = { average: number; count: number }`
  - `validateReview(input: { rating: unknown; body: unknown }): { ok: true; rating: number; body: string } | { ok: false; error: "rating" | "body" }` — rating must be an integer 1..5 (number, or a numeric string of one); body trimmed, 1..1000 chars, no control characters other than `\n`, `\r`, `\t`; `rating` is checked first.
  - `summarizeRatings(ratings: number[]): RatingSummary | null` — `null` for an empty list; `average` rounded to one decimal.
  - `firstName(name: string | null, email: string): string` — first whitespace-separated word of `name`; when `name` is null/blank, the email's local part before `@`.
  - `export type ReviewMessage = "saved" | "rating" | "body" | "error"` (codes returned by `submitReview`).

- [ ] **Step 1: Write failing tests** in `lib/reviews.test.ts`: ratings `0`, `6`, `2.5`, `"abc"`, `null` → `error: "rating"`; `1`, `5`, `"4"` ok; body `""`, `"   "`, 1001 chars, `"hi\u0000"` → `error: "body"`; 1000 chars ok; body with newline ok and is trimmed; `summarizeRatings([])` null, `[5,4]` → `{average: 4.5, count: 2}`, `[5,4,4]` → average 4.3; `firstName("  Nimal  Perera ", "x@y.lk")` → `"Nimal"`, `firstName(null, "kamal@x.lk")` → `"kamal"`, `firstName("", "a@b.c")` → `"a"`.
- [ ] **Step 2: Run** `npx vitest run lib/reviews.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement** `lib/reviews.ts`.
- [ ] **Step 4: Run** the same command — Expected: pass.
- [ ] **Step 5: Commit** `git add lib/reviews.ts lib/reviews.test.ts && git commit -m "Add pure review rules"`.

---

### Task 3: Cart clamp to stock (pure)

**Files:**
- Modify: `lib/cart-rules.ts`
- Test: `lib/cart-rules.test.ts`

**Interfaces:**
- Consumes: `maxQuantity` from `lib/stock.ts` (Task 1).
- Produces: `clampToStock(lines: CartLine[], products: { id: string; stock: StockMap }[]): { lines: CartLine[]; changed: boolean }` — for each line whose product is in `products`: quantity above `maxQuantity` is lowered to it; a line whose cap is 0 is dropped; lines whose product is not in `products` are kept untouched; `changed` is true only if something was lowered or dropped; order preserved.

- [ ] **Step 1: Write failing tests** (append to `cart-rules.test.ts`): over cap (`qty 5`, stock `{M:2}` → 2, changed); sold out (`{M:0}` → dropped, changed); untracked/`stock: null` → unchanged, `changed` false; unknown product id → kept; a different size of the same product is capped by its own entry; already within cap → same lines, `changed` false.
- [ ] **Step 2: Run** `npx vitest run lib/cart-rules.test.ts` — Expected: FAIL (`clampToStock` not a function).
- [ ] **Step 3: Implement** `clampToStock` in `lib/cart-rules.ts` (import `maxQuantity` and the `StockMap` type; keep the file free of React/Next imports).
- [ ] **Step 4: Run** `npx vitest run lib/cart-rules.test.ts` then `npm test` — Expected: all green.
- [ ] **Step 5: Commit** `git add lib/cart-rules.ts lib/cart-rules.test.ts && git commit -m "Clamp cart lines to available stock"`.

---

### Task 4: Migration and catalog data

**Files:**
- Create: `supabase/migrations/20261103180000_reviews_and_stock.sql`
- Modify: `lib/products.ts`, `lib/catalog.ts`, `app/layout.tsx` (only if `toShellProduct` typing needs it)
- Test: `lib/products.test.ts` (only for `toShellProduct` carrying `stock`)

**Interfaces:**
- Consumes: `StockMap` (Task 1), `summarizeRatings`, `RatingSummary` (Task 2).
- Produces:
  - `Product` gains `stock: StockMap` and `rating: RatingSummary | null`; `ShellProduct` gains `"stock"`; `toShellProduct` copies it.
  - `ProductRow` gains `stock: Record<string, number> | null` and `reviews: { rating: number }[] | null`; `COLUMNS` gains `stock, reviews(rating)`; `toProduct` maps `stock: row.stock ?? null` and `rating: summarizeRatings((row.reviews ?? []).map(r => r.rating))`.
  - `export type Review = { id: string; authorName: string; rating: number; body: string; createdAt: string }` (in `lib/reviews.ts`) and `getProductReviews(productId: string): Promise<Review[]>` in `lib/catalog.ts` (cookie-less client, `status = 'approved'`, newest first, limit 50, `cache()`d).

- [ ] **Step 1: Write the migration** — `reviews` and `products.stock` exactly as the spec's Data section (columns, checks, `unique (product_id, user_id)`, RLS on, one SELECT policy `using (status = 'approved')` for `anon, authenticated`, `revoke all ... from anon, authenticated` then `grant select`; `alter table public.products add column stock jsonb`; an index on `reviews (product_id, status)`). Header comment: run by the owner in the SQL editor BEFORE deploying.
- [ ] **Step 2: Write the failing test** in `lib/products.test.ts`: `toShellProduct` keeps `stock` (e.g. `{M: 3}` and `null`). Run `npx vitest run lib/products.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement** the type changes and `toProduct`/`COLUMNS`/`getProductReviews`. In `selectProducts()` add `.eq("reviews.status", "approved")` so only approved ratings are embedded (the embed lives inside the `published = true` select, so hidden products never expose ratings). Run `npx tsc --noEmit` and fix every place that builds a `Product`/`ShellProduct` (test fixtures included) by adding `stock: null, rating: null`.
- [ ] **Step 4: Run** `npm test` and `npx tsc --noEmit` — Expected: green, no type errors. (Do NOT start the dev server against the live DB yet: the migration is not applied; the owner applies it in Task 9.)
- [ ] **Step 5: Commit** `git add supabase/migrations lib app && git commit -m "Add reviews/stock schema and carry stock and ratings in the catalog"`.

Ruling pre-recorded for the executor: admin queries (`lib/admin-products.ts`) reuse `COLUMNS` through the secret-key client, which ignores RLS, so `rating` there can include non-approved rows; the admin UI never shows `rating`, so this is accepted.

---

### Task 5: Admin stock inputs

**Files:**
- Modify: `lib/product-form.ts`, `lib/admin-products.ts`, `app/admin/products/actions.ts`, `app/admin/products/ProductForm.tsx`
- Test: `lib/product-form.test.ts`

**Interfaces:**
- Consumes: `parseStockField` (Task 1).
- Produces: `ProductInput` gains `stock: Record<string, number> | null`; `FieldName` gains `"stock"`; `parseProductForm` reads `fields.stock` (the JSON string) after sizes are parsed and reports `errors.stock = "Stock must be whole numbers from 0 to 9999."` on `ok: false`; stock keys not among the parsed sizes are an error. `AdminProduct` already carries `stock` through `Product`.

- [ ] **Step 1: Write failing tests** in `lib/product-form.test.ts`: valid form + `stock: '{"M":4,"L":0}'` → `value.stock` equals that; no `stock` field → `value.stock === null`; `'{"M":-1}'` → `errors.stock`; stock naming a size not in `sizes` → `errors.stock`.
- [ ] **Step 2: Run** `npx vitest run lib/product-form.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement** the parser change; `insertProduct`/`updateProduct` already write `ProductInput` as is, so `stock` is saved. In `ProductForm.tsx`, under the Sizes field render one `<input type="number" min={0} max={9999}>` per size currently typed in the Sizes box (derive the list from the sizes input state, trimmed, de-duplicated), labelled "Stock for {size} (blank = not tracked)", prefilled from `product?.stock?.[size]`; mirror the existing hidden `photos` input pattern with a hidden `stock` input holding `JSON.stringify` of only the filled sizes.
- [ ] **Step 4: Run** `npm test` and `npx tsc --noEmit` — Expected: green.
- [ ] **Step 5: Commit** `git add lib app && git commit -m "Let admins set per-size stock"`.

---

### Task 6: Admin reviews moderation

**Files:**
- Create: `lib/admin-reviews.ts`, `app/admin/reviews/page.tsx`, `app/admin/reviews/actions.ts`, `app/admin/reviews/ReviewRowActions.tsx`
- Modify: `app/admin/AdminTabs.tsx` (add `"reviews"` tab after Promotions, label "Reviews")

**Interfaces:**
- Produces:
  - `listReviewsForAdmin(): Promise<AdminReview[]>` where `AdminReview = { id; productId; productName; authorName; rating; body; status: "pending"|"approved"|"rejected"; createdAt }`, pending first then newest first, secret-key client, `import "server-only"`.
  - `setReviewStatus(id: string, status: "approved" | "rejected"): Promise<boolean>` and `deleteReview(id: string): Promise<boolean>` (false when no row matched).
  - Server Actions `setReviewStatusAction(id, status)` and `deleteReviewAction(id)` in `app/admin/reviews/actions.ts`; each starts with `await requireAdmin("/admin/reviews")`, validates `id` is a uuid and `status` is `approved|rejected` before touching the DB, then calls `revalidatePath` for `/`, `/products`, `/admin/reviews` and `/products/<productId>` (return value `{ error: string | null }`).

- [ ] **Step 1: Implement** the files following `app/admin/promises/` as the pattern (page: `await requireAdmin("/admin/reviews")`, `<AdminTabs active="reviews" />`, empty-state text, rows with product link, stars as text `★★★★☆`, body in `whitespace-pre-line` plain text, status chip, Approve / Reject / Delete buttons via a client `ReviewRowActions` using `useTransition`).
- [ ] **Step 2: Run** `npx tsc --noEmit` and `npm run lint` — Expected: no errors in the new files.
- [ ] **Step 3: Commit** `git add lib app && git commit -m "Add admin review moderation"`.

---

### Task 7: Storefront reviews

**Files:**
- Create: `app/products/[id]/review-actions.ts`, `app/components/ReviewForm.tsx`, `app/components/ReviewSection.tsx`, `app/components/Stars.tsx`
- Modify: `app/products/[id]/page.tsx`, `app/components/ProductCard.tsx`, `lib/admin-reviews.ts` is not touched.

**Interfaces:**
- Consumes: `validateReview`, `firstName`, `ReviewMessage`, `Review`, `RatingSummary` (Tasks 2, 4); `getProductReviews`, `getProduct`.
- Produces:
  - `submitReview(productId: string, rating: unknown, body: unknown): Promise<{ message: ReviewMessage }>` — `"use server"`; starts with `const user = await requireUser(\`/products/${productId}\`)`; rejects with `"error"` unless `await getProduct(productId)` exists; validates with `validateReview` (returns `"rating"`/`"body"`); upserts `{product_id, user_id: user.id, author_name: firstName(user.name, user.email), rating, body, status: "pending"}` with `onConflict: "product_id,user_id"` through `supabaseAdmin`; on any DB error returns `"error"`; returns `"saved"`. Does not need `revalidatePath` (nothing public changes until approval).
  - `Stars({ value }: { value: number })` — server-safe, `role="img"` with a bilingual `aria-label` via `<L>` is not allowed in attributes, so render visually-hidden `<L>` text beside the glyphs.
  - `ReviewSection({ reviews, rating, productId })` (server): `ReviewSummary` (average, stars, count) and the list (author first name, stars, date in `en-LK`, body as plain text in `whitespace-pre-line`); with `reviews.length === 0` shows only "No reviews yet" text and the form.
  - `ReviewForm({ productId })` (client): wraps itself in `<SessionProvider>` from `next-auth/react` (the page is outside the Header's provider), reads `useSession()`; unauthenticated → link to `/signin?callbackUrl=/products/<id>` ("Sign in to write a review"); authenticated → 5 star radio buttons + textarea (`maxLength={MAX_REVIEW_LENGTH}`) + submit via `startTransition`; shows the returned code as bilingual text (`saved` → "Thanks! Your review will appear after approval.").
- `ProductCard` shows `★ 4.5 (12)` under the name only when `product.rating` is not null.

- [ ] **Step 1: Read** `node_modules/next/dist/docs/01-app/` guides on Server Actions and `use server` files before writing `review-actions.ts`.
- [ ] **Step 2: Implement** the action, `Stars`, `ReviewSection`, `ReviewForm`; mount `ReviewSection`/`ReviewForm` on the product page below the spec sheet (fetch `getProductReviews(product.id)` in the page's existing `Promise.all`, falling back to `[]` with a logged error so a failed read never breaks the page); add the card rating line.
- [ ] **Step 3: Run** `npx tsc --noEmit`, `npm run lint`, `npm test` — Expected: clean.
- [ ] **Step 4: Commit** `git add app lib && git commit -m "Add storefront reviews and card ratings"`.

---

### Task 8: Storefront stock

**Files:**
- Modify: `app/components/ProductPurchase.tsx`, `app/components/QuickAdd.tsx`, `app/components/ProductCard.tsx`, `app/components/CartView.tsx`, `app/components/CartDrawer.tsx`, `app/context/CartContext.tsx`
- Create: `app/components/CartStockGuard.tsx`; mount it in `app/components/Header.tsx` next to `CartSync`.

**Interfaces:**
- Consumes: `isSoldOut`, `allSoldOut`, `lowStockLeft`, `maxQuantity` (Task 1), `clampToStock` (Task 3), `Product.stock` / `ShellProduct.stock` (Task 4).
- Produces: `setCartLines(lines: CartLine[])` exported from `CartContext.tsx` — a *local* change (source `"local"`, so it is saved to the account like any edit). `QuickAdd` gains a `stock` prop (`StockMap`).

- [ ] **Step 1: Implement `ProductPurchase`**: sold-out size pills `disabled` with a visible "Sold out" caption (and `aria-disabled` semantics via `disabled`); under the pills, "Only N left" for the selected size when `lowStockLeft` is set; when `allSoldOut(product)` replace Add (and the phone bar's button) with a disabled "Sold out"; disable Add when the cart already holds `maxQuantity` of the selected size (use `useCart().lines`); a single-size product behaves the same.
- [ ] **Step 2: Implement `QuickAdd`/`ProductCard`**: sold-out sizes disabled in the picker; for a one-size sold-out product render no button; a product with `allSoldOut` shows a "Sold out" tag on the photo (`pointer-events-none`, not blaze colour).
- [ ] **Step 3: Implement cart limits**: `+` buttons in `CartView` and `CartDrawer` disabled at `Math.min(MAX_LINE_QUANTITY, maxQuantity(product, size))` (find the product from the page/shell product list already in scope); `CartStockGuard` (client, render-less except a `role="status"` bilingual notice "Some items were reduced to what we have in stock." shown for ~6 s) runs `clampToStock(lines, shellProducts)` after `hydrated` and whenever `products` change, calls `setCartLines` when `changed`.
- [ ] **Step 4: Run** `npx tsc --noEmit`, `npm run lint`, `npm test`, `npm run build` — Expected: clean; `/` and `/products/[id]` still listed as static/ISR (○/●), not dynamic (ƒ). (`npm run build` needs the migration applied; if the owner has not yet run it, defer the build to Task 9 and note it in the ledger.)
- [ ] **Step 5: Commit** `git add app lib && git commit -m "Show sold-out and low-stock sizes and cap the cart at stock"`.

---

### Task 9: Docs, owner migration, browser verification

**Files:**
- Modify: `CLAUDE.md` (architecture bullets for reviews and stock, migration state `20261103180000_reviews_and_stock.sql`, the "no checkout so stock does not decrement" note, `/admin/reviews`, `Product.stock`/`rating`, `CartStockGuard`, the review form's own `SessionProvider`)

- [ ] **Step 1: Ask the owner** to run `supabase/migrations/20261103180000_reviews_and_stock.sql` in the SQL editor and say "done" (stop and ask; do not apply it yourself).
- [ ] **Step 2: Start the dev server** (`preview_start`) and verify in the browser, cleaning all test data afterwards: as a customer account submit a review (rating + comment) → it is NOT on the page → approve it in `/admin/reviews` → it shows on the product page and the card shows `★ avg (count)` → delete it; a signed-out visitor sees "Sign in to write a review"; resubmitting edits the same row and returns it to pending; set stock `{M: 0, L: 3}` on a test product → M pill disabled "Sold out", L shows "Only 3 left", cart "+" stops at 3, lowering stock below a cart line clamps it with the notice; restore stock to blank afterwards; Sinhala and English; phone width.
- [ ] **Step 3: Run** `npm test`, `npm run lint`, `npm run build` — Expected: all green; `/` and `/products/[id]` static/ISR.
- [ ] **Step 4: Commit** `git add CLAUDE.md && git commit -m "Document reviews and stock"`.

---

## Final steps (executor)

- Final whole-branch review by one fresh Opus reviewer using the Review Focus list above; fix Critical/Important findings in one TDD pass; note Minors in the PR body.
- Open the PR from `feat/reviews-stock` into `main` (PR body ends with the 🤖 Generated with Claude Code line). Do not merge until the owner says "merge".
