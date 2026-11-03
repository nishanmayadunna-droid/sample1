# Home Page and Product Cards — Design

Date: 2026-11-03
Status: Approved in brainstorming, pending written-spec review
Scope: Spec 8 — roadmap part **2**. Builds on the shell (PR #7) and promotions
(PR #8). Lives on `feat/home-cards`, branched from `main` (9569e07).

## Goal

A denser, deal-driven storefront that sells more, in Northbound's own identity
and with only real data: product cards with a quick add-to-cart, a 5-column
grid, and a home page that leads with promotions and deals.

Success means:

- A shopper can add any product to the cart from a card in one or two taps
  (two when a size must be picked), and the cart drawer opens.
- Desktop shows 5 cards a row, tablet 3, phone 2; no horizontal page scroll at
  375 px.
- Every card shows the price the shopper will pay, the struck list price and
  how much they save, matching the product page and the cart.
- The home page never shows invented urgency: a countdown appears only for a
  running promotion's real end time.
- The home promise row shows the admin's real promises, not hard-coded claims.
- `/`, `/cart` and `/products/[id]` stay static/ISR.

## Decisions

| Topic | Decision |
|---|---|
| Quick add | 🛒+ button on every card. One size → add and open the drawer. Several → a size picker over the photo; picking a size adds and opens the drawer |
| Grid | 2 / 3 / 5 columns (phone / `sm` / `lg`), tighter gaps, shared `ProductGrid` |
| Card content | Name (2 lines), large orange price, struck list price, "Save Rs X", promo badge, 🚚 / conditional line. Spec line removed (stays on the product page) |
| Card markup | `<article>`; links on the photo and the name only (a button may not sit inside a link) |
| Hero | Hidden while a promotion banner is running; otherwise a compact hero |
| Home order | Promotion banners → (compact hero) → ⚡ Flash Deals row → category shelf → promises row → newsletter |
| Countdown | Only to the soonest `endsAt` among running promotions that discount a shown deal; none otherwise. The midnight "Ends tonight" countdown is removed |
| Removed | Category tiles (the shelf's pills replace them), the Featured section, the hard-coded promises row |
| Out of scope | Ratings, sold counts, stock (part 4); product page redesign (part 3); category `swatch` stays in the data but is unused on the home page |

## Components

### `lib/home-sections.ts` (pure, tested)

- `dealProducts<T extends PricedProduct>(products: T[], limit = 15): T[]` —
  products with `pricing.compareAt != null`, largest
  `pricing.discountPercent` first, ties by catalog order.
- `soonestDealEnd(deals: PricedProduct[], promotions: Promotion[]): string | null`
  — the earliest `endsAt` among promotions that set a shown deal's price
  (`pricing.promotion`); sale-price-only deals don't count; `null` when none
  has an end.
- `shelfProducts<T extends PricedProduct>(products: T[], category: Category | null, categories: Category[], limit = 15): { items: T[]; more: boolean }`
  — all products for `null`, else `productsInCategory`; `more` when the list
  was cut.
- `savedAmount(pricing: ItemPricing): number | null` — `compareAt − price`
  when discounted.

### `ProductCard` (server) and `QuickAdd` (client island)

- `<article className="group">`: photo link (badge top-left: `−N%` and the
  promotion name), name link (2-line clamp), price block (`text-blaze`, larger
  than today), struck `compareAt`, "ඉතුරුයි Rs X / Save Rs X", then 🚚 or the
  first conditional offer.
- `QuickAdd({ productId, name, sizes })` sits at the photo's bottom-right:
  - Button `aria-label` "Add <name> to cart" (bilingual via `tr`).
  - One size → `addItem(id, size)` + `openCartDrawer()`.
  - Several → toggles a panel over the lower part of the photo listing size
    pills (`role="group"`, label "Choose a size"); first pill gets focus;
    picking one adds, closes and opens the drawer; Esc or a click outside
    closes and returns focus to the button.
  - No sizes → not rendered.
- `ProductGrid({ products })`: `grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 lg:grid-cols-5`;
  used by `/products`, the product page's related list and the home shelf.

### Home page (`app/page.tsx`)

1. `PromoBanners` (unchanged).
2. Compact hero (`HomeHero`), only when no running promotion has a banner:
   same copy and hero product, about half today's height.
3. `DealsRow` (server): heading "⚡ Flash Deals", optional countdown,
   "All deals →" to `/products?view=deals`; a horizontal, snap-scrolling row
   of fixed-width cards (`w-40 sm:w-48`); hidden when there are no deals.
4. `CategoryShelf` (client): pill tabs "සියල්ල / All" + each category with
   products (`role="tablist"`, arrow keys move between tabs), the grid of
   `shelfProducts`, and "See all in <category> →" when `more`. Receives the
   priced products and categories from the page; switching tabs is instant.
5. Promises row: `promiseItems(getVisiblePromises(), freeShippingThreshold(promotions))`
   rendered as icon cards (replaces the hard-coded `PROMISES`).
6. `Newsletter` (unchanged).

`FlashCountdown` changes to `FlashCountdown({ endsAt }: { endsAt: string })`,
counting to that instant; it shows days when more than 24 h remain and
renders nothing once it reaches zero.

## Data flow

`app/page.tsx` reads products, categories, running promotions and visible
promises in parallel (all cookie-less, ISR 60 s), prices products once with
`withPricing`, and passes slices to the sections. No new tables or reads.

## Error handling

- Empty deals → no deals row. Categories without products → no pill. No
  products at all → the shelf shows "No products yet".
- Quick add only writes to the existing cart store; failures there are
  unchanged (local storage).

## Testing

- `lib/home-sections.test.ts`: deals order and limit; sale-only deals give no
  countdown; soonest end among promotion-priced deals; shelf all / category /
  old category name / `more`; saved amount.
- Lint, `tsc`, `npm run build` (static markers unchanged).
- Browser, desktop and 375 px, සිං and EN: quick add for a one-size and a
  multi-size product (mouse and keyboard, Esc), drawer opens; deals row
  scrolls; shelf tabs by mouse and arrow keys; no horizontal page scroll;
  countdown appears only with a test promotion that has an end date (then
  delete it).
