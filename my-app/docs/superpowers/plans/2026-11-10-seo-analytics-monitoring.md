# SEO, Analytics and Monitoring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Site-URL-aware metadata, JSON-LD, robots/sitemap, Vercel Analytics + Speed Insights, branded error/404 pages and a health endpoint.

**Architecture:** Pure builders in `lib/site.ts` and `lib/seo.ts` (tested); thin Next metadata routes and components consume them. No database changes. Static pages must stay static.

**Tech Stack:** Next.js 16 metadata API, `@vercel/analytics`, `@vercel/speed-insights`, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-10-seo-analytics-monitoring-design.md`

## Global Constraints
- Next.js 16: read the relevant guides under `node_modules/next/dist/docs/` first (metadata, `robots.ts`, `sitemap.ts`, `opengraph-image`, `error.tsx`/`global-error.tsx`/`not-found.tsx`, route handlers, `generateMetadata`) — do not use remembered APIs.
- Pages `/`, `/products/[id]`, `/cart` and the six store pages stay static/ISR; the root layout must not call `auth()`, `cookies()` or `headers()`.
- Customer-facing strings use `<L si en>`; Sinhala copy is a draft for the owner's review. Prices are cents; render through `formatPrice` for display, but JSON-LD price is rupees as a string with two decimals.
- Non-production deployments are never indexable.
- New dependencies: only `@vercel/analytics` and `@vercel/speed-insights`, installed with an exact version (no caret); check the installed version is at least two weeks old (`npm view <pkg> time`) and pick the newest that is.
- Commits end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## Review Focus
- `NEXT_PUBLIC_SITE_URL` set with a trailing slash, with a path, without protocol, or invalid → a sane origin or fall-through, never `undefined` in a URL.
- Preview/non-production robots disallow everything and omit the sitemap; production blocks the private routes.
- JSON-LD cannot be broken out of its `<script>` by product text (`</script>`, `<!--`, unicode line separators).
- Sold-out product → `OutOfStock`; product with no reviews → no `aggregateRating`; product without a photo → no empty `image`.
- Filtered `/products?...` URLs are `noindex`; the unfiltered page is indexable with a canonical.
- `/api/health` returns 503 (not a stack trace) when the database is unreachable and never caches.
- Error boundary logs only the digest, never the message or stack to the client.

---

### Task 1: Pure builders and site URL

**Files:**
- Create: `lib/site.ts`, `lib/seo.ts`
- Test: `lib/site.test.ts`, `lib/seo.test.ts`

**Interfaces (Produces):**
- `lib/site.ts`: `export function resolveSiteUrl(env: { NEXT_PUBLIC_SITE_URL?: string; VERCEL_PROJECT_PRODUCTION_URL?: string }): string` (origin only, no trailing slash; explicit value is trimmed, protocol `https://` added when missing, path/query/hash dropped, invalid → fall through; then `https://<VERCEL_PROJECT_PRODUCTION_URL>` (same cleaning); else `http://localhost:3000`); `export function siteUrl(): string`; `export function absoluteUrl(path: string): string` (`path` starts with `/`; returns origin + path); `export function isProductionDeploy(env?: { VERCEL_ENV?: string; NODE_ENV?: string }): boolean` (`VERCEL_ENV === "production"`, or `VERCEL_ENV` unset and `NODE_ENV === "production"`).
- `lib/seo.ts` (pure, no server-only imports): `export function jsonLdScript(data: unknown): string` (JSON string with `<`, `>`, `&`, U+2028, U+2029 escaped as `<` etc.); `export function productJsonLd(input: { name: string; description: string; url: string; images: string[]; price: number /* cents */; inStock: boolean; rating: { average: number; count: number } | null }): Record<string, unknown>`; `export function organizationJsonLd(input: { name: string; url: string; logo?: string; phone?: string; email?: string }): Record<string, unknown>`; `export function websiteJsonLd(input: { name: string; url: string }): Record<string, unknown>` (with `potentialAction` SearchAction, target `${url}/products?q={search_term_string}`); `export type RobotsRule = { userAgent: string; allow?: string[]; disallow?: string[] }`; `export function robotsRules(input: { production: boolean; base: string }): { rules: RobotsRule[]; sitemap?: string }` (production: `userAgent "*"`, `allow ["/"]`, `disallow ["/admin","/account","/checkout","/cart","/orders","/signin","/unsubscribe","/api"]`, `sitemap: base + "/sitemap.xml"`; otherwise `disallow ["/"]`, no sitemap); `export function sitemapEntries(input: { base: string; productIds: string[]; now?: Date }): { url: string; lastModified?: Date; changeFrequency?: "daily" | "weekly" | "monthly"; priority?: number }[]` (home 1.0 daily, `/products` 0.9 daily, six store pages 0.3 monthly (`/about /contact /privacy /terms /returns /size-guide`), each product `/products/<encodeURIComponent(id)>` 0.7 weekly).

