# Sinhala / English and the Marketplace Shell — Design

Date: 2026-11-03
Status: Approved in brainstorming, pending written-spec review
Scope: Specs 5 (I — language foundation) and 6 (1 — shell). First two parts of
the marketplace redesign roadmap below. Lives on `feat/i18n-shell`; implementation
starts only after `feat/categories` is merged into `main` (the shell's category
menu and footer read `getCategories()`).

## Roadmap (context)

The owner wants the shop to feel like a dense, deal-driven marketplace (Temu was
the reference), to sell more, and to earn customer trust — without copying
another brand and without showing invented data. The work is split into parts,
each with its own spec → plan → PR:

| # | Part | Notes |
|---|---|---|
| **I** | Language foundation (සිං / EN) | this spec |
| **1** | Shell: promise strip, header, search, nav, cart drawer, footer | this spec |
| P | Promotions: named campaigns (e.g. "Halloween") with date ranges, banners and rules (free shipping over Rs X / for items / for categories, discounts), shown clearly on cards, drawer and cart | next; moves shipping rules out of code |
| 2 | Home page + dense product cards | |
| 3 | Product page (gallery, size pills, delivery chips) | |
| 4 | Reviews / ratings and real stock ("Only N left") | |

Northbound is a separate business from the owner's FMCG POS (`C:\dev\pos`);
there is no integration. The POS's bilingual approach is reused as a pattern.

Rules that hold for every part:

- Only real data is shown: no invented ratings, "sold" counts, stock or
  urgency. There are no orders yet, so "sold" counts and "verified purchase"
  are out until an orders system exists.
- Northbound's own identity (name, Anton/Geist, the `blaze` accent) stays; no
  other brand's logo, names or wording.

## Goal

Customers can use the shop in Sinhala or English, and the shop gets a
marketplace-style frame: a promise strip, a header with a large search box and
deal links, a slide-out cart drawer and a full footer.

Success means:

- A first-time visitor sees the shop in the admin's default language (Sinhala
  out of the box), with no flash of the other language.
- A visitor can switch සිං / EN from the header at any time; the choice is
  remembered and pages switch instantly without reloading.
- The admin can change the default language and turn the second language off;
  with it off the toggle disappears and every visitor sees the default.
- Every catalog page stays static/ISR (no `cookies()` or `auth()` on them).
- Typing in the search box shows matching products at once; Enter opens the
  full results.
- Flash Deals, Top Picks, New In and a category menu filter `/products`.
- Adding to cart opens a drawer showing the lines, subtotal and how far the
  cart is from free shipping; the drawer and `/cart` always agree on the money.
- The admin can edit up to three extra promises shown in the strip and footer.

## Decisions

| Topic | Decision |
|---|---|
| Language mechanism | Both texts in the HTML, CSS hides the inactive one (`html[data-lang]`), as in the POS (`apps/cloud/app/ui.tsx`) |
| Language choice | `nb_lang` cookie, set by the toggle; read by an inline `<head>` script, never by the server |
| URLs | Unchanged (no `/si`, `/en` segments) |
| Default language | Admin setting, initially `si` |
| Second language | Admin on/off (`bilingual`), initially on |
| Translated | All customer-facing UI text |
| Not translated (yet) | Admin pages, product names/descriptions, category names, `<title>`/meta description |
| Sinhala font | Noto Sans Sinhala via `next/font`, as a fallback in the sans and display stacks |
| Shell data | Root layout reads products, categories, promises and store settings with the cookie-less catalog client and passes them to client components |
| Search | Client-side over the products already sent to the browser; dropdown of 5; Enter → `/products?q=` |
| Nav | ⚡ Flash Deals (`view=deals`), ⭐ Top Picks (`view=picks`), 🆕 New In (`view=new`), Categories ▾ |
| Cart | Slide-out drawer (not a permanent sidebar) |
| Promises | Free-shipping promise always first, from code constants (moves to Promotions in part P); plus ≤ 3 admin promises |
| Out of scope | Promotions, banners, card/home redesign, product page, reviews, stock, Sinhala product content, a language switcher in admin, payment logos, chat/support |

## Data

New migration `supabase/migrations/<version>_create_storefront_settings.sql`,
applied to the remote project and saved locally with the matching version. It
only adds tables, so the production code on `main` is unaffected and it can be
applied before the code ships.

