# Home Page and Product Cards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dense 2/3/5-column product cards with quick add-to-cart, and a deal-led home page with only real urgency and real promises.

**Architecture:** Server-rendered cards and sections stay static/ISR; interactivity lives in two small client islands (`QuickAdd`, `CategoryShelf`). Pure selection logic (`lib/home-sections.ts`) decides deals, the countdown end and shelf contents, and is unit-tested.

**Tech Stack:** Next.js 16.4 App Router, React 19.2, Tailwind v4 tokens, Vitest 4.

**Spec:** `docs/superpowers/specs/2026-11-03-home-and-cards-design.md`

## Global Constraints

- Read the relevant guide under `node_modules/next/dist/docs/` before writing Next.js code.
- `/`, `/cart`, `/products/[id]` must still build as static/ISR; no `cookies()`/`auth()` in them.
- Prices through `formatPrice`; card prices come from `product.pricing` (never recomputed in the client).
- Only real data: no ratings, sold counts or stock; no countdown without a real promotion `endsAt`.
- Customer-facing text bilingual (`<L>`, `tr`); design tokens only (`text-blaze`, `bg-panel`, …).
- No button inside a link.
- No horizontal page scroll at 375 px.

## Review Focus

1. A product with an empty `sizes` array must not render a quick-add button that adds a blank size — tested in Task 2 (`quickAddMode`).
2. A deal priced only by `salePrice` must not produce a countdown — tested in Task 1.
3. A product whose category is stored under an old display name must appear under its category tab — tested in Task 1.
4. Opening the size picker on one card and clicking another card's 🛒 must leave only one picker open and the drawer state consistent — browser check in Task 2.
5. Keyboard users must reach the 🛒 button, pick a size with the keyboard and get focus back on Esc — browser check in Task 2.

---

### Task 1: Home selection rules

**Files:**
- Create: `lib/home-sections.ts`, `lib/home-sections.test.ts`

**Interfaces:**
- Produces: `dealProducts<T extends PricedProduct>(products: T[], limit = 15): T[]`; `soonestDealEnd(deals: PricedProduct[], promotions: Promotion[]): string | null`; `shelfProducts<T extends PricedProduct>(products: T[], category: Category | null, categories: Category[], limit = 15): { items: T[]; more: boolean }`; `savedAmount(pricing: ItemPricing): number | null`.

- [ ] **Step 1: Failing tests** (fixtures via `withPricing` and `lib/test-fixtures/promotions.ts`):
  - `dealProducts`: only discounted products, largest `discountPercent` first, ties keep catalog order, `limit` respected.
  - `soonestDealEnd`: sale-only deals → `null`; two promotion-priced deals ending at different times → the earlier ISO; a promotion with no end → ignored.
  - `shelfProducts`: `null` → all (cut to limit, `more: true` when cut); `tops` includes a product stored as `"Tops"`; `more: false` when it fits.
  - `savedAmount`: `{ price: 800000, compareAt: 1000000 }` → `200000`; no `compareAt` → `null`.
- [ ] **Step 2:** `npx vitest run lib/home-sections.test.ts` → FAIL (module not found).
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** → PASS.
- [ ] **Step 5: Commit** — `git commit -m "Add home page selection rules"`

### Task 2: Dense cards, quick add and the shared grid

**Files:**
- Create: `app/components/QuickAdd.tsx`, `app/components/ProductGrid.tsx`
- Modify: `app/components/ProductCard.tsx`, `app/products/page.tsx`, `app/products/[id]/page.tsx`, `lib/home-sections.ts` (+ test)

**Interfaces:**
- Consumes: `savedAmount`, `addItem`, `openCartDrawer`, `useLang`, `tr`.
- Produces: `quickAddMode(sizes: string[]): "none" | "single" | "pick"` (in `lib/home-sections.ts`, tested); `QuickAdd({ productId, name, sizes })`; `ProductGrid({ products }: { products: PricedProduct[] })`; a module-level "open picker" id so only one picker is open at a time.

- [ ] **Step 1: Failing test** — `quickAddMode([])` → `"none"`, `["One size"]` → `"single"`, `["S","M"]` → `"pick"`. Run → FAIL. Implement. Run → PASS.
- [ ] **Step 2:** Rebuild `ProductCard` as `<article>` per the spec (photo link with badge, name link with 2-line clamp, large price, struck price, "Save Rs X", 🚚/conditional line; spec line removed) with `QuickAdd` positioned over the photo's bottom-right.
- [ ] **Step 3:** `QuickAdd` per the spec (single → add + drawer; pick → size panel over the photo, first pill focused, Esc/outside close with focus back, only one open across cards).
- [ ] **Step 4:** `ProductGrid` (`grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 lg:grid-cols-5`); use it on `/products` and the product page's related list.
- [ ] **Step 5: Verify** — tests, lint, tsc; browser desktop + 375 px: one-size and multi-size quick add by mouse and keyboard, Esc returns focus, opening a second picker closes the first, drawer opens with the line; no horizontal scroll.
- [ ] **Step 6: Commit** — `git commit -m "Add dense product cards with quick add"`

### Task 3: Home page sections

**Files:**
- Create: `app/components/DealsRow.tsx`, `app/components/CategoryShelf.tsx`, `app/components/HomeHero.tsx`, `app/components/PromiseCards.tsx`
- Modify: `app/page.tsx`, `app/components/FlashCountdown.tsx`

**Interfaces:**
- Consumes: Task 1 and 2 exports, `getVisiblePromises`, `promiseItems`, `freeShippingThreshold`, `PromoBanners`.
- Produces: `FlashCountdown({ endsAt }: { endsAt: string })` (days when > 24 h; nothing at zero); `DealsRow({ deals, endsAt })`; `CategoryShelf({ products, categories })` (tablist with arrow keys, instant switching, "See all in … →"); `HomeHero({ hero })` (compact); `PromiseCards({ items })`.

- [ ] **Step 1:** Implement the components and rewrite `app/page.tsx` in the spec's order (hero only when no running promotion has a banner; remove category tiles, Featured and the hard-coded `PROMISES`).
- [ ] **Step 2: Verify** — lint, tsc, tests, `npm run build` (static markers unchanged); browser desktop + 375 px, සිං/EN: no deals countdown with only sale prices; create a test promotion with an end date and a % rule → countdown shows and hero hides behind its banner; shelf tabs by mouse and arrow keys; promise cards match `/admin/promises`; then delete the test promotion.
- [ ] **Step 3: Commit** — `git commit -m "Rebuild the home page around deals and categories"`

### Task 4: Docs and verification

**Files:**
- Modify: `CLAUDE.md` (cards/QuickAdd/ProductGrid, home sections, countdown rule, removed tiles/featured)

- [ ] **Step 1:** Update docs.
- [ ] **Step 2:** `npm test`, `npm run lint`, `npx tsc --noEmit`, `npm run build` — all pass.
- [ ] **Step 3: Commit** — `git commit -m "Document the home page and product cards"`; then final review, push, PR.