- [ ] **Step 1: Write failing tests.** `resolveSiteUrl`: explicit `"https://shop.lk/"` → `https://shop.lk`; `"shop.lk"` → `https://shop.lk`; `"https://shop.lk/path?x=1"` → `https://shop.lk`; `"not a url"` with `VERCEL_PROJECT_PRODUCTION_URL: "sample1-azure.vercel.app"` → `https://sample1-azure.vercel.app`; nothing → `http://localhost:3000`; `"http://localhost:3000"` explicit is kept as `http://localhost:3000`. `isProductionDeploy`: `{VERCEL_ENV:"production"}` true, `{VERCEL_ENV:"preview", NODE_ENV:"production"}` false, `{NODE_ENV:"production"}` true, `{NODE_ENV:"development"}` false. `jsonLdScript({a:"</script><!--"})` contains neither `</script>` nor `<` and parses back to the same object with `JSON.parse` after unescaping via `JSON.parse` of the output (the escapes are valid JSON). `productJsonLd`: price `150000` cents → offers.price `"1500.00"`, `priceCurrency "LKR"`, `availability "https://schema.org/InStock"`; `inStock:false` → `OutOfStock`; `rating:null` → no `aggregateRating` key; `rating {average:4.5,count:3}` → `ratingValue "4.5"`, `reviewCount "3"` (strings or numbers consistently — pick numbers and assert them); `images: []` → no `image` key. `organizationJsonLd` omits empty phone/email. `websiteJsonLd` has the SearchAction target with `{search_term_string}`. `robotsRules` production vs not as above. `sitemapEntries` includes home, products, six store pages and one entry per product id, with an id like `a b` encoded as `a%20b`, and no duplicates.
- [ ] **Step 2: Run** `npx vitest run lib/site.test.ts lib/seo.test.ts` — Expected: FAIL (modules not found).
- [ ] **Step 3: Implement** both modules with the signatures above.
- [ ] **Step 4: Run** the two files, then `npm test` — Expected: PASS, whole suite green.
- [ ] **Step 5: Commit** `git add lib/site.ts lib/site.test.ts lib/seo.ts lib/seo.test.ts && git commit -m "Add site URL and SEO builders"`

### Task 2: Metadata, robots, sitemap, structured data

**Files:**
- Modify: `app/layout.tsx` (metadataBase, description, openGraph, twitter), `app/products/[id]/page.tsx` (generateMetadata + JSON-LD), `app/products/page.tsx` (canonical + noindex when filtered), `app/page.tsx` (Organization + WebSite JSON-LD), each of `app/{about,contact,privacy,terms,returns,size-guide}/page.tsx` (add `description` to their `metadata`)
- Create: `app/robots.ts`, `app/sitemap.ts`, `app/opengraph-image.tsx`

**Interfaces:** Consumes Task 1 exports; `getAllProducts`, `getProduct` (`lib/catalog.ts`); stock helpers `allSoldOut` (`lib/stock.ts`); `effectivePrice` (`lib/products.ts`); `getStoreContact` (`lib/store-contact-data.ts`) for Organization phone/email.

