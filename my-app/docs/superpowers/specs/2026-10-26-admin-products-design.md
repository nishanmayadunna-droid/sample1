# Admin Products — Design

Date: 2026-10-26
Status: Approved in brainstorming, pending written-spec review
Scope: Spec 3. Builds on Spec 1 (auth: `requireAdmin`, `/admin`) and Spec 2
(cart sync). Lives on `feat/admin-products`, branched from `feat/cart-sync`.

## Goal

Admins create and edit products, upload each product's photo, and hide
products from the shop, all from `/admin`, with changes visible in the shop
immediately.

Success means:

- An admin can create a product with a photo, and it appears in the shop at once.
- An admin can edit any field except `id`, and the shop shows the change at once.
- Replacing a photo shows the new one and removes the old file from storage.
- Unpublishing hides a product (its page 404s, it leaves every list);
  publishing brings it back. Nothing is ever hard-deleted.
- Non-admins can neither see the admin pages nor run the admin actions.

## Decisions

| Topic | Decision |
|---|---|
| Removing products | Unpublish/publish only (`published` flag); no hard delete |
| Photos | One per product, JPEG/PNG/WebP, max 5 MB (the bucket's existing limits) |
| Upload path | Browser uploads straight to Supabase Storage with a signed upload URL issued by an admin-checked Server Action |
| Photo file names | `<id>-<epoch ms>.<ext>`, a new name per upload so CDN and `next/image` caches never serve the old photo |
| `id` | Lowercase slug, set on create, read-only afterwards (it is in the product URL) |
| Freshness | `revalidatePath` after every write |

## Data

New migration `supabase/migrations/<version>_add_product_published.sql`,
applied to the remote project and saved locally with the matching version.

```sql
alter table public.products
  add column published boolean not null default true;
```

Existing products stay published. `lib/catalog.ts` adds
`.eq("published", true)` to `getAllProducts`, `getProduct` and
`getProductsByCategory`, so unpublished products vanish from the home page,
`/products`, `/cart` pricing and `generateStaticParams`, and their pages 404.
Cart lines pointing at them are skipped by `CartView` as today.

Client access to `products` is unchanged (public SELECT only). All writes use
the server's secret-key client.

## Validation

Pure module `lib/product-form.ts` (no I/O), unit-tested.

`parseProductForm(fields: Record<string, string | undefined>, mode: "create" | "update")`
returns `{ ok: true, value: ProductInput }` or
`{ ok: false, errors: Partial<Record<FieldName, string>> }`.

| Field | Rule | Error |
|---|---|---|
| `id` (create only) | `^[a-z0-9]+(-[a-z0-9]+)*$`, 1–60 chars | `Use lowercase letters, numbers and dashes.` |
| `name` | trimmed, 1–100 chars | `Name is required (max 100 characters).` |
| `price` | dollars with up to 2 decimals (`28`, `28.5`, `28.50`) → integer cents; > 0 and < 10,000,000 cents | `Enter a price like 28.00.` |
| `salePrice` | optional (blank = none); same format; must be < `price` | `Sale price must be lower than the price.` |
| `category` | one of `CATEGORIES` | `Pick a category.` |
| `description` | trimmed, 1–2000 chars | `Description is required (max 2000 characters).` |
| `sizes` | comma-separated; each trimmed, non-empty, ≤ 20 chars; duplicates removed keeping first; 1–12 sizes | `Enter 1–12 sizes separated by commas.` |
| `material`, `construction`, `origin` | trimmed, 1–200 chars | `Required (max 200 characters).` |
| `swatchA`, `swatchB` | `^#[0-9a-fA-F]{6}$`, stored lowercase | `Pick a color.` |
| `featured` | `"on"` → true, absent → false | — |
| `sortOrder` | integer (blank = 0) | `Enter a whole number.` |

`ProductInput` uses the snake_case column names the table uses
(`sale_price`, `sort_order`, `swatch` as a 2-element array), so it can be
written directly.

Also in this module:

- `imagePathFor(id: string, contentType: string, now: number): string | null`
  → `<id>-<now>.jpg|png|webp` for `image/jpeg|png|webp`, else `null`.
- `isValidImagePath(id: string, path: string): boolean` → true only for
  `<id>-<digits>.(jpg|png|webp)` with exactly this `id` (rejects other
  products' files, slashes and `..`).
- `MAX_IMAGE_BYTES = 5 * 1024 * 1024`.

## Server

`lib/admin-products.ts` (`import "server-only"`, secret-key client):

- `listProductsForAdmin(): Promise<AdminProduct[]>`: every product including
  unpublished, ordered by `sort_order`, then `name`.
- `getProductForAdmin(id): Promise<AdminProduct | null>`
- `insertProduct(input): Promise<"ok" | "exists">`: `"exists"` on unique
  violation (`23505`).
- `updateProduct(id, input): Promise<void>`
- `setPublished(id, published): Promise<void>`
- `createImageUpload(path): Promise<{ path: string; token: string }>`: signed upload URL.
- `imageExists(path): Promise<boolean>`
- `setProductImage(id, path): Promise<void>`: sets `image_url` to the public
  URL, then best-effort deletes the previous file if it was in the bucket. A
  delete failure is logged and does not fail the save.

`AdminProduct` is the camelCase `Product` shape plus `published: boolean`.

`app/admin/products/actions.ts` (`"use server"`). Every action starts with
`await requireAdmin(...)`, because Server Actions are endpoints of their own:

- `createProductAction(prev, formData)` / `updateProductAction(id, prev, formData)`:
  parse; on errors return them; insert/update; if `imagePath` is present, check
  `isValidImagePath` and `imageExists`, then `setProductImage`; revalidate;
  `redirect("/admin")`. `"exists"` → `errors.id = "A product with this ID already exists."`.
- `setPublishedAction(id, published)`: update, revalidate.
- `requestImageUpload(id, contentType, size)`: rejects anything but
  JPEG/PNG/WebP or `size > MAX_IMAGE_BYTES`, and an `id` that isn't a valid
  slug; returns `{ path, token }` for `imagePathFor(id, contentType, Date.now())`.

Revalidation after every write: `revalidatePath("/")`, `"/products"`,
`` `/products/${id}` ``, `"/cart"`, `"/admin"`.

## UI

All pages call `requireAdmin` and use the Northbound tokens and classes.

| Route | Contents |
|---|---|
| `/admin` | Replaces the placeholder. "New product" button, then one row per product: thumbnail (`ProductImage`), name, id, category, price (and sale price), a **Published** / **Hidden** badge, an "Edit" link and a "Publish"/"Unpublish" button. |
| `/admin/products/new` | Empty `ProductForm`; `id` editable. |
| `/admin/products/[id]` | `ProductForm` with current values; `id` read-only; "View in shop" link. Unknown id → 404. |

`ProductForm` (`"use client"`):

- `useActionState` with the create or update action; field errors show under
  each field; a form-level error shows above the Save button.
- Photo: choosing a file shows a local preview, checks type and size on the
  client, calls `requestImageUpload`, then uploads with the browser Supabase
  client (`lib/supabase/client.ts`, `storage.from("product-images").uploadToSignedUrl`).
  Save is disabled while uploading. On success the returned path goes into a
  hidden `imagePath` field. On failure: `Photo upload failed. Try again.` and
  the rest of the form is kept.
- Two `<input type="color">` for the swatch, used when there is no photo.
- Server errors other than validation: `Something went wrong, please try again.`

## Testing

**Unit (Vitest)** in `lib/product-form.test.ts`:

- Price parsing: `28` → 2800, `28.5` → 2850, `28.50` → 2850, `0` / `-1` /
  `28.999` / `abc` / blank → error; sale price blank → none; sale ≥ price → error.
- Every field rule above, including the `id` slug rule and that `id` is ignored
  in update mode.
- Sizes: trimming, duplicate removal, 0 and 13 sizes rejected, 21-char size rejected.
- Swatch stored lowercase; invalid hex rejected.
- `imagePathFor`: three allowed types; `image/gif` → `null`.
- `isValidImagePath`: accepts `tee-123.jpg` for `tee`; rejects
  `other-123.jpg`, `tee-abc.jpg`, `tee-123.gif`, `../tee-123.jpg`,
  `x/tee-123.jpg`, and `tee-shirt-123.jpg` for `tee`.

**Manual checklist** (in-app browser, admin Google account):

1. Create a product with a photo → it appears on `/products` and its page at once.
2. Edit its price → the new price shows in the shop at once.
3. Replace its photo → the new photo shows; the old file is gone from the bucket.
4. Unpublish → its page 404s and it leaves `/products`; publish → it returns.
5. Duplicate `id` on create → the ID error shows.
6. A non-admin account gets 404 on `/admin` and `/admin/products/<id>`.

**Build checks:** `npm test`, `npm run lint`, `npm run build` pass; `/`,
`/cart`, `/products/[id]` stay static/ISR.

## Out of scope

- Hard delete
- Bulk import or export
- Drag-and-drop ordering (`sortOrder` is a number field)
- Image cropping or resizing
- Multiple photos per product
- Audit log of admin changes
