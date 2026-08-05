# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Critical: this is not the Next.js in your training data

This project runs **Next.js 16.2.12** with **React 19.2**. APIs, conventions, and file structure may differ from what you remember. **Before writing any Next.js code, read the relevant guide under `node_modules/next/dist/docs/`** (the App Router docs live in `01-app/`) and heed any deprecation notices. Do not rely on remembered Next.js APIs.

## Commands

```bash
npm run dev     # start the dev server at http://localhost:3000
npm run build   # production build
npm run start   # serve the production build
npm run lint    # ESLint (flat config via eslint-config-next)
```

There is no test runner configured in this project.

## Architecture

This is a **client-side demo storefront** (apparel). No backend, database, or payments — product data is static and the cart lives in the browser.

- **App Router** (`app/`). Root layout `app/layout.tsx` wires the Geist fonts (`--font-geist-*` CSS variables), renders the `AnnouncementBar` + persistent `Header`/footer, and imports `app/globals.css`. Routes: `/` (merchandising home — hero, shop-by-category tiles, flash sale, featured, promise strip, newsletter), `/products` (catalog, filtered by `?category=`), `/products/[id]` (detail; statically generated via `generateStaticParams`), `/cart`.
- **Product data** is static and lives in `lib/products.ts` — the `Product` type, the `products` array, and query/format helpers (`getProduct`, `getFeaturedProducts`, `getProductsByCategory`, `getSaleProducts`, `formatPrice`). **Prices are stored in cents** (integers); render them through `formatPrice`, never with raw math. Sale items carry an optional `salePrice` — always charge/display `effectivePrice(product)` (falls back to `price`) and it's what the cart subtotal uses; `discountPercent()` drives the sale badges. Products have no photos — `app/components/ProductImage.tsx` renders a deterministic gradient from each product's `swatch`, so the store is fully self-contained with no image/network config.
- **The flash-sale countdown** (`app/components/FlashCountdown.tsx`) is a client component; it counts to local midnight and, like the cart, uses a `useSyncExternalStore`-based `useHydrated()` flag so the live digits don't cause an SSR/client mismatch. Its `setState` lives inside the interval callback, not the effect body, to satisfy `react-hooks/set-state-in-effect`.
- **Cart state** is in `app/context/CartContext.tsx`. Despite the name it is **not** React Context/a provider — it's a module-level store persisted to `localStorage`, exposed through the `useCart()` hook built on `useSyncExternalStore` (chosen so the React 19 `react-hooks/set-state-in-effect` lint rule stays satisfied, and for hydration + cross-tab safety). Consumers gate cart-dependent UI on the `hydrated` flag to avoid SSR/client mismatch. Mutations (`addItem`/`removeItem`/`setQuantity`/`clear`) are plain exported functions.
- **Server vs client**: pages/most components are Server Components. Only interactive pieces carry `"use client"` — `Header`, `ProductPurchase` (size selection + add-to-cart), `CartView`, and the cart store.
- **Styling** is **Tailwind CSS v4** via PostCSS (`postcss.config.mjs` → `@tailwindcss/postcss`); no `tailwind.config.js`. Theme tokens (`--background`/`--foreground`, mapped to `bg-background`/`text-foreground`) live in `app/globals.css` using the v4 `@theme` block.
- **TypeScript** path alias `@/*` maps to the project root (e.g. `@/lib/products`).