```sql
create table public.store_settings (
  id           boolean primary key default true check (id),
  default_lang text not null default 'si' check (default_lang in ('si', 'en')),
  bilingual    boolean not null default true,
  updated_at   timestamptz not null default now()
);
insert into public.store_settings default values;

create table public.store_promises (
  id         uuid primary key default gen_random_uuid(),
  icon       text not null check (icon in ('truck', 'box', 'return', 'shield', 'tag')),
  text_si    text not null default '' check (length(text_si) <= 60),
  text_en    text not null default '' check (length(text_en) <= 60),
  sort_order integer not null default 0,
  visible    boolean not null default true,
  created_at timestamptz not null default now(),
  check (length(btrim(text_si)) > 0 or length(btrim(text_en)) > 0)
);

alter table public.store_settings enable row level security;
alter table public.store_promises enable row level security;
create policy "Store settings are publicly readable"
  on public.store_settings for select to anon, authenticated using (true);
create policy "Visible promises are publicly readable"
  on public.store_promises for select to anon, authenticated using (visible);
revoke all on table public.store_settings, public.store_promises from anon, authenticated;
grant select on table public.store_settings, public.store_promises to anon, authenticated;

insert into public.store_promises (icon, text_si, text_en, sort_order) values
  ('box',    'දිවයින පුරා බෙදාහැරීම, වැඩ කරන දින 3–5', 'Island-wide delivery, 3–5 working days', 1),
  ('return', 'දින 7ක් ඇතුළත පහසු ආපසු භාරදීම',        '7-day easy returns',                     2);
```

`store_settings` has exactly one row (`id = true`). Writes go through the
secret-key client only. The "at most 3 visible promises" rule is enforced by
the admin action, not the database.

## Part I — language foundation

### `lib/i18n.ts` (pure, client-safe, tested)

- `type Lang = "si" | "en"`, `LANG_COOKIE = "nb_lang"`.
- `type LangSettings = { defaultLang: Lang; bilingual: boolean }`,
  `DEFAULT_LANG_SETTINGS = { defaultLang: "si", bilingual: true }`.
- `resolveLang(cookieValue: string | undefined, settings): Lang` — when
  `bilingual` is off, always `defaultLang`; otherwise the cookie value if it is
  `"si"`/`"en"`, else `defaultLang`.
- `tr(lang, si, en)` — picks one string (attributes, alerts, options). When one
  side is empty it falls back to the other.
- `langBootScript(settings): string` — the inline script's source: reads
  `document.cookie`, applies `resolveLang`'s rules, sets
  `document.documentElement.lang` and `.dataset.lang`. Settings are embedded
  with `JSON.stringify`. Tests execute the returned string against a stub
  `document` to prove it agrees with `resolveLang`.

### `app/components/L.tsx` (server-safe, no `"use client"`)

```tsx
export function L({ si, en }: { si: string; en: string }) {
  return (<><span className="l-si">{si}</span><span className="l-en">{en}</span></>);
}
```

`globals.css`: `html[data-lang="si"] .l-en, html[data-lang="en"] .l-si { display: none; }`.
Hidden text is `display: none`, so screen readers read only the active language.
An empty side falls back to the other at render time.

### Root layout

- Reads `getStoreSettings()` (see Shell data); on failure uses
  `DEFAULT_LANG_SETTINGS`.
- Renders `<html lang={defaultLang} data-lang={defaultLang} suppressHydrationWarning>`
  and, first in `<head>`, `<script dangerouslySetInnerHTML={{ __html: langBootScript(settings) }} />`
  so the attribute is correct before first paint. (Read the bundled Next 16
  docs on scripts in the root layout before implementing; use the documented
  way to put a blocking inline script in `<head>`.)
- No `cookies()`: the page HTML is the same for every visitor.

### Client language state — `app/context/LangContext.ts`

Like the cart store, a module store on `useSyncExternalStore`, not React Context:

- `useLang(): Lang` — client snapshot from `document.documentElement.dataset.lang`;
  server snapshot is the layout's default language, so hydration matches.
- `setLang(lang)` — writes `nb_lang=<lang>; Path=/; Max-Age=31536000; SameSite=Lax`,
  updates `lang`/`data-lang` on `<html>`, notifies subscribers.

### Toggle — `app/components/LangToggle.tsx`

A two-segment `සිං | EN` button group (`aria-pressed` on the active one). Rendered
only when `bilingual` is true (the layout passes it down).

### Fonts and type

- Add `Noto_Sans_Sinhala` (`next/font/google`, subset `sinhala`, weights 400/700)
  as `--font-sinhala`.
