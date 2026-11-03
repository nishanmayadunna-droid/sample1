# Reviews, ratings and real stock (Part 4)

## Understanding

Add customer reviews and per-size stock to Northbound, showing only real data. Said by the owner: reviews option A (signed-in customers only, admin-approved before they show); stock option A (per-size quantity typed by the admin). Assumptions: there is no checkout or orders table, so there is no "verified buyer" badge and stock never decrements by itself; stock is not synced with the owner's POS; Sinhala/English via `<L>`; admin pages stay English.

## Global constraints

- Next.js 16 / React 19; read `node_modules/next/dist/docs/` before Next code.
- Catalog pages stay static/ISR (`revalidate = 60`); catalog reads use cookie-less clients only. The root layout must not call `auth()`.
- Every customer string in `<L si en>` (or `tr` for attributes).
- No invented ratings, review counts, stock or urgency: nothing is shown when there is no data.
- Every `public` table has RLS. The migration is additive, saved in `supabase/migrations/`, and applied by the owner in the SQL editor BEFORE the code that embeds it is deployed.
- Every admin action starts with `await requireAdmin(...)`; the customer review action starts with `requireUser()` and takes the user id from the session only.
- Pure rules are unit-tested in `lib/*.test.ts`.

## 1. Data

Migration `supabase/migrations/20261103180000_reviews_and_stock.sql`:

- `public.reviews`: `id uuid pk default gen_random_uuid()`, `product_id text not null references products(id) on delete cascade`, `user_id uuid not null references users(id) on delete cascade`, `author_name text not null`, `rating int not null check (rating between 1 and 5)`, `body text not null check (length(body) between 1 and 1000)`, `status text not null default 'pending' check (status in ('pending','approved','rejected'))`, `created_at timestamptz not null default now()`, `unique (product_id, user_id)`. RLS on; one public SELECT policy `using (status = 'approved')`; no write grants (writes via the secret key).
- `products.stock jsonb` (nullable): size to quantity, e.g. `{"M": 4, "L": 0}`. `null`, or a size missing from the object, means "not tracked, always available". Existing rows stay `null`.

Types: `Product` gains `stock: Record<string, number> | null`, `rating: { average: number; count: number } | null` (null when no approved reviews). `lib/catalog.ts` maps both in the shared `selectProducts()`; ratings come from an embedded `reviews(rating)` select (approved rows only through RLS) and are summarised in code. The author name is the user's first name only.

## 2. Pure rules

`lib/stock.ts`: `LOW_STOCK = 5`; `sizeStock(product, size)` returns `{ tracked, quantity }`; `isSoldOut(product, size)`; `allSoldOut(product)` (true only when every size is tracked and 0); `lowStockLeft(product, size)` returns N when `1 <= N < 5`, else null; `maxQuantity(product, size)` returns the cap or `Infinity`; `parseStockField(raw, sizes)` / `validateStock` for the admin form (integers 0..9999, only known sizes, blank = not tracked).

`lib/reviews.ts`: `validateReview({ rating, body })` (integer 1..5, trimmed body 1..1000 chars, no control chars), `summarizeRatings(ratings)` returns `{ average (one decimal), count }` or null for an empty list, `firstName(fullName)`, `starsLabel`.

`lib/cart-rules.ts` gains `clampToStock(lines, products)` returning `{ lines, changed }`: caps each line's quantity at `maxQuantity`, drops lines whose size is sold out.

## 3. Admin

- `ProductForm`: under Sizes, one number input per size labelled "Stock (blank = not tracked)". Sent as a JSON `stock` field; validated by `parseStockField`; `lib/admin-products.ts` writes `products.stock` (null when every input is blank). Existing `revalidatePath` set is unchanged.
- `/admin/reviews` (new tab "Reviews", English): pending first, then approved and rejected. Each row: product, author, stars, text, date; buttons Approve / Reject / Delete. Server code in `lib/admin-reviews.ts` and `app/admin/reviews/actions.ts`, every action beginning with `requireAdmin`. Each change calls `revalidatePath` for `/`, `/products`, `/products/<id>`, `/admin/reviews`.

## 4. Storefront

- Product page: `ReviewSummary` (average, stars, count) and the approved review list (server, cookie-less) under the buy box; `ReviewForm` (client) beside it: signed-out visitors see "Sign in to write a review" linking to `/signin?callbackUrl=...`; signed-in see stars + comment. `submitReview` (`app/products/[id]/review-actions.ts`) validates, upserts the user's own row as `pending` (a resubmission edits it and returns it to pending), and replies with a message **code**. Rate-limited by the one-row-per-user constraint and the 1000-char limit.
- Cards (`ProductCard`) show "★ 4.5 (12)" only when `rating` is not null.
- `ProductPurchase`: sold-out size pills are disabled with a "Sold out" label; "Only N left" under the pills for the selected size when `lowStockLeft` is set; if every size is sold out the Add button is replaced by a disabled "Sold out". The phone bar follows the same states.
- `QuickAdd`: sold-out sizes are disabled in the picker; a one-size product that is sold out shows no 🛒+; a card whose product is sold out everywhere shows a "Sold out" tag.
- Cart: `addItem` callers check `maxQuantity` (the add buttons disable at the cap); `CartView`/`CartDrawer` run `clampToStock` against the page's products and show a notice when a line was reduced. `summarizeCart` is unchanged.

## Testing

Vitest: `lib/stock.ts` (untracked, 0, 3, 5, unknown size, all sold out, form parsing: blank, negative, decimal, huge, unknown size), `lib/reviews.ts` (rating 0/1/5/6/2.5, empty and over-long body, summary rounding, empty list, first name with extra spaces), `clampToStock` (over cap, sold out size, untracked, hidden product). Browser: submit review as a customer, approve in admin, check page and card; unapproved review not public; sold-out and low-stock pills; cart cap; test data cleaned afterwards. `npm run build` keeps `/products/[id]` and `/` static.

## Review focus

- Product with no reviews and no stock data renders exactly as today.
- A signed-out user cannot post; one user cannot post twice for a product (edit instead); a non-admin cannot approve (action rejects, page 404s).
- Review text is rendered as plain text (no HTML injection).
- Stock lowered while the item is in the cart: the line is clamped with a notice.
- Migration not yet applied: catalog embed fails; the owner applies the SQL first.
- Hidden product's reviews are not shown anywhere.

## Out of scope

Verified-buyer badge, review photos, helpful votes, email notifications, automatic stock decrement, POS sync.
