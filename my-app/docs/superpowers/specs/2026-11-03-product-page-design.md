# Product page: gallery, buy box, delivery chips (Part 3)

## Understanding

Make `/products/[id]` feel like a dense marketplace product page in Northbound's own identity, showing only real data. Reviews, ratings and stock are Part 4. Said by the owner: roadmap I, 1, P, 2 done; 3 = product page (gallery, size pills, delivery chips). Chosen by the owner: gallery photos come from a new `product_images` table (option A). Assumptions: max 5 photos per product; Sinhala/English via `<L>`; prices stay cents via `formatPrice`.

## Global constraints

- Next.js 16 / React 19; read `node_modules/next/dist/docs/` before Next code.
- Product page stays static/ISR (`revalidate = 60`), cookie-less clients only.
- Every customer string in `<L si en>` (or `tr` for attributes). Admin pages stay English.
- No invented urgency, ratings, stock or sold counts.
- Every `public` table has RLS. Migration is additive and is applied by the owner in the SQL editor; also saved in `supabase/migrations/`.
- Every admin action starts with `await requireAdmin(...)`.

## 1. Data

New table `public.product_images`: `id uuid pk default gen_random_uuid()`, `product_id text not null references products(id) on delete cascade`, `path text not null`, `sort_order int not null`, `unique (product_id, sort_order)`. RLS on; one public SELECT policy; no write grants (writes via the secret key).

- `products.image_url` stays and always equals the public URL of the photo at `sort_order` 0 (cards, drawer and search keep using it).
- Gallery photos for a product = its `product_images` rows ordered by `sort_order`; with no rows, `[image_url]` if set; else none (swatch fallback via `ProductImage`).
- `Product` gains `gallery: string[]` (public URLs, first = main). `lib/catalog.ts` maps it in the shared `selectProducts()`.
- Backfill in the migration: one row per product that has an `image_url`, `sort_order` 0, `path` derived from the URL's file name.
- Storage bucket `product-images`, file names `<product id>-<epoch ms>.<ext>` (JPEG/PNG/WebP, ≤ 5 MB), as today.

## 2. Admin

`ProductForm` photo section becomes a "Photos" grid (max 5): upload (signed URL, existing flow), move earlier/later, remove. The first photo is the main photo.

- Pure rules in `lib/product-form.ts` (tested): `MAX_PHOTOS = 5`, `validatePhotoList(paths, productId)` (count, `isValidImagePath` each, no duplicates), `moveItem`.
- Save (`lib/admin-products.ts` + `app/admin/products/actions.ts`): check every path exists in Storage before writing; replace the rows (delete + insert); set `image_url` from the first photo (null when none); best-effort delete files that were removed. New-product create path uses the same list.
- Existing single-photo behaviour keeps working: a product with one backfilled row shows one photo in the grid.
- Existing `revalidatePath` set is unchanged.

## 3. Product page

- `ProductGallery` (client): large photo plus thumbnail strip; thumbnail click, ArrowLeft/ArrowRight on the strip, swipe on touch. One photo: no strip. Thumbnails are buttons with `aria-label` and `aria-current`. First image `preload`.
- Buy box: large price (blaze when discounted), struck list price, "Save Rs X", promotion name, end date; size pills with a clear selected state and the "Choose a size" hint.
- Delivery chips, pure rule `deliveryChips(pricing, shippingFee)` in `lib/product-page.ts` (tested): "Free shipping" when `pricing.freeShipping`, else "Shipping Rs <fee>" from `store_settings.shipping_fee`; one chip per conditional offer; the promotion end date. All real data. Fee read with the cookie-less settings reader, with its own fallback.
- Mobile: a sticky bottom bar (price + Add to cart) that adds when one size exists, else scrolls to / highlights the size pills ("Choose a size"). It must not cover the footer content (bottom padding) or the cart drawer.
- Spec sheet and related products unchanged.

## Testing

Vitest: `validatePhotoList` (0, 5, 6, duplicates, bad path), `moveItem` edges, gallery fallback order (rows → `image_url` → none), `deliveryChips` (free, fee, conditional, no end date). Browser: desktop and phone width, Sinhala and English, product with 1 and several photos, admin upload/reorder/remove (test data cleaned afterwards), `npm run build` keeps `/products/[id]` static.

## Review focus

- Product with no photos, or one photo (no strip, no sticky overlap).
- Removing the main photo promotes the next to `image_url`.
- Same photo uploaded twice; 6th photo rejected.
- Keyboard use of the gallery strip.
- Shipping fee setting missing/failed: chip falls back, page still renders.
