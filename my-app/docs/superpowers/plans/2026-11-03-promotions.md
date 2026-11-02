# Promotions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admin-managed promotions (date range, banner, free-shipping and discount rules) that price products and carts consistently everywhere, replacing the hard-coded shipping constants.

**Architecture:** A pure TypeScript engine (`lib/promotions.ts`) prices items and carts from the running promotions; server pages use it for cards and product pages, the client shell (search, drawer, `/cart`) uses the same function with the same promotion list that the server rendered. Promotions, rules and the shipping fee live in Supabase; admin pages write them through the secret-key client.

**Tech Stack:** Next.js 16.4 App Router, React 19.2, Tailwind v4 tokens, Supabase (Postgres + RLS + Storage), Auth.js v5, Vitest 4.

**Spec:** `docs/superpowers/specs/2026-11-03-promotions-design.md`

## Global Constraints

- Read the relevant guide under `node_modules/next/dist/docs/` before writing Next.js code.
- Catalog pages stay static/ISR: no `cookies()`/`headers()`/`auth()` in the root layout or catalog pages; `/`, `/cart`, `/products/[id]` must still build as static/ISR.
- Prices are integer cents; render through `formatPrice`/`formatPriceWhole`. `%` results round to the nearest cent; no price below 0.
- Best price only per item; order discount = single best, capped at subtotal; free shipping when any qualifying rule has a matching line.
- Minimums are measured on base prices (list or sale) before promotions.
- Client code never decides what is running by its own clock: it uses the promotion list the server rendered.
- Customer-facing text in both languages (`<L>`/`tr`); admin pages English.
- Every admin Server Action starts with `await requireAdmin(...)`; storefront-affecting writes call `revalidatePath("/", "layout")`.
- RLS on every new table; writes only via `lib/supabase/admin.ts`.
- Admin forms use the `onSubmit` + `startTransition` pattern.
- Datetimes from the admin form are Asia/Colombo (UTC+05:30, no DST).
- Defaults when reads fail: no promotions; shipping fee 35000.

## Review Focus

1. A promotion whose `ends_at` passed but the page is still cached shows for up to a minute; the drawer must not disagree with the page it sits on — both use the server's list (checked in Task 5 browser step).
2. A cart where a discount brings the scope total below its own minimum must keep the discount (minimum measured before promotions) — tested in Task 3.
3. An order discount larger than the subtotal must cap at the subtotal, total never negative — tested in Task 3.
4. A rule scoped to a category stored under an old name, or to a deleted product, must neither crash nor match wrongly — tested in Task 2.
5. Admin datetime at a day boundary in Colombo (e.g. 2026-10-31T23:59) must store the right UTC instant and show back the same local value — tested in Task 9.

---

### Task 1: Promotions schema

**Files:**
- Create: `supabase/migrations/<version>_create_promotions.sql`

**Interfaces:**
- Produces: `store_settings.shipping_fee`, tables `promotions` and `promotion_rules` exactly as in the spec's Data section; RLS policies (public SELECT active promotions; rules of active promotions via `exists`); function `public.save_promotion_rules(p_promotion_id uuid, p_rules jsonb) returns void` (`language plpgsql`, `security invoker`, `set search_path = ''`, deletes then inserts rows from `jsonb_to_recordset(p_rules)` with columns `kind, value, scope, category_slugs, product_ids, min_subtotal, sort_order`; `revoke all … from public, anon, authenticated; grant execute … to service_role`); public Storage bucket `promotion-images` (5 MB, `image/jpeg`, `image/png`, `image/webp`); seed promotion `free-shipping` with one rule (`free_shipping`, scope `all`, `min_subtotal 500000`).

- [ ] **Step 1:** Apply with MCP `apply_migration` (name `create_promotions`) on project `dtytkwxlpvkervhkhcpu`; save the same SQL under the reported version.
- [ ] **Step 2: Verify** with `execute_sql`: `select shipping_fee from store_settings` → `35000`; the seed promotion and its rule exist; `select public.save_promotion_rules(...)` is denied for `anon` (`set role anon` inside a rolled-back transaction); `storage.buckets` has `promotion-images` public. `get_advisors security` → no new findings beyond the existing `carts`/`users` INFO.
- [ ] **Step 3: Commit** — `git commit -m "Add promotions, rules and shipping fee schema"`

### Task 2: Engine — items

**Files:**
- Create: `lib/promotions.ts`, `lib/promotions.test.ts`

