# Part 15: SEO, analytics and monitoring — design

## Goal
Make the store findable and measurable and make failures visible before launch: correct metadata and structured data, robots/sitemap, cookie-less analytics, branded error pages and a health endpoint. No database changes.

## Understanding (confirmed with the owner)
- Analytics: **Vercel Web Analytics + Speed Insights** (cookie-less, no consent banner). The owner switches them on in the Vercel dashboard. No Google Analytics, no Sentry; errors are read from Vercel runtime logs plus our error boundaries.
- There is no domain yet: canonical URLs come from an env variable and switch automatically when the domain exists.
- Preview deployments must never be indexed.

## Design
**Site URL:** `lib/site.ts` — pure `resolveSiteUrl(env: { NEXT_PUBLIC_SITE_URL?: string; VERCEL_PROJECT_PRODUCTION_URL?: string })` → origin without trailing slash (explicit env wins; else `https://<VERCEL_PROJECT_PRODUCTION_URL>`; else `http://localhost:3000`; invalid values fall through), `siteUrl()` reading `process.env`, `absoluteUrl(path)`. `isProductionDeploy()` = `process.env.VERCEL_ENV === "production"` (also true outside Vercel only if `NODE_ENV === "production"` and `VERCEL_ENV` is unset, i.e. a self-hosted build).

**Metadata:** root layout sets `metadataBase`, default `description`, `openGraph` (site name "Northbound", type website, locale `si_LK`, alternate `en_US`) and `twitter` (`summary_large_image`); `app/opengraph-image.tsx` renders a brand card with `ImageResponse` (no external fonts or images). Store pages already have titles; add a `description` to each. `/products` gets `alternates.canonical = "/products"` and `robots: { index: false, follow: true }` when any filter param (`category`, `view`, `q`, `promo`) is present. Product page: `generateMetadata` (title = product name, description from the product copy, `alternates.canonical`, OG image = first photo when present), plus a `<script type="application/ld+json">` **Product** block built by pure `productJsonLd(product, { url, inStock, rating })`: name, description, image(s), `offers` (`priceCurrency: "LKR"`, `price` in rupees as a string with 2 decimals from `effectivePrice`, `availability` InStock/OutOfStock using the stock helpers, `url`), `aggregateRating` only when approved reviews exist. The home page adds **Organization** and **WebSite** JSON-LD (`SearchAction` → `/products?q={search_term_string}`) via pure builders. JSON-LD is serialised with `<` escaped as `<`.

**robots / sitemap:** `app/robots.ts` — in production: allow `/`, disallow `/admin`, `/account`, `/checkout`, `/cart`, `/orders`, `/signin`, `/unsubscribe`, `/api`, and list the sitemap; in any non-production deploy: `disallow: "/"` and no sitemap. `app/sitemap.ts` — home, `/products`, the six store pages, and every published product (`getAllProducts`); `revalidate = 3600`; builders are pure (`sitemapEntries(products, base)`).

**Analytics:** `@vercel/analytics/next` `<Analytics />` and `@vercel/speed-insights/next` `<SpeedInsights />` at the end of the root layout body (client components, no cookies/headers read, pages stay static). No custom events.

**Monitoring:** `app/not-found.tsx` (bilingual, links home and to products), `app/error.tsx` (client, bilingual, "Try again" using `reset`, logs only `error.digest`), `app/global-error.tsx` (minimal html/body fallback). `app/api/health/route.ts` — `GET` does a cheap `select id from store_settings limit 1` with the cookie-less client; returns `{ ok: true }` 200 or `{ ok: false }` 503, `Cache-Control: no-store`, no details leaked.

**Docs:** CLAUDE.md bullet; `docs/launch/checklist.md` gets a "Search, analytics, monitoring" section (enable Web Analytics and Speed Insights in Vercel, set `NEXT_PUBLIC_SITE_URL` when the domain exists, add the site in Google Search Console and submit `/sitemap.xml`, point an uptime monitor at `/api/health`, test sharing a product link on Facebook/WhatsApp).

## Out of scope
Google Analytics/Pixel, Sentry, custom analytics events, hreflang per language (language is a cookie, one URL), image sitemaps, blog.

## Testing
Vitest for `resolveSiteUrl`, `productJsonLd`, `organizationJsonLd`, `websiteJsonLd`, `jsonLdScript` escaping, `robotsRules`, `sitemapEntries`. Manual: `robots.txt`, `sitemap.xml`, product HTML contains the JSON-LD and canonical, 404 page renders, `/api/health` returns 200, `npm run build` keeps the static pages static.
