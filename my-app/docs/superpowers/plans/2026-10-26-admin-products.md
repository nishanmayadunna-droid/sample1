# Admin Products Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let admins create, edit, photograph and hide products from `/admin`, with changes visible in the shop immediately.

**Architecture:** A pure, tested `lib/product-form.ts` validates every field and image path. Admin-checked Server Actions write through a server-only secret-key module and call `revalidatePath`; photos go browser → Supabase Storage via a signed upload URL the server issues. Catalog reads filter on a new `published` column.

**Tech Stack:** Next.js 16.2.12 (Server Actions, `revalidatePath`, `useActionState`), React 19.2, Supabase (Postgres + Storage: `createSignedUploadUrl` / `uploadToSignedUrl`), Vitest 4.

**Spec:** `docs/superpowers/specs/2026-10-26-admin-products-design.md`

## Global Constraints

- Branch `feat/admin-products` (from `feat/cart-sync`). Read `node_modules/next/dist/docs/01-app/` guides before Next.js code; `revalidatePath(path, type?)` — literal paths need no `type`.
- Every exported Server Action in `app/admin/products/actions.ts` begins with `await requireAdmin(...)`.
- Writes use only `supabaseAdmin` (`lib/supabase/admin.ts`) from `server-only` modules.
- Photos: `image/jpeg` → `.jpg`, `image/png` → `.png`, `image/webp` → `.webp`; max `5 * 1024 * 1024` bytes; bucket `product-images`; file name `<id>-<epoch ms>.<ext>`.
- No hard delete anywhere.
- After every write: `revalidatePath("/")`, `revalidatePath("/products")`, `` revalidatePath(`/products/${id}`) ``, `revalidatePath("/cart")`, `revalidatePath("/admin")`.
- Error copy, verbatim: `Use lowercase letters, numbers and dashes.` · `Name is required (max 100 characters).` · `Enter a price like 28.00.` · `Sale price must be lower than the price.` · `Pick a category.` · `Description is required (max 2000 characters).` · `Enter 1–12 sizes separated by commas.` · `Required (max 200 characters).` · `Pick a color.` · `Enter a whole number.` · `A product with this ID already exists.` · `Photo upload failed. Try again.` · `Something went wrong, please try again.`
- UI uses Northbound tokens/classes only (`bg-panel`, `text-blaze`, `border-line`, `text-muted`, `.display`, `.eyebrow`, `.measure`).
- `/`, `/cart`, `/products/[id]` stay static/ISR.
- Commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Server Action called directly by a non-admin** — actions are public endpoints; each must reject before touching data. Enforced in Task 3 (first statement), checked manually in Task 6 item 6.
2. **Photo path from one product attached to another** (or `../` paths) — must be rejected. Test in Task 1 (`isValidImagePath`).
3. **Float rounding in prices** — `19.99` must become `1999`, not `1998`. Test in Task 1.
4. **Stale static pages after unpublish** — a pre-rendered product page must 404 right after unpublishing. Revalidation in Task 3; manual Task 6 item 4.
5. **Editing only the price below an existing sale price** — the form must reject the save, not store `sale_price >= price` (the DB check would throw a generic error). Test in Task 1.

---

### Task 1: Product form validation

**Files:**
- Create: `lib/product-form.ts`, `lib/product-form.test.ts`

**Interfaces:**
- Consumes: `CATEGORIES`, `Category` from `lib/products.ts`
- Produces (no I/O imports):
  - `export type FieldName = "id" | "name" | "price" | "salePrice" | "category" | "description" | "sizes" | "material" | "construction" | "origin" | "swatchA" | "swatchB" | "sortOrder"`
  - `export type ProductInput = { name: string; price: number; sale_price: number | null; category: Category; description: string; sizes: string[]; material: string; construction: string; origin: string; swatch: [string, string]; featured: boolean; sort_order: number }`
  - `export function parseProductForm(fields: Record<string, string | undefined>, mode: "create" | "update"): { ok: true; id: string | null; value: ProductInput } | { ok: false; errors: Partial<Record<FieldName, string>> }` — `id` is the validated slug in create mode, `null` in update mode
  - `export function parsePriceToCents(raw: string | undefined): number | null` — `null` for invalid
  - `export function isValidProductId(id: string): boolean`
  - `export const MAX_IMAGE_BYTES = 5 * 1024 * 1024`
  - `export function imagePathFor(id: string, contentType: string, now: number): string | null`
  - `export function isValidImagePath(id: string, path: string): boolean`