- Body stack: Geist, then `--font-sinhala`. `.display`: Anton, then
  `--font-sinhala` at weight 700. `.eyebrow`: mono, then `--font-sinhala`.
- `html[data-lang="si"] .display` gets a looser `line-height` (≈ 1.15) because
  Sinhala glyphs are taller; uppercase transforms do nothing to Sinhala.

### What gets translated

All customer-facing UI text: announcement/promise strip, header, nav, search,
drawer, footer, home, `/products`, product page chrome (size labels, buttons,
spec labels), `/cart`, `/signin`, `/account`, empty and error states, and the
newsletter's client-side messages. Server actions that return user-facing errors
(sign-up) return codes; the client maps codes to `{ si, en }` pairs.

Sinhala copy is drafted by Claude and reviewed by the owner before merge.

### Admin: `/admin/settings` → Language

- Default language: සිංහල / English (radio).
- "Show the language switcher (සිං / EN)": checkbox (`bilingual`).
- Action `saveLanguageSettingsAction` starts with `await requireAdmin(...)`,
  validates with `parseLanguageSettings` (pure, tested, in `lib/storefront-form.ts`),
  updates the row, then `revalidatePath("/", "layout")`.
- A note under the checkbox: visitors who already chose a language keep it
  while the switcher is on; turning it off sends everyone to the default.

## Part 1 — shell

### Shell data — `lib/storefront.ts` (server-only, cookie-less client)

`getStoreSettings()`, `getVisiblePromises()` (ordered by `sort_order`), each in
React `cache()`, plus the existing `getAllProducts()` and `getCategories()`.
The root layout reads all four in parallel. Each failure is caught separately
and logged; the shell falls back to defaults (settings), `[]` (promises,
products, categories). The root layout gets `export const revalidate = 60` like
the catalog pages; admin writes call `revalidatePath("/", "layout")`.

Only the fields the client needs are passed down (`id`, `name`, `price`,
`salePrice`, `imageUrl`, `swatch`, `categoryName`, `category`, `sizes`,
`description`, `featured`, `createdAt`) as a `ShellProduct[]`.

### Promise strip — `app/components/PromiseStrip.tsx`

Replaces `AnnouncementBar`. Black (`bg-panel`) strip at the very top:

1. 🚚 Free shipping over `formatPriceWhole(FREE_SHIPPING_THRESHOLD)` — always
   first, built from the code constants (part P replaces this).
2. Up to 3 visible admin promises, each an icon + `<L>` text.

Desktop: one row, separated by thin rules. Under `sm`: one promise at a time,
cross-fading every 4 s; with `prefers-reduced-motion` only the first is shown.

### Header — `app/components/Header.tsx` (client)

Sticky. Row 1: logo · search box (grows to fill) · `LangToggle` · account
(`AccountNav`) · 🛒 with an orange count badge (opens the drawer). Under `sm`
the search box moves to its own row below. Row 2 (nav): ⚡ Flash Deals · ⭐ Top
Picks · 🆕 New In · Categories ▾; scrolls sideways on small screens. The
categories menu is a disclosure button (`aria-expanded`) listing every category
→ `/products?category=<slug>`, closes on Esc / outside click, works with Tab.
`SessionProvider`, `AccountNav` and `CartSync` stay as they are.

### Search — `app/components/SearchBox.tsx`

- Combobox pattern (`role="combobox"`, `aria-expanded`, `aria-controls`,
  `aria-activedescendant`); ↑/↓ move, Enter opens the highlighted product or,
  with none highlighted, `/products?q=<text>`; Esc closes.
- From 2 characters, shows up to 5 matches: photo, name, price (struck list
  price when on sale). No matches: "No matches" + a Flash Deals link.
- Placeholder via `tr()`.
- Matching is `matchesQuery` from `lib/product-filters.ts`: case-insensitive,
  every whitespace-separated word must appear in name, description or category
  name. (Product data is English, so Sinhala queries will rarely match until
  Sinhala product content exists.)
- With no products (layout read failed) the dropdown shows "Search
  unavailable"; Enter still submits.

### `/products` filters — `lib/product-filters.ts` (pure, tested)

`filterProducts(products, { q?, category?, view? })`:

- `category`: through the existing `productsInCategory` rules.
- `view=deals`: products with `salePrice`, sorted by `discountPercent` desc.
- `view=picks`: `featured` only.
- `view=new`: all, newest `createdAt` first.
- `q`: `matchesQuery`.
- Filters combine; unknown `view` values are ignored.