- [ ] **Step 1:** `robots.ts` and `sitemap.ts` (`export const revalidate = 3600`) using `robotsRules`/`sitemapEntries`, `isProductionDeploy()`, `siteUrl()`. The sitemap reads published product ids from `getAllProducts()`.
- [ ] **Step 2:** Root layout metadata: `metadataBase: new URL(siteUrl())`, `description`, `openGraph`, `twitter`; keep the existing title template. `opengraph-image.tsx` exports `size = { width: 1200, height: 630 }`, `contentType = "image/png"`, `alt`, and a default `Image()` using `ImageResponse` with the brand wordmark "NORTH·BOUND" and the tagline — only system fonts, no remote assets.
- [ ] **Step 3:** Product page `generateMetadata` (title = product name; description = the product's description text trimmed to ~160 chars; `alternates.canonical = "/products/" + id`; `openGraph.images` = first gallery photo when present) and render the Product JSON-LD with `<script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(...) }} />` (inStock = `!allSoldOut(product)` — use the real helper signature; rating from `product.rating` when present). Keep the page static/ISR (`generateStaticParams` and `revalidate` unchanged).
- [ ] **Step 4:** `/products`: `generateMetadata({ searchParams })` returns canonical `/products` always and `robots: { index: false, follow: true }` when any of `category|view|q|promo` is present (searchParams is a Promise in Next 16; if making this page's metadata read searchParams would turn a currently-static page dynamic, check whether the page already reads searchParams — it does, so no change in rendering mode; confirm in the build output). Home: render Organization + WebSite JSON-LD (Organization phone/email from `getStoreContact()`; skip if the read fails). Store pages: add one-sentence English `description` each.
- [ ] **Step 5:** `rm -rf .next/types .next/dev/types && npx tsc --noEmit`, `npm run lint`, `npm test`, `npm run build`; confirm in the build route table that `/`, `/products/[id]`, `/cart` and the six store pages are still static/ISR and that `/robots.txt`, `/sitemap.xml` and `/opengraph-image` exist. Commit: `git add app && git commit -m "Add SEO metadata, structured data, robots and sitemap"` (check `git status` first).

### Task 3: Analytics and monitoring

**Files:**
- Modify: `app/layout.tsx` (components), `package.json`/`package-lock.json`
- Create: `app/not-found.tsx`, `app/error.tsx`, `app/global-error.tsx`, `app/api/health/route.ts`

- [ ] **Step 1:** `npm install --save-exact @vercel/analytics @vercel/speed-insights` (choose versions per Global Constraints and say which in the report). Render `<Analytics />` (`@vercel/analytics/next`) and `<SpeedInsights />` (`@vercel/speed-insights/next`) at the end of the root layout `<body>`.
- [ ] **Step 2:** `not-found.tsx` (server, bilingual `<L>`; heading, one sentence, links to `/` and `/products`), `error.tsx` (`"use client"`, props `{ error: Error & { digest?: string }; reset: () => void }`, bilingual message, a Try again button calling `reset`, `console.error("page error", error.digest ?? "no-digest")` only), `global-error.tsx` (`"use client"`, renders its own `<html><body>` with a minimal English/Sinhala message and a reload button, no app components).
- [ ] **Step 3:** `app/api/health/route.ts`: `export const dynamic = "force-dynamic"`; `GET` queries `store_settings` (`select("id").limit(1)`) with the cookie-less client from `lib/storefront.ts` pattern; on success `Response.json({ ok: true })` 200, on any error/exception `Response.json({ ok: false }, { status: 503 })`; header `Cache-Control: no-store`; never include error text.
- [ ] **Step 4:** `npx tsc --noEmit`, `npm run lint`, `npm test`, `npm run build` (static pages stay static). Commit: `git add -A app package.json package-lock.json && git commit -m "Add analytics, error pages and a health endpoint"` (check `git status`; `.superpowers` is git-ignored).

### Task 4: Docs and live check

**Files:** Modify `CLAUDE.md` (a **SEO, analytics and monitoring (Part 15)** bullet after the Part 14 bullet; list the new modules and env vars `NEXT_PUBLIC_SITE_URL`; note analytics are cookie-less and must be enabled in the Vercel dashboard); `docs/launch/checklist.md` (new section).

- [ ] **Step 1:** Edit both files; commit `git add CLAUDE.md docs/launch/checklist.md && git commit -m "Document SEO, analytics and monitoring"`.
- [ ] **Step 2: Live check** (controller): run the dev or production server; `curl` `/robots.txt` (non-production rules locally = disallow all), `/sitemap.xml` (contains products), a product page's HTML (canonical, `og:title`, `application/ld+json` with `OutOfStock`/`InStock`), `/products?category=x` has `noindex`, `/nope` shows the branded 404, `/api/health` returns 200.