- [ ] **Step 1: Write failing tests in `lib/product-form.test.ts`.** Use a `valid` fixture (`id: "trail-cap"`, `name: "Trail Cap"`, `price: "28.00"`, `salePrice: ""`, `category: "Accessories"`, `description: "Cap."`, `sizes: "One Size"`, `material/construction/origin: "x"`, `swatchA: "#AABBCC"`, `swatchB: "#112233"`, `featured: "on"`, `sortOrder: ""`) and cover:
  - `parsePriceToCents`: `"28"`→2800, `"28.5"`→2850, `"28.50"`→2850, `"19.99"`→1999, `" 7.10 "`→710; `"0"`, `"-1"`, `"28.999"`, `"abc"`, `""`, `undefined`, `"100000"` (= 10,000,000 cents) → `null`.
  - Valid fixture → `ok`, `id: "trail-cap"`, `value` equals `{ name: "Trail Cap", price: 2800, sale_price: null, category: "Accessories", description: "Cap.", sizes: ["One Size"], material: "x", construction: "x", origin: "x", swatch: ["#aabbcc", "#112233"], featured: true, sort_order: 0 }`.
  - Update mode ignores `id` (even `"Bad ID"`) and returns `id: null`.
  - Each field's error copy (Global Constraints) for: id `"Bad ID"`, `"-x"`, 61 chars; name blank / 101 chars; price `"abc"`; salePrice `"28.00"` and `"30"` with price `"28.00"` (Review Focus 5); category `"Hats"`; description blank / 2001 chars; sizes `""`, 13 sizes, a 21-char size; material blank / 201 chars; swatchA `"red"`; sortOrder `"1.5"`.
  - Sizes `" S, M ,S,, L "` → `["S","M","L"]`.
  - `featured` absent → `false`; sortOrder `"-3"` → -3.
  - `imagePathFor("tee","image/jpeg",123)`→`"tee-123.jpg"`, png→`.png`, webp→`.webp`, `"image/gif"`→`null`.
  - `isValidImagePath("tee", p)`: true for `"tee-123.jpg"`, `"tee-1.webp"`; false for `"other-123.jpg"`, `"tee-abc.jpg"`, `"tee-123.gif"`, `"../tee-123.jpg"`, `"x/tee-123.jpg"`, `"tee-shirt-123.jpg"`, `"tee-123.jpg.png"` (Review Focus 2).
- [ ] **Step 2: Run** `npm test` — Expected: FAIL, cannot resolve `./product-form`.
- [ ] **Step 3: Implement `lib/product-form.ts`.** Price: match `^\d+(\.\d{1,2})?$` on the trimmed string, then compute cents from the integer and fraction parts as integers (no float multiply), require `0 < cents < 10_000_000`. Id slug: `^[a-z0-9]+(-[a-z0-9]+)*$`, length ≤ 60. Image path: escape nothing — build `new RegExp("^" + id + "-\\d+\\.(jpg|png|webp)$")` only after `isValidProductId(id)` is true.
- [ ] **Step 4: Run** `npm test` — Expected: all PASS.
- [ ] **Step 5: Commit** → "Add product form validation".

---

### Task 2: `published` column and catalog filter

**Files:**
- Create: `supabase/migrations/<version>_add_product_published.sql`
- Modify: `lib/catalog.ts` (the three queries)

**Interfaces:**
- Produces: `public.products.published boolean not null default true`; catalog reads return published products only.

