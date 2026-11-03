# Product page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A dense product page: multi-photo gallery (admin-managed), clearer buy box, delivery chips from real data, and a sticky add-to-cart bar on phones.

**Architecture:** A new `product_images` table holds ordered photo paths; `products.image_url` stays equal to the first photo so cards/drawer/search are untouched. Pure rules (photo list validation, ordering, URL building, delivery chips) live in tested lib modules; the catalog embeds `product_images` in its existing select; the admin form edits an ordered list sent as one JSON field; the page gets a `ProductGallery` client component and a reworked `ProductPurchase`.

**Tech Stack:** Next.js 16.4 (App Router, ISR), React 19.2, Tailwind v4 tokens, Supabase (Postgres + Storage), Vitest 4.

**Spec:** `docs/superpowers/specs/2026-11-03-product-page-design.md`

## Global Constraints

- Read `node_modules/next/dist/docs/` before writing Next code; product page stays static/ISR (`revalidate = 60`), cookie-less clients only.
- Every customer string in `<L si en>` (attributes via `tr(lang, si, en)`); admin pages stay English.
- Money in cents through `formatPrice`; no invented ratings, stock, sold counts or urgency.
- Max photos per product: **5**. Photo file names `<product id>-<epoch ms>.<ext>` (jpg/png/webp, ≤ 5 MB), bucket `product-images`.
- `product_images`: RLS on, public SELECT only, writes via the secret key. The migration is **applied by the owner in the SQL editor** (MCP apply is declined); it must be applied **before** the code is deployed, because the catalog select embeds the table.
- Every admin action starts with `await requireAdmin(...)`.
- Windows/CRLF repo: normalize with `.replace(/\r\n/g,'\n')` when scripting edits.

## Review Focus

- Product with no photos, or one photo: no thumbnail strip, no sticky-bar overlap, swatch fallback.
- Removing the main photo promotes the next one to `image_url`; removing all photos sets `image_url` null.
- Same path twice in the list, a 6th photo, a path belonging to another product: all rejected.
- Keyboard use of the gallery strip (ArrowLeft/ArrowRight, focus stays on the thumbnail).
- Shipping fee unreadable: page still renders with the default fee (`getStoreSettings` fallback).
- Sticky bar with several sizes and none chosen must not add to cart.

---

### Task 1: Photo rules, URL builder and migration

**Files:**
- Create: `lib/product-photos.ts`, `lib/product-photos.test.ts`
- Create: `supabase/migrations/20261103120000_create_product_images.sql`

**Interfaces:**
- Produces (all pure, in `lib/product-photos.ts`):
  - `export const MAX_PHOTOS = 5`
  - `publicPhotoUrl(supabaseUrl: string, path: string): string` → `<supabaseUrl>/storage/v1/object/public/product-images/<encodeURIComponent(path)>`
  - `sortedPhotoPaths(rows: { path: string; sort_order: number }[] | null | undefined): string[]`
  - `galleryUrls(supabaseUrl: string, paths: string[], imageUrl: string | null): string[]` — paths → URLs; if no paths and `imageUrl` set → `[imageUrl]`; else `[]`
  - `validatePhotoList(id: string, paths: string[]): "ok" | "too-many" | "duplicate" | "invalid-path"` (uses `isValidImagePath` from `lib/product-form.ts`; checked in the order: count, path, duplicate)
  - `moveItem<T>(items: T[], from: number, to: number): T[]` — new array, out-of-range indexes return a copy unchanged
  - `parsePhotosField(raw: string | undefined): string[] | null` — JSON array of strings, else null; empty/undefined → `[]`

- [ ] **Step 1: Write the failing tests** in `lib/product-photos.test.ts`: `validatePhotoList("trail-cap", [])` → "ok"; 5 valid → "ok"; 6 → "too-many"; same path twice → "duplicate"; `"other-1700000000000.jpg"` and `"../x.jpg"` → "invalid-path"; `moveItem([1,2,3],0,2)` → `[2,3,1]`, `moveItem([1,2],0,5)` → `[1,2]` and the input is not mutated; `sortedPhotoPaths` orders by `sort_order`, handles null; `galleryUrls` precedence (paths → `imageUrl` fallback → `[]`) and URL-encodes the path; `parsePhotosField('["a.jpg"]')` → `["a.jpg"]`, `"nope"` → null, `'[1]'` → null, `undefined` → `[]`.
- [ ] **Step 2: Run** `npx vitest run lib/product-photos.test.ts`. Expected: FAIL (module missing).
- [ ] **Step 3: Implement** `lib/product-photos.ts` per the Interfaces block.
- [ ] **Step 4: Write the migration** `create table public.product_images (id uuid primary key default gen_random_uuid(), product_id text not null references public.products (id) on delete cascade, path text not null check (length(path) <= 200), sort_order integer not null check (sort_order between 0 and 4), unique (product_id, sort_order), unique (product_id, path))`; `alter table ... enable row level security`; one `select` policy `to anon, authenticated using (true)`; backfill `insert into public.product_images (product_id, path, sort_order) select id, substring(image_url from '/product-images/(.+)$'), 0 from public.products where image_url is not null and substring(image_url from '/product-images/(.+)$') is not null`. Add a header comment saying it is run by the owner in the SQL editor.
- [ ] **Step 5: Run** `npx vitest run lib/product-photos.test.ts` then `npm test`. Expected: PASS, full suite green.
- [ ] **Step 6: Commit** `git add lib/product-photos.ts lib/product-photos.test.ts supabase/migrations/20261103120000_create_product_images.sql && git commit -m "Add product photo rules and product_images migration"`
- [ ] **Step 7: Ask the owner to run the migration** (SQL editor) and confirm before Task 2's browser checks. Do not apply it via MCP.