`Product` gains `createdAt: string` (ISO), mapped from `created_at` in
`lib/catalog.ts`.

`app/products/page.tsx` reads `q`, `category`, `view`; heading reflects the view
or category; active filters show as chips with ✕ links that drop only that
parameter; no results → message + "Clear filters" (`/products`). The grid and
`ProductCard` are unchanged (part 2).

### Cart drawer

- `app/context/CartDrawerContext.ts`: module store (`useSyncExternalStore`)
  with `openCartDrawer()`, `closeCartDrawer()`, `useCartDrawer()`.
- Opens from the header 🛒 and after `ProductPurchase`'s add-to-cart (which no
  longer shows "Added to cart"). Never opens for remote cart changes (sync,
  other tabs).
- `app/components/CartDrawer.tsx`, mounted once in the layout, receives the
  shell products: title "Cart (n)" + ✕; free-shipping progress bar ("Add Rs X
  more for free shipping" / "✓ You've got free shipping"); lines (photo, name,
  size, price, − qty +, remove); subtotal; "View cart" (`/cart`) and "Continue
  shopping". Lines whose product is missing are left out, as on `/cart`. Empty:
  "Your cart is empty" + Flash Deals link.
- Dialog: `role="dialog"`, `aria-modal`, labelled by its title; focus moves to ✕
  on open and is trapped; Esc / backdrop click close; focus returns to the
  opener; page scroll locked while open. Full width under `sm`, 420 px above.
- `lib/cart-summary.ts` (pure, tested): `summarizeCart(lines, products)` →
  `{ lines: [{ line, product }], itemCount, subtotal, shipping, total, toFreeShipping }`.
  `CartView` is refactored to use it, so the drawer and `/cart` share one
  calculation (part P will apply promotion rules here).

### Footer

Dark (`bg-panel`), four columns, stacked on phones: Northbound (logo + line);
Shop (Flash Deals, Top Picks, New In, All products); Categories (from the DB);
Help & account (Sign in / My account, Cart, then the promise texts as a list).
No payment logos.

### Admin: `/admin/promises`

- `AdminTabs` gains Promises and Settings.
- List with icon, Sinhala and English text, visible toggle, ▲/▼ to reorder,
  Edit, Delete (confirm). "New promise" form: icon (5 choices), text සිංහල,
  text English, visible.
- `lib/storefront-form.ts` → `parsePromiseForm` (pure, tested): icon in the set;
  each text trimmed, ≤ 60 chars; at least one text; making a promise visible
  is refused when 3 are already visible.
- `lib/admin-storefront.ts` (server-only, secret key) does the writes;
  `app/admin/promises/actions.ts` actions each start with `await requireAdmin(...)`
  and end with `revalidatePath("/", "layout")`.
- Forms use the existing `onSubmit` + `startTransition` pattern.

## Error handling

- Layout data reads fail independently and fall back (above); the site never
  500s because the shell could not load.
- The boot script is wrapped in `try/catch`; on any error the server-rendered
  `data-lang` (the default language) stays.
- Missing products in the cart are hidden in the drawer and on `/cart`.
- Admin forms show field errors and keep input; a failed write shows "Something
  went wrong, please try again."

## Testing

- Vitest: `i18n` (`resolveLang`, `tr`, `langBootScript` against a stub
  `document`), `product-filters`, `cart-summary` (subtotal, shipping at, below
  and above the threshold, missing products), `storefront-form`
  (`parsePromiseForm`, `parseLanguageSettings`).
- `npm run lint`, `npm run build` (confirm `/`, `/products/[id]`, `/cart` are
  still static/ISR in the build output), `tsc`.
- Browser (dev and a production build, desktop and 375 px, light and dark):
  no language flash on reload in either language; toggle switches instantly
  and survives reload; admin default/bilingual changes take effect; search with
  keyboard and mouse; nav filters and chips; categories menu by keyboard;
  drawer open from 🛒 and add-to-cart, qty, remove, Esc, focus return; footer.
- Admin `/admin/promises` and `/admin/settings` need the owner's Google sign-in
  in the browser pane.

## Rollout

1. Finish `feat/categories` (resolve conflicts with `main`'s LKR change, admin
   browser test, PR, merge, check production), then apply its M2 migration.
2. Merge `main` into `feat/i18n-shell`.
3. Apply the `store_settings` / `store_promises` migration (additive).
4. Implement part I, then part 1, per the implementation plan.
5. PR → Vercel preview check → owner reviews the Sinhala copy → merge.