**Interfaces:**
- Consumes: `resolveCategoryParam` (`lib/category-form.ts`), `effectivePrice`, `Product`, `Category`.
- Produces (types exactly as in the spec's Engine section, plus):
  - `type ItemPricing = { price: number; compareAt: number | null; promotion: Promotion | null; discountPercent: number | null; conditional: ConditionalOffer[]; freeShipping: Promotion | null }`
  - `isRunning(p: Promotion, now: Date): boolean`; `promotionStatus(p, now): "running" | "scheduled" | "ended" | "off"`
  - `ruleMatches(rule: PromotionRule, product: Pick<Product, "id" | "category">, categories: Category[]): boolean`
  - `itemPricing(product: Pick<Product, "id" | "category" | "price" | "salePrice">, promotions: Promotion[], categories: Category[]): ItemPricing` — `compareAt` = list price when `price` < list price, else null; `discountPercent` = rounded % off list price.
  - `freeShippingThreshold(promotions: Promotion[]): number | null`

- [ ] **Step 1: Failing tests** (fixture: categories `tops`/`bottoms`; products `tee` (tops, 1000000), `shirt` (tops, 2000000, sale 1500000), `old` (category `"Tops"`, old name), promotions built by a `promo({...})` helper):
  - `isRunning`: start = now → true; end = now → false; `active: false` → false; no end → true. `promotionStatus` returns each of the four.
  - `ruleMatches`: scope all; categories `["tops"]` matches `tee` and `old`; products `["tee"]` matches only `tee`; a slug/id that doesn't exist matches nothing.
  - `itemPricing(shirt)` with `percent_off 20` on tops → price `1500000` (sale wins over 1600000), `promotion: null`, `compareAt 2000000`.
  - `itemPricing(tee)` with `percent_off 20` → `800000`, promotion set, `discountPercent 20`; with both `percent_off 20` and `amount_off_item 300000` → `700000`.
  - `amount_off_item` larger than price → `0`.
  - `percent_off 33` on `999` cents → `669` (rounded).
  - A rule with `minSubtotal > 0` doesn't change the price and appears in `conditional`.
  - `freeShipping` set for a matching no-minimum `free_shipping` rule.
  - `freeShippingThreshold`: smallest `minSubtotal` among `free_shipping` scope-all rules → `300000` when 500000 and 300000 exist; `null` when none; ignores category-scoped ones.
- [ ] **Step 2:** `npx vitest run lib/promotions.test.ts` → FAIL (module not found).
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Same command → PASS.
- [ ] **Step 5: Commit** — `git commit -m "Price items from running promotions"`

### Task 3: Engine — cart

**Files:**
- Modify: `lib/cart-summary.ts`, `lib/cart-summary.test.ts`

**Interfaces:**
- Consumes: Task 2 exports.
- Produces:
  - `type CartLineSummary<P> = { line: CartLine; product: P; unitPrice: number; compareAt: number | null; promotion: Promotion | null }`
  - `type Nudge = { promotion: Promotion; kind: RuleKind; missing: number }`
  - `summarizeCart<P extends Pick<Product, "id" | "category" | "price" | "salePrice">>(lines, products: P[], promotions: Promotion[], shippingFee: number, categories: Category[]): { items: CartLineSummary<P>[]; itemCount; subtotal; orderDiscount: { amount: number; promotion: Promotion } | null; shipping; freeShippingBy: Promotion | null; total; nudges: Nudge[] }` — algorithm exactly as the spec's six steps; nudges sorted by `missing` ascending.
  - `cartBadgeCount` unchanged in behaviour.

- [ ] **Step 1: Failing tests** — rewrite the existing tests to the new signature with a `freeOver5000` promotion and fee `35000`; they keep their numbers (threshold exactly → shipping 0; one cent below → 35000 and a free-shipping nudge with `missing 1`; missing products dropped; empty cart all zero). Add:
  - Category minimum measured before discounts: tops `percent_off 50` with `minSubtotal 1000000`, cart one tee (1000000) → unit price 500000 (rule still applies).
  - Order discount: two `amount_off_order` rules (300000 min 0, 500000 min 2000000), subtotal 1500000 → 300000 applied; subtotal 2500000 → 500000; a 5000000 discount on a 1000000 cart → amount 1000000, total = shipping only.
  - Free shipping from one qualifying item: `free_shipping` scope categories `["bottoms"]`, cart tee + chino → shipping 0, `freeShippingBy` set; cart tee only → fee.
  - Nudge for an order rule whose scope has lines but isn't met.
- [ ] **Step 2:** `npx vitest run lib/cart-summary.test.ts` → FAIL.
- [ ] **Step 3:** Implement; keep `cartBadgeCount`.
- [ ] **Step 4:** → PASS.
- [ ] **Step 5: Commit** — `git commit -m "Apply promotions and shipping fee to the cart summary"`

### Task 4: Reading promotions and the shipping fee

**Files:**
- Modify: `lib/storefront.ts`, `lib/i18n.ts` (only if `LangSettings` is extended — prefer a separate type), `lib/promotions.ts` (+ test)

**Interfaces:**
- Produces:
  - `type PromotionRow` (snake_case incl. nested `promotion_rules`) and `toPromotion(row: PromotionRow): Promotion` in `lib/promotions.ts` (pure; tested: banner mode mapping, cents/percent values, null end).
  - `PROMOTION_COLUMNS` select string including `promotion_rules(*)`.
  - `getRunningPromotions(): Promise<Promotion[]>` in `lib/storefront.ts` — active rows, `toPromotion`, filtered by `isRunning(new Date())`, ordered by `sort_order` then `starts_at`; `[]` and a log on error.
  - `type StoreSettings = LangSettings & { shippingFee: number }`; `getStoreSettings()` now returns `StoreSettings` (default `shippingFee 35000`).

- [ ] **Step 1: Failing test** for `toPromotion` (template row → `banner.mode "template"` with fields; image row; `none`; rules mapped camelCase; `ends_at null` → `endsAt null`). Run → FAIL. Implement. Run → PASS.
- [ ] **Step 2:** Implement the two reads.
- [ ] **Step 3: Verify** — `npx tsc --noEmit`, `npm test`.
- [ ] **Step 4: Commit** — `git commit -m "Read running promotions and the shipping fee"`

### Task 5: Wire the engine into the shell and cart

**Files:**
- Modify: `lib/products.ts` (remove `FREE_SHIPPING_THRESHOLD`, `SHIPPING_FLAT`), `lib/storefront-form.ts` (`promiseItems(promises, freeShippingThreshold: number | null)` — the free-shipping line only when non-null), `app/layout.tsx`, `app/components/{PromiseStrip,Footer,Header,CartDrawer,CartView}.tsx`, `app/cart/page.tsx`, `app/page.tsx` (home promise row uses `freeShippingThreshold`; row hidden when null)
- Test: `lib/storefront-form.test.ts`

**Interfaces:**
- Consumes: Tasks 3–4.
- Produces: root layout reads `getRunningPromotions()` with the other shell reads and passes `promotions`, `shippingFee`, `categories` to `CartDrawer`; `PromiseStrip`/`Footer` get `freeShippingThreshold`. `/cart` passes `promotions`, `shippingFee`, `categories` to `CartView`.

- [ ] **Step 1: Failing test** — `promiseItems(promises, null)` has no free-shipping item; `promiseItems(promises, 300000)` starts with "Free shipping over Rs 3,000". Run → FAIL. Implement. Run → PASS.
- [ ] **Step 2:** Remove the constants; fix every caller (`grep -rn "FREE_SHIPPING_THRESHOLD\|SHIPPING_FLAT" app lib` → nothing).
- [ ] **Step 3:** Drawer and `CartView`: per line `unitPrice`, struck `compareAt`, promotion name (`<L si={nameSi} en={nameEn} />`); summary rows Subtotal, order discount (`−Rs …` with the promotion name), Shipping (`නොමිලේ (name)` / `Free (name)` or amount), Total; progress bar from the first free-shipping nudge (full when shipping is 0; hidden when no free-shipping rule is running); the first discount nudge as a hint line.
- [ ] **Step 4: Verify** — `npm test`, lint, tsc; browser: `/cart` and the drawer show the same totals as before (Rs 350 below Rs 5,000, free above), strip line still "Free shipping over Rs 5,000".
- [ ] **Step 5: Commit** — `git commit -m "Price the cart and shell from promotions"`

### Task 6: Prices on cards, product page, search and filters

**Files:**
- Modify: `lib/products.ts` (`type PricedProduct = Product & { pricing: ItemPricing }`; `withPricing(products, promotions, categories): PricedProduct[]` in `lib/promotions.ts`), `lib/product-filters.ts` (+ test), `app/components/ProductCard.tsx`, `app/components/SearchBox.tsx`, `app/components/Header.tsx`, `app/page.tsx`, `app/products/page.tsx`, `app/products/[id]/page.tsx`

**Interfaces:**
- Consumes: Tasks 2, 4.
- Produces:
  - `ProductCard({ product }: { product: PricedProduct })` — price, struck `compareAt`, badge `−N%` plus promotion name when `pricing.promotion`, `🚚` tag when `pricing.freeShipping`, first conditional offer as a small line.
  - `filterProducts` accepts `PricedProduct[]` and `opts.promo?: Promotion | null`; `view=deals` = products with `pricing.compareAt != null`, sorted by `pricing.discountPercent` desc; `promo` keeps products any of whose promotion rules match (`ruleMatches`).
  - `SearchBox` shows `itemPricing` prices (Header passes `promotions`, `categories`).

- [ ] **Step 1: Failing tests** in `lib/product-filters.test.ts`: deals includes a product discounted only by a promotion and orders by `pricing.discountPercent`; `promo` filter keeps only matching products; scope all keeps everything. Run → FAIL. Implement. Run → PASS.
- [ ] **Step 2:** Pages call `withPricing` once per render and pass `PricedProduct`s; product page shows the price block from `pricing`, the badge, and "ends <date>" (Colombo, `en-LK`/`si-LK` date) when `promotion.endsAt`.
- [ ] **Step 3: Verify** — tests, lint, tsc, `npm run build` (static markers unchanged); browser with no extra promotion: prices identical to before.
- [ ] **Step 4: Commit** — `git commit -m "Show promotion prices on cards, product pages and search"`

### Task 7: Promotion banners

**Files:**
- Create: `app/components/PromoBanner.tsx` (server-safe, one banner), `app/components/PromoBanners.tsx` (client slider)
- Modify: `app/page.tsx` (above the hero), `app/products/page.tsx` (`?promo=<slug>`: banner + filter; unknown slug → all products, no banner)

**Interfaces:**
- Consumes: `Promotion`, `PromotionBanner`.
- Produces: `PromoBanner({ promotion, preload })` — template: gradient `colorFrom→colorTo`, `textColor`, headline/subtext/button via `<L>`, optional photo with `next/image`; image: the artwork as a link to `/products?promo=<slug>` with `alt` via `<L>`-equivalent (`tr` in a client wrapper or two `<img>`-less spans — use a single `next/image` with `alt={nameEn}` plus an `sr-only` `<L>`). `PromoBanners({ promotions })` — renders nothing when none have a banner; one → static; several → slider (6 s, dots with `aria-label`, pause button, no auto-rotate under reduced motion; `setState` only in the interval callback).

- [ ] **Step 1:** Implement.
- [ ] **Step 2: Verify** — lint, tsc, build; browser later in Task 11 with real banners (none running yet → home unchanged).
- [ ] **Step 3: Commit** — `git commit -m "Add promotion banners and promo pages"`

### Task 8: Shipping fee setting

**Files:**
- Modify: `lib/storefront-form.ts` (+ test), `lib/admin-storefront.ts`, `app/admin/settings/{actions.ts,page.tsx}`; Create: `app/admin/settings/ShippingForm.tsx`

**Interfaces:**
- Produces: `parseShippingSettings(fields): { ok: true; value: { shipping_fee: number } } | { ok: false; errors: { shippingFee?: string } }` (rupees via `parsePriceToCents`, 0 allowed, ≤ Rs 100,000); `saveShippingSettings(value)`; `saveShippingSettingsAction` (`requireAdmin("/admin/settings")`, `revalidatePath("/", "layout")`).

- [ ] **Step 1: Failing tests** — `"350"` → 35000; `"0"` → 0; `"-1"`, `"abc"`, `"100001"` → error. Run → FAIL. Implement. Run → PASS.
- [ ] **Step 2:** Form section "Shipping" on `/admin/settings` (field in Rs with current value).
- [ ] **Step 3: Verify (owner's sign-in)** — set 400 → drawer below threshold shows Rs 400; set back to 350.
- [ ] **Step 4: Commit** — `git commit -m "Let admins set the shipping fee"`

### Task 9: Promotion form rules

**Files:**
- Create: `lib/promotion-form.ts`, `lib/promotion-form.test.ts`

**Interfaces:**
- Produces:
  - `colomboToUtcIso(local: string): string | null` (`"2026-10-31T23:59"` → `"2026-10-31T18:29:00.000Z"`; invalid → null); `utcIsoToColombo(iso: string): string` (inverse, `YYYY-MM-DDTHH:mm`).
  - `parseRule(raw: unknown): { ok: true; value: RuleInput } | { ok: false; error: string }` — `RuleInput` is the snake_case row minus ids; percent 1–90; amounts in Rs → cents, > 0, ≤ Rs 1,000,000; `free_shipping` value 0; scope lists non-empty for categories/products; min ≥ 0 (Rs → cents).
  - `parsePromotionForm(fields: Record<string, string | undefined>, mode: "create" | "update"): { ok: true; slug?: string; value: PromotionInput; rules: RuleInput[] } | { ok: false; errors: Partial<Record<PromotionFieldName, string>> }` — `rules` arrive as JSON in `fields.rules`; ≤ 10 rules; names (one required, ≤ 60); slug pattern (create only); start required, end optional and after start; banner per mode (template: headline in one language; image: `imagePath` or existing image required); hex colours; text limits from the spec.

- [ ] **Step 1: Failing tests** for every rule above, including Review Focus 5 (round-trip `2026-10-31T23:59`, and `2026-11-01T00:00` → `2026-10-31T18:30:00.000Z`). Run → FAIL. Implement. Run → PASS.
- [ ] **Step 2: Commit** — `git commit -m "Validate promotion forms"`

### Task 10: Promotion admin server

**Files:**
- Create: `lib/admin-promotions.ts`, `app/admin/promotions/actions.ts`

**Interfaces:**
- Consumes: Task 9, `toPromotion`, `save_promotion_rules`, `MAX_IMAGE_BYTES`, `imagePathFor`/`isValidImagePath` (reuse; image names `<promotion id>-<epoch ms>.<ext>` — the id is the uuid).
- Produces: `listPromotionsForAdmin()`, `getPromotionForAdmin(id)` (malformed uuid → null), `insertPromotion(slug, value): Promise<{ id: string } | "exists">`, `updatePromotion(id, value)`, `savePromotionRules(id, rules)` (rpc), `deletePromotion(id)` (row, then best-effort photo), `createPromotionImageUpload(path)`, `promotionImageExists(path)`, `setPromotionImage(id, path)`; actions `createPromotionAction`, `updatePromotionAction(id, …)`, `deletePromotionAction(id, …)` (typed slug), `requestPromotionImageUpload(id, contentType, size)` — each starting with `requireAdmin`, ending with `revalidatePath("/", "layout")` and `revalidatePath("/admin/promotions")`; image path validated and checked to exist before any write. Create flow: insert → rules → image; on a rules failure the new row is deleted.

- [ ] **Step 1:** Implement.
- [ ] **Step 2: Verify** — tsc, lint, tests.
- [ ] **Step 3: Commit** — `git commit -m "Add promotion admin data and actions"`

### Task 11: Promotion admin pages

**Files:**
- Create: `app/admin/promotions/page.tsx`, `new/page.tsx`, `[id]/page.tsx`, `PromotionForm.tsx`, `RulesEditor.tsx`, `DeletePromotion.tsx`
- Modify: `app/admin/AdminTabs.tsx` (`"promotions"` → `/admin/promotions`)

**Interfaces:**
- Consumes: Task 10, `PromoBanner` (live preview), categories and admin product list for scope pickers.
- Produces: list (status via `promotionStatus(p, new Date())`, dates in Colombo, rule summary, missing-scope warning); form with sections Basics / Schedule / Banner (mode tabs, fields, upload, preview) / Rules (`RulesEditor`: rows with kind select, value, scope radio, category checkboxes, product search-and-tick, min; add/remove; serialised into a hidden `rules` input) / Danger zone.

- [ ] **Step 1:** Implement.
- [ ] **Step 2: Verify (owner's sign-in), both languages, desktop and 375 px:** create "QA Halloween" (template banner, `percent_off 20` on Tops, `amount_off_order` Rs 500 over Rs 10,000, free shipping on Bottoms); confirm card, product page, search, drawer and `/cart` agree; nudges; create a second promotion with an image banner → home slider rotates and pauses; `/products?promo=<slug>` shows its banner and products; schedule one in the future → list says Scheduled and the shop ignores it; then delete both (photos removed).
- [ ] **Step 3: Commit** — `git commit -m "Add promotion admin pages"`

### Task 12: Docs and full verification

**Files:**
- Modify: `CLAUDE.md` (promotions engine and data flow, removed constants, `/admin/promotions`, shipping fee setting, banner bucket)

- [ ] **Step 1:** Update docs.
- [ ] **Step 2:** `npm test`, `npm run lint`, `npx tsc --noEmit`, `npm run build` (static/ISR markers unchanged) — all pass.
- [ ] **Step 3: Commit** — `git commit -m "Document promotions"`; push, open the PR, check the Vercel preview.
