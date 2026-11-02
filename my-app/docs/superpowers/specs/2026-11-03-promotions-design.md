# Promotions — Design

Date: 2026-11-03
Status: Approved in brainstorming, pending written-spec review
Scope: Spec 7 — roadmap part **P**. Builds on the bilingual shell (spec 5/6,
merged in PR #7). Lives on `feat/promotions`, branched from `main` (70d4691).

## Goal

Like the price rules in a POS: the owner creates named **promotions** (e.g.
"Halloween") with a date range, a banner, and rules for free shipping and
discounts, and customers see clearly what applies to them — on product cards,
the product page, the cart drawer and `/cart`. Shipping rules move out of code
into this system.

Success means:

- An admin creates "Halloween, 25–31 Oct, Tops 20% off, free shipping over
  Rs 3,000", with a banner, without touching code; it appears on its start
  time and disappears after its end time (within about a minute).
- A card, the product page, the drawer and `/cart` always show the same price
  for the same item.
- The cart shows what was applied ("🎃 Halloween −Rs 500", "Shipping: free
  (Halloween)") and what is close ("Add Rs 1,200 more for free shipping").
- Today's behaviour (Rs 350 shipping, free over Rs 5,000) is unchanged after
  the migration, but now lives in an editable promotion and setting.
- Catalog pages stay static/ISR.

## Decisions

| Topic | Decision |
|---|---|
| Rule kinds | `free_shipping`, `percent_off` (per item), `amount_off_item` (Rs per item), `amount_off_order` (Rs once per order) |
| Rule scope | All products, chosen categories, or chosen products; optional minimum (`min_subtotal`) measured on the scope's items |
| Sale price vs promotion | **Best price only** — an item gets the lowest of list price, `salePrice` and each matching item rule; nothing stacks per item |
| Several promotions | Per item: best price. Order discount: the single best qualifying one. Free shipping: any qualifying rule |
| Free shipping for items/categories | One qualifying item in the cart makes the **whole order** ship free |
| Order discount | Applied after item prices (it may combine with a sale price), never more than the subtotal |
| Base shipping | `store_settings.shipping_fee` (Rs 350), edited in `/admin/settings` |
| Free over Rs 5,000 | Becomes a seeded, always-on promotion (no end date, no banner) |
| Banner | `none`, `template` (bilingual text + colours + optional photo + button), or `image` (uploaded artwork + bilingual alt) |
| Banner placement | Home page top (slider when several), and `/products?promo=<slug>` |
| Engine | Pure TypeScript in `lib/promotions.ts`, shared by server (cards, pages) and client (drawer, `/cart`) |
| Timing | Server decides which promotions are active at render; ISR (`revalidate = 60`) means up to ~1 minute lag at start/end |
| Out of scope | Coupon codes, Buy X Get Y, per-customer or total usage limits, notifications |

## Data

New migration `supabase/migrations/<version>_create_promotions.sql`, applied
to the remote project with MCP `apply_migration` and saved with the reported
version. It only adds objects, so the production code on `main` (which still
uses the constants) is unaffected and it can be applied before the code ships.

```sql
alter table public.store_settings
  add column shipping_fee integer not null default 35000
  check (shipping_fee >= 0 and shipping_fee <= 10000000);

create table public.promotions (
  id              uuid primary key default gen_random_uuid(),
  slug            text not null unique
                  check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) <= 60),
  name_si         text not null default '' check (length(name_si) <= 60),
  name_en         text not null default '' check (length(name_en) <= 60),
  starts_at       timestamptz not null default now(),
  ends_at         timestamptz,
  active          boolean not null default true,
  sort_order      integer not null default 0,
  banner_mode     text not null default 'none' check (banner_mode in ('none', 'template', 'image')),
  headline_si     text not null default '' check (length(headline_si) <= 80),
  headline_en     text not null default '' check (length(headline_en) <= 80),
  subtext_si      text not null default '' check (length(subtext_si) <= 160),
  subtext_en      text not null default '' check (length(subtext_en) <= 160),
  button_si       text not null default '' check (length(button_si) <= 30),
  button_en       text not null default '' check (length(button_en) <= 30),
  color_from      text not null default '#cb4a1c' check (color_from ~ '^#[0-9a-f]{6}$'),
  color_to        text not null default '#15231d' check (color_to ~ '^#[0-9a-f]{6}$'),
  text_color      text not null default '#ffffff' check (text_color ~ '^#[0-9a-f]{6}$'),
  image_url       text,
  image_alt_si    text not null default '' check (length(image_alt_si) <= 160),
  image_alt_en    text not null default '' check (length(image_alt_en) <= 160),
  created_at      timestamptz not null default now(),
  check (length(btrim(name_si)) > 0 or length(btrim(name_en)) > 0),
  check (ends_at is null or ends_at > starts_at)
);

create table public.promotion_rules (
  id             uuid primary key default gen_random_uuid(),
  promotion_id   uuid not null references public.promotions (id) on delete cascade,
  kind           text not null
                 check (kind in ('free_shipping', 'percent_off', 'amount_off_item', 'amount_off_order')),
  value          integer not null default 0 check (value >= 0),
  scope          text not null default 'all' check (scope in ('all', 'categories', 'products')),
  category_slugs text[] not null default '{}',
  product_ids    text[] not null default '{}',
  min_subtotal   integer not null default 0 check (min_subtotal >= 0),
  sort_order     integer not null default 0
);
create index promotion_rules_promotion_idx on public.promotion_rules (promotion_id);
```

- `value`: percent (1–90) for `percent_off`, cents for the `amount_*` kinds,
  0 for `free_shipping`. Rule-level validation lives in the app (`parseRule`).
- Scope lists hold slugs / product ids without foreign keys, so deleting a
  category or product never breaks a promotion; missing entries are ignored
  and flagged in the admin list.
- RLS on both tables. Public SELECT on `promotions` where `active`, and on
  `promotion_rules` whose promotion is active (`exists` subquery). No write
  grants; writes go through the secret-key client.
- `save_promotion_rules(p_promotion_id uuid, p_rules jsonb)`: a
  `security invoker` SQL function, executable only by `service_role`, that
  deletes and re-inserts a promotion's rules in one transaction.
- Storage: public bucket `promotion-images` (JPEG/PNG/WebP, ≤ 5 MB), uploads by
  signed URL as for product photos, files named `<promotion id>-<epoch ms>.<ext>`.
- Seed: one promotion `free-shipping` ("නොමිලේ බෙදාහැරීම" / "Free shipping"),
  `starts_at = now()`, no end, `banner_mode = 'none'`, one rule
  `free_shipping`, scope `all`, `min_subtotal = 500000`.
- `next.config.ts` `images.remotePatterns` already allows the whole public
  Storage path, so banner photos need no config change (verify).

## Engine — `lib/promotions.ts` (pure, client-safe, tested)

Types:

```ts
type RuleKind = "free_shipping" | "percent_off" | "amount_off_item" | "amount_off_order";
type PromotionRule = { kind: RuleKind; value: number; scope: "all" | "categories" | "products";
  categorySlugs: string[]; productIds: string[]; minSubtotal: number };
type Promotion = { id; slug; nameSi; nameEn; startsAt: string; endsAt: string | null;
  active: boolean; sortOrder: number; banner: PromotionBanner; rules: PromotionRule[] };
type PromotionBanner =
  | { mode: "none" }
  | { mode: "template"; headlineSi; headlineEn; subtextSi; subtextEn; buttonSi; buttonEn;
      colorFrom; colorTo; textColor; imageUrl: string | null }
  | { mode: "image"; imageUrl: string; altSi; altEn };
/** A rule with a minimum that applies to a product once the cart qualifies. */
type ConditionalOffer = { promotion: Promotion; rule: PromotionRule };
```

Functions:

- `isRunning(promotion, now: Date): boolean` and
  `promotionStatus(promotion, now): "running" | "scheduled" | "ended" | "off"`.
- `ruleMatches(rule, product, categories): boolean` — scope test; a product's
  category is resolved with `resolveCategoryParam`.
- `itemPricing(product, promotions, categories)` →
  `{ price, compareAt: number | null, promotion: Promotion | null, discountPercent: number | null, conditional: ConditionalOffer[] , freeShipping: Promotion | null }`:
  lowest of list price, `salePrice` and every matching `percent_off` /
  `amount_off_item` rule **with no minimum**; `%` results rounded to the
  nearest cent; never below 0. Ties keep the sale price. Rules with a
  minimum are returned in `conditional` (shown as a badge, not priced).
  `freeShipping` is a running promotion with a `free_shipping` rule that
  matches the product and has no minimum.
- `summarizeCart(lines, products, promotions, settings, categories)` (replaces
  today's signature in `lib/cart-summary.ts`):
  1. Base price per line = `effectivePrice` (list or sale).
  2. For each rule with a minimum, its scope total = sum of base prices of
     matching lines; qualifies when ≥ `min_subtotal` (measured before
     promotions, so a discount can never undo its own condition).
  3. Unit price per line = lowest of base price and every qualifying item
     rule; the line records the winning promotion.
  4. Order discount = the largest qualifying `amount_off_order` rule, capped
     at the subtotal; recorded with its promotion.
  5. Shipping = 0 when any qualifying `free_shipping` rule has at least one
     matching line in the cart (all scope: any line), else
     `settings.shippingFee`; 0 for an empty cart.
  6. `nudges`: for unmet rules whose scope has matching lines (or scope all),
     `{ promotion, kind, missing: min_subtotal − scope total }`, smallest
     first; the drawer and `/cart` show the first free-shipping nudge as the
     progress bar and the first discount nudge as a line.
  Returns `{ items: [{ line, product, unitPrice, compareAt, promotion }], itemCount, subtotal, orderDiscount: { amount, promotion } | null, shipping, freeShippingBy: Promotion | null, total, nudges }`.
- `freeShippingThreshold(promotions)`: the smallest `min_subtotal` among
  running `free_shipping` rules with scope `all`, or `null` — drives the
  promise-strip line (absent when `null`).
- `cartBadgeCount` keeps working on lines whose product exists.

The constants `FREE_SHIPPING_THRESHOLD` and `SHIPPING_FLAT` are removed from
`lib/products.ts`; every caller moves to the engine.

## Data flow

- `lib/storefront.ts` gains `getRunningPromotions()` (cookie-less, `cache()`):
  active promotions with their rules, filtered by `isRunning(now)` at render,
  ordered by `sort_order`; `[]` on error (logged). `getStoreSettings()` returns
  `shippingFee` too (default 35000).
- Server pages compute item prices with `itemPricing` for cards and the
  product page. The root layout passes running promotions and `shippingFee`
  to the client shell (drawer, search prices, promise strip); `CartView` gets
  them from `/cart`'s page. Client code never decides what is running by its
  own clock, so server and client agree.
- Admin writes call `revalidatePath("/", "layout")`.

## What customers see

- **ProductCard / product page:** promotion price, struck original
  (`compareAt`), and a badge with the promotion's name and `−N%`
  (`🎃 Halloween −20%`); `🚚 Free shipping` tag when `freeShipping` is set;
  conditional offers as a small line (e.g. "Rs 10,000+ ඇණවුම්වලට 20% off").
  The product page adds the promotion's end date when it has one.
- **Drawer and `/cart`:** per line the unit price, struck original and
  promotion name; summary rows Subtotal, order discount (`🎃 Halloween
  −Rs 500`), Shipping (`Free (Halloween)` / amount), Total; the free-shipping
  progress bar follows the first free-shipping nudge; the first discount nudge
  shows as a hint.
- **Home:** `PromoBanners` above the hero — template banners (gradient,
  headline, subtext, optional photo, button linking to `/products?promo=<slug>`)
  and image banners (artwork as a link, bilingual alt). One banner: static.
  Several: a slider rotating every 6 s with dots and a pause button; no
  auto-rotation under `prefers-reduced-motion`.
- **`/products?promo=<slug>`:** that promotion's banner on top, products whose
  price or shipping it affects (scope all → all). Unknown/finished slug → all
  products, no banner. `view=deals` also includes products a running
  promotion discounts (sorted by best discount).
- **Promise strip / footer:** the free-shipping line comes from
  `freeShippingThreshold`; hidden when no such rule is running.

## Admin

- `/admin/promotions` (new AdminTabs entry): list with name, status badge
  (🟢 Running, 🕒 Scheduled, ⚪ Ended, ⏸ Off), dates, one-line rule summary,
  and a warning when a scope references a missing category or product.
- New / edit form (`onSubmit` + `startTransition` pattern):
  - Names සිං/EN; slug on create only (immutable).
  - Start and optional end as `datetime-local`, interpreted as Asia/Colombo
    (UTC+05:30, no DST); stored as `timestamptz`.
  - Active switch; sort order.
  - Banner mode None / Template / Image with the fields above, photo upload
    (signed URL → `promotion-images`), and a live preview.
  - Rules editor: rows added/removed on the client, submitted as one JSON
    field: kind, value (% or Rs), scope (all / category checkboxes / product
    search-and-tick), optional "orders over Rs X".
  - Danger zone: delete after typing the slug (rules cascade; photo removed
    best-effort).
- `/admin/settings` gains **Shipping fee (Rs)**, saved with the language
  settings form's pattern (`parseShippingSettings`).
- Validation (pure, tested) in `lib/promotion-form.ts`:
  `parsePromotionForm(fields, mode)` and `parseRule(raw)` —
  names (one required, ≤ 60), slug rule, dates (end after start), percent
  1–90, amounts > 0 and ≤ Rs 1,000,000, scope lists non-empty for
  categories/products, min ≥ 0, template banner needs a headline in one
  language, image banner needs an uploaded image, at most 10 rules,
  hex colours.
- Server: `lib/admin-promotions.ts` (secret key) and
  `app/admin/promotions/actions.ts`; every action starts with
  `await requireAdmin(...)`; rules saved via `save_promotion_rules`; image
  path checked (`isValidImagePath`-style, exists) before anything is written.

## Error handling

- Promotions can't be read → no promotions: list/sale prices, the shipping
  fee, no banners, no free-shipping strip line; logged. (No checkout exists,
  so nobody is charged a wrong amount.)
- Settings can't be read → shipping fee 35000.
- Rules referencing deleted products/categories simply match nothing.
- A failed photo upload or invalid image path saves nothing.
- Admin errors keep the form input and show field messages; unexpected
  failures show "Something went wrong, please try again."

## Testing

- `lib/promotions.test.ts`: `isRunning`/`promotionStatus` at the boundaries;
  best price (list vs sale vs %, vs Rs, ties, never below 0, rounding);
  scope by category (slug or old name) and product; conditional rules not
  priced on cards; cart minimums measured before discounts; order discount
  picks the best and caps at subtotal; free shipping from one qualifying item;
  free shipping threshold exactly at / one cent below; nudges; empty cart;
  missing products; `freeShippingThreshold`.
- `lib/promotion-form.test.ts`: every validation rule above, Colombo time
  conversion.
- Existing `cart-summary` tests move to the new signature with a seeded
  free-shipping promotion and must still pass with the same numbers.
- `npm run lint`, `npx tsc --noEmit`, `npm run build` (static/ISR markers for
  `/`, `/cart`, `/products/[id]` unchanged).
- Browser (owner's Google sign-in): create a test promotion with a template
  banner and a % rule on one category plus an order rule with a minimum;
  check card, product page, drawer and `/cart` agree; nudges; slider with two
  banners; image banner; phone width; both languages; then delete it.

## Rollout

1. Apply the migration (additive) and verify the seed promotion and
   `shipping_fee`.
2. Implement on `feat/promotions`; PR → Vercel preview → owner check → merge.
3. After deploy, confirm production still charges Rs 350 below Rs 5,000 and
   shows the free-shipping strip line.