### Task 2: Catalog gallery and admin photo saving

**Files:**
- Modify: `lib/products.ts` (add `gallery: string[]` to `Product`; `ShellProduct` unchanged)
- Modify: `lib/catalog.ts` (`COLUMNS` embeds `product_images(path, sort_order)`; `ProductRow` gets `product_images: {path:string; sort_order:number}[] | null`; `toProduct` sets `gallery` via `galleryUrls(process.env.NEXT_PUBLIC_SUPABASE_URL!, sortedPhotoPaths(row.product_images), row.image_url)`)
- Modify: `lib/admin-products.ts` (`AdminProduct` adds `photoPaths: string[]`; replace `setProductImage` with `setProductPhotos`; `deleteProduct` removes every photo file)
- Modify: `app/admin/products/actions.ts`
- Modify: `lib/product-form.test.ts` or tests that build `Product` fixtures (add `gallery: []` wherever `Product` objects are constructed; `npx tsc --noEmit` finds them)

**Interfaces:**
- Consumes: Task 1's `validatePhotoList`, `parsePhotosField`, `sortedPhotoPaths`, `galleryUrls`.
- Produces: `Product.gallery: string[]`; `AdminProduct.photoPaths: string[]`; `setProductPhotos(id: string, paths: string[]): Promise<void>` in `lib/admin-products.ts`.

- [ ] **Step 1: Types and catalog.** Add `gallery` to `Product`, embed the table in `COLUMNS`, map in `toProduct`; admin `toAdminProduct` also sets `photoPaths: sortedPhotoPaths(row.product_images)`. Run `npx tsc --noEmit`; fix every `Product` fixture (`gallery: []`). Expected: no type errors.
- [ ] **Step 2: Implement `setProductPhotos(id, paths)`**: read current `product_images` paths; delete the product's rows; insert `paths` with `sort_order` = index (skip insert when empty); set `products.image_url` to `publicPhotoUrl(url, paths[0])` or `null`; best-effort remove storage files in the old set but not the new set (log failures, as `setProductImage` did). Delete `setProductImage` and its callers. `deleteProduct` removes the files of all rows (select paths before the cascade) plus the legacy `image_url` path.
- [ ] **Step 3: Actions.** In `createProductAction` / `updateProductAction` replace the single `imagePath` flow with `parsePhotosField(fields.photos)`: `null` or `validatePhotoList(id, paths) !== "ok"` → `{ errors: { form: UPLOAD_FAILED } }`; for every path not already in the product's `photoPaths` (create: all) require `imageExists`; after `insertProduct`/`updateProduct` call `setProductPhotos(id, paths)`. Update `requestImageUpload` is unchanged.
- [ ] **Step 4: Run** `npx tsc --noEmit && npm test && npm run lint`. Expected: clean, all green.
- [ ] **Step 5: Browser check** (owner has applied the migration): `/products` and `/products/field-jacket` still render with the backfilled photo; no console errors.
- [ ] **Step 6: Commit** `git add -A lib app && git commit -m "Store product photos in product_images and save them from the admin"`

### Task 3: Admin Photos grid

**Files:**
- Modify: `app/admin/products/ProductForm.tsx`

**Interfaces:**
- Consumes: `MAX_PHOTOS`, `moveItem`, `publicPhotoUrl` (Task 1); `AdminProduct.photoPaths` (Task 2); existing `requestImageUpload`.
- Produces: form field `photos` = `JSON.stringify(string[])` of storage paths in order.

- [ ] **Step 1: Replace the single-photo block** with a "Photos (up to 5, first is the main photo)" grid. State: `photos: string[]` (initial `product?.photoPaths ?? []`), `uploading`, `uploadError`. Each tile: a plain `<img>` of `publicPhotoUrl(NEXT_PUBLIC_SUPABASE_URL, path)` (`next/image` not needed in admin; add the `no-img-element` eslint-disable like the existing preview), buttons "←" and "→" (disabled at the ends, `aria-label` "Move photo N earlier/later"), "Remove" (`aria-label` "Remove photo N"). A file input (hidden when 5 photos) reuses `handleFile`: validate type/size, require a valid id, `requestImageUpload`, `uploadToSignedUrl`, then append the returned `signed.path`. Hidden input `<input type="hidden" name="photos" value={JSON.stringify(photos)} />`. Submit stays disabled while `uploading`.
- [ ] **Step 2: Run** `npx tsc --noEmit && npm run lint`. Expected: clean.
- [ ] **Step 3: Browser check** (signed in as admin, a throwaway product `qa-photos`): add 3 photos, reorder, remove one, save; reopen and see the order kept; product `image_url` equals the first photo; removed file gone from Storage; main-photo removal promotes the next; 6th photo not offered; then delete the QA product via the admin danger zone.
- [ ] **Step 4: Commit** `git add app/admin/products/ProductForm.tsx && git commit -m "Manage up to five product photos in the admin form"`