- [ ] **Step 1: Write the migration** with the spec's SQL; apply via Supabase MCP `apply_migration` (name `add_product_published`, project `dtytkwxlpvkervhkhcpu`); name the file with the version `list_migrations` reports.
- [ ] **Step 2: Verify** SQL `select count(*) filter (where published) , count(*) from public.products` → both equal (all published).
- [ ] **Step 3: Add `.eq("published", true)`** to `getAllProducts`, `getProduct`, `getProductsByCategory` in `lib/catalog.ts`.
- [ ] **Step 4: Verify** `npx tsc --noEmit`, `npm run lint`, `npm test` pass; with the dev server, `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/products/essential-tee` → `200`.
- [ ] **Step 5: Commit** migration + `lib/catalog.ts` → "Hide unpublished products from the catalog".

---

### Task 3: Admin data access and Server Actions

**Files:**
- Create: `lib/admin-products.ts`, `app/admin/products/actions.ts`

**Interfaces:**
- Consumes: Task 1 (`parseProductForm`, `isValidProductId`, `imagePathFor`, `isValidImagePath`, `MAX_IMAGE_BYTES`, `ProductInput`, `FieldName`); `requireAdmin` (`lib/auth-guards.ts`); `supabaseAdmin`; `Product` (`lib/products.ts`)
- Produces:
  - `lib/admin-products.ts` (`import "server-only"`): `export type AdminProduct = Product & { published: boolean }`; `listProductsForAdmin(): Promise<AdminProduct[]>` (order `sort_order`, then `name`); `getProductForAdmin(id: string): Promise<AdminProduct | null>`; `insertProduct(id: string, input: ProductInput): Promise<"ok" | "exists">` (`23505` → `"exists"`); `updateProduct(id: string, input: ProductInput): Promise<void>`; `setPublished(id: string, published: boolean): Promise<void>`; `createImageUpload(path: string): Promise<{ path: string; token: string }>` (`storage.from("product-images").createSignedUploadUrl(path)`); `imageExists(path: string): Promise<boolean>`; `setProductImage(id: string, path: string): Promise<void>` (public URL via `getPublicUrl`; then best-effort `remove([oldPath])` when the old `image_url` points into `product-images`, logging failures). Other Supabase errors: `console.error` + `throw new Error("admin products query failed")`. Map rows to `AdminProduct` like `lib/catalog.ts` does.
  - `app/admin/products/actions.ts` (`"use server"`):
    - `export type ProductFormState = { errors: Partial<Record<FieldName | "form", string>> }`
    - `createProductAction(prev: ProductFormState, formData: FormData): Promise<ProductFormState>`
    - `updateProductAction(id: string, prev: ProductFormState, formData: FormData): Promise<ProductFormState>` (bind `id` in the page)
    - `setPublishedAction(id: string, published: boolean): Promise<void>`
    - `requestImageUpload(id: string, contentType: string, size: number): Promise<{ path: string; token: string } | { error: string }>` — error copy `Photo upload failed. Try again.` for bad type/size/id

Behavior: create/update → `requireAdmin("/admin")` → parse (fields from `formData`, strings only) → on errors return them → write (`"exists"` → `errors.id = "A product with this ID already exists."`) → if `imagePath` non-empty: `isValidImagePath` and `imageExists` must both pass, else `errors.form = "Photo upload failed. Try again."` → `setProductImage` → revalidate (Global Constraints) → `redirect("/admin")`. Any thrown error other than Next's redirect → `errors.form = "Something went wrong, please try again."` (call `redirect` outside the try/catch). Update of an unknown id → `notFound()`.

- [ ] **Step 1: Implement both files.**
- [ ] **Step 2: Verify** `npx tsc --noEmit`, `npm run lint`, `npm test` pass. `grep -n "export async function" app/admin/products/actions.ts` and confirm each function's first statement is `await requireAdmin(`.
- [ ] **Step 3: Commit** → "Add admin product actions".

---

### Task 4: Admin products list

**Files:**
- Modify: `app/admin/page.tsx`
- Create: `app/admin/PublishToggle.tsx`

**Interfaces:**
- Consumes: `listProductsForAdmin`, `setPublishedAction`, `ProductImage`, `formatPrice`
- Produces: `PublishToggle` (`"use client"`, props `{ id: string; published: boolean }`) — a button labelled `Unpublish` / `Publish` that calls `setPublishedAction` inside `useTransition` and is disabled while pending.