### Task 4: Product page gallery, buy box and delivery chips

**Files:**
- Create: `lib/product-page.ts`, `lib/product-page.test.ts`
- Create: `app/components/ProductGallery.tsx`
- Modify: `app/components/ProductPurchase.tsx`, `app/products/[id]/page.tsx`, `app/components/ProductImage.tsx` (only if it needs an `src` override; prefer passing `product={{...product, imageUrl: url}}`), `CLAUDE.md`

**Interfaces:**
- Consumes: `Product.gallery` (Task 2), `ItemPricing` from `lib/promotions.ts`, `getStoreSettings()` from `lib/storefront.ts`.
- Produces:
  - `type DeliveryChip = { key: string; si: string; en: string }`
  - `deliveryChips(pricing: ItemPricing, shippingFee: number, endsAt: Date | null): DeliveryChip[]` in `lib/product-page.ts`
  - `<ProductGallery product={Product} />` (client)
  - `<ProductPurchase product={Product} price={number} chips={DeliveryChip[]} />`

- [ ] **Step 1: Write failing tests** `lib/product-page.test.ts` for `deliveryChips`: free-shipping pricing → one chip `free-shipping` ("නොමිලේ බෙදාහැරීම" / "Free shipping"); otherwise a `shipping` chip showing `formatPrice(shippingFee)` in both languages ("බෙදාහැරීම Rs 350.00" / "Shipping Rs 350.00"); each `pricing.conditional` offer adds a chip keyed by promotion slug with the promotion's `nameSi`/`nameEn`; `endsAt` adds an `ends` chip with an Asia/Colombo day+month; no `endsAt` → no `ends` chip; fee 0 → no `shipping` chip. Build `ItemPricing` fixtures from `lib/test-fixtures/promotions.ts`.
- [ ] **Step 2: Run** `npx vitest run lib/product-page.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement `deliveryChips`.** Run the test again. Expected: PASS.
- [ ] **Step 4: `ProductGallery`**: `useState(index)`; large `ProductImage` of `{...product, imageUrl: gallery[index]}` (`preload` on first, `sizes="(min-width: 768px) 50vw, 100vw"`, `aspect-[4/5]`); below it a thumbnail row (rendered only when `gallery.length > 1`) of buttons with `aria-label` "Photo N of M" (via `tr`) and `aria-current`; ArrowLeft/ArrowRight on the row move the selection and focus; touch swipe on the large photo (pointer start/end, ≥ 40 px horizontal) changes photo. Zero photos → the swatch fallback via `ProductImage` with no `imageUrl`.
- [ ] **Step 5: `ProductPurchase`**: keep size state and `addItem` + `openCartDrawer`; size pills get a clear selected state and `aria-pressed`; render `chips` as pills above the button; add a `sm:hidden` fixed bottom bar (`bg-bg`, border-top, `pb-[env(safe-area-inset-bottom)]`) with `formatPrice(price)` and the button: one size or a chosen size → adds; otherwise scrolls the pill group into view and focuses its first pill (no add). The inline button stays for `sm:` and up. Add bottom padding to the page on small screens so the bar never covers the footer.
- [ ] **Step 6: `page.tsx`**: read `getStoreSettings()` in the existing `Promise.all` (its fallback already covers failure); use `ProductGallery` in the left column (keep `md:sticky`); compute `deliveryChips(pricing, settings.shippingFee, endsAt)`; remove the now-duplicated free-shipping/end-date/conditional paragraphs (chips replace them); pass `price={pricing.price}` and `chips`. Keep breadcrumb, spec sheet, related products.
- [ ] **Step 7: Run** `npx tsc --noEmit && npm test && npm run lint && npm run build`. Expected: green; build output shows `/products/[id]` still static (●/SSG), `/`, `/cart` static.
- [ ] **Step 8: Browser check**: desktop and 375 px, සිං and EN; product with one photo (no strip, sticky bar OK) and with several (thumbnail click, arrow keys, swipe via JS-dispatched pointer events); a running free-shipping promotion shows the chip, none shows the fee chip; sticky bar with sizes unselected does not add; with size selected adds and opens the drawer; QA data cleaned up.
- [ ] **Step 9: Docs and commit**: update `CLAUDE.md` (Product page: `product_images`, `gallery`, `lib/product-photos.ts`, `lib/product-page.ts`, `ProductGallery`, sticky bar, migration state: `20261103120000_create_product_images` applied by the owner before deploy). `git add -A app lib CLAUDE.md && git commit -m "Rebuild the product page with a gallery, delivery chips and a sticky buy bar"`