- [ ] **Step 1: Replace the placeholder** with: heading "Products", a "New product" link to `/admin/products/new`, then one row per product — thumbnail (`ProductImage` with `sizes="64px"`), name, `id` (mono), category, `formatPrice(price)` plus sale price when set, a `Published` or `Hidden` badge, an "Edit" link to `/admin/products/<id>`, and `PublishToggle`. Keep `export const metadata = { title: "Admin" }` and `requireAdmin("/admin")`.
- [ ] **Step 2: Verify** `npx tsc --noEmit`, `npm run lint` pass; in the in-app browser as the admin account, `/admin` lists all 12 products as Published.
- [ ] **Step 3: Commit** → "List products in the admin page".

---

### Task 5: Product form with photo upload

**Files:**
- Create: `app/admin/products/ProductForm.tsx`, `app/admin/products/new/page.tsx`, `app/admin/products/[id]/page.tsx`

**Interfaces:**
- Consumes: Task 3 actions and `ProductFormState`; `getProductForAdmin`; `MAX_IMAGE_BYTES`; `createClient` from `lib/supabase/client.ts`; `CATEGORIES`
- Produces: `ProductForm` (`"use client"`), props `{ mode: "create" | "update"; action: (prev: ProductFormState, formData: FormData) => Promise<ProductFormState>; product?: AdminProduct }`

- [ ] **Step 1: `ProductForm`.** Fields named exactly as `FieldName` plus `featured` (checkbox) and hidden `imagePath`. Prices shown as dollars (`(cents / 100).toFixed(2)`); sizes joined with `", "`. `id` input only in create mode; in update mode show it read-only text. Photo: `<input type="file" accept="image/jpeg,image/png,image/webp">`; on change → reject wrong type or `size > MAX_IMAGE_BYTES` client-side with `Photo upload failed. Try again.`; else show an object-URL preview, call `requestImageUpload(id, file.type, file.size)` (in create mode use the current `id` field value; require it to be a valid slug first), then `createClient().storage.from("product-images").uploadToSignedUrl(path, token, file, { contentType: file.type })`; on success set `imagePath`. Save is disabled while uploading or pending. Field errors under each input; `errors.form` above Save.
- [ ] **Step 2: Pages.** `new/page.tsx`: `requireAdmin("/admin/products/new")`, render `<ProductForm mode="create" action={createProductAction} />`. `[id]/page.tsx`: `params: Promise<{ id: string }>`; `requireAdmin(...)`; `getProductForAdmin(id)` or `notFound()`; render the form with `updateProductAction.bind(null, id)` and a "View in shop" link. Both `metadata.title` "Admin".
- [ ] **Step 3: Verify** `npx tsc --noEmit`, `npm run lint`, `npm test` pass; `npm run build` passes and `/`, `/cart`, `/products/[id]` are ○/●.
- [ ] **Step 4: Commit** → "Add admin product form with photo upload".

---

### Task 6: Manual check and docs

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Run the spec's manual checklist (items 1–6)** in the in-app browser with the admin account (`nishan.mayadunna@gmail.com`; the user signs in to Google themselves) and, for item 6, the password test account `qa.tester1@example.test`. Use a test product id such as `qa-test-cap` and a small local test image. For item 3 confirm the old file is gone with SQL on `storage.objects` (`name like 'qa-test-cap-%'`). Record pass/fail per item. Leave the test product **unpublished** at the end.
- [ ] **Step 2: Update `CLAUDE.md`:** admin products (`/admin`, `/admin/products/new|[id]`), `published` flag filtered in `lib/catalog.ts`, validation in `lib/product-form.ts`, actions in `app/admin/products/actions.ts` each starting with `requireAdmin`, signed-upload photo flow and `<id>-<epoch>.<ext>` naming, revalidation list; replace "Edit catalog data in the dashboard or with the secret key" with the admin page.
- [ ] **Step 3: Final verification** `npm test && npm run lint && npm run build` — all pass.
- [ ] **Step 4: Commit** → "Document admin products in CLAUDE.md".
