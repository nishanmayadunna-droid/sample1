# Admin-Managed Categories Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the four hard-coded categories with a `categories` table admins can create, rename, recolour, reorder and delete.

**Architecture:** A pure, tested `lib/category-form.ts` validates category forms and resolves a category from a slug or a name. The shop reads categories with the cookie-less catalog client and matches each product's `category` value against them, so the new code works whether products store old names or new slugs. Admin CRUD follows the products pattern (server-only module + `requireAdmin` actions + revalidation).

**Tech Stack:** Next.js 16.4.3, React 19.2, Supabase, Vitest 4.

**Spec:** `docs/superpowers/specs/2026-10-26-categories-design.md`

## Deviation from the spec: two-step migration (expand → contract)

Local development and production share one Supabase project. Converting
`products.category` to slugs and adding the foreign key while production still
runs `main` would break production's category filters and its admin product
save. So the spec's single migration is split:

- **M1 `create_categories`** (applied in Task 3; safe for the code on `main`):
  create and seed `categories` (spec SQL), and drop `products_category_check`.
  Product values stay `'Tops'` etc.
- **M2 `link_products_to_categories`** (file written in Task 6, **applied only
  after this branch is deployed to production**): `update products set category = lower(category)`
  and add `products_category_fkey … on delete restrict`.

Until M2 runs, the new code resolves `products.category` by slug **or** name
(`resolveCategoryParam`), and product reads don't use a PostgREST embed (which
needs the FK). Between M1 and M2 there is no database-level delete guard; the
server-side product count check in `deleteCategory` still blocks deleting a
category in use.

## Global Constraints

- Branch `feat/categories` (from `feat/product-delete`). Read `node_modules/next/dist/docs/01-app/` guides before Next.js code.
- Slugs: same rule as product ids (`isValidProductId`); immutable after create.
- Names: trimmed, 1–40 chars, unique case-insensitively.
- Error copy, verbatim: `Use lowercase letters, numbers and dashes.` · `Name is required (max 40 characters).` · `Pick a color.` · `Enter a whole number.` · `Pick a category.` · `A category with this slug already exists.` · `Another category already uses this name.` · `This category has N products. Move or delete them first.` (N = count; `1 product` singular) · `Type the category slug to confirm.` · `Something went wrong, please try again.`
- Every exported action in `app/admin/categories/actions.ts` starts with `await requireAdmin(...)`.
- After every category write: `revalidatePath("/")`, `"/products"`, `revalidatePath("/products/[id]", "page")`, `"/cart"`, `"/admin"`, `"/admin/categories"`.
- Forms submit via `onSubmit` + `startTransition` (not `action=`), like `ProductForm`.
- Shop looks the same after M1: same names, colours, order. `/`, `/cart`, `/products/[id]` stay static/ISR.
- Northbound tokens/classes only. Commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Mixed old/new category values** — between M1 and M2 some products store `'Outerwear'`, new ones `'qa-test-cat'`; every shop view (tile counts, filters, breadcrumb, related products, chip) must treat both correctly. Tests in Task 1 (`resolveCategoryParam` with names and slugs) and Task 3 (`productsInCategory`).
2. **Rename to a name that differs only in case from another category** (`tops` vs `Tops`) — must show `Another category already uses this name.`, not a generic error. Task 4 maps the unique-index violation.
3. **Deleting a category in use** — must be blocked even without the FK (before M2). Task 4's count check; manual Task 6 item 3.
4. **A product whose category row is missing** (deleted between page render and save, or bad data) — product pages must still render (fall back to the raw value as the name), and saving the product must show `Pick a category.`. Task 2 test (unknown slug) and Task 3 (`categoryName` fallback).
5. **Old URLs** — `/products?category=Outerwear` and `?category=OUTERWEAR` must filter, unknown values show all. Task 1 test; manual Task 6 item 5.

---

## File Structure

| File | Status | Responsibility |
|---|---|---|
| `lib/category-form.ts` (+ `.test.ts`) | Create | `parseCategoryForm`, `resolveCategoryParam`, `productsInCategory`, `categoryNameFor`, `CategoryInput` |
| `lib/product-form.ts` (+ test) | Modify | `parseProductForm(fields, mode, categorySlugs)`; `ProductInput.category: string` |
| `supabase/migrations/<v>_create_categories.sql` | Create | M1 |
| `supabase/migrations/<v>_link_products_to_categories.sql` | Create (not applied) | M2 |
| `lib/products.ts` | Modify | `Category` object type; drop `CATEGORIES`; `Product.categoryName` |
| `lib/catalog.ts` | Modify | `getCategories()`; product mapping adds `categoryName` |
| `app/page.tsx`, `app/products/page.tsx`, `app/products/[id]/page.tsx`, `app/components/ProductImage.tsx`, `app/admin/page.tsx`, `app/admin/products/ProductForm.tsx`, `app/admin/products/actions.ts`, admin product pages | Modify | Use DB categories |
| `lib/admin-categories.ts` | Create | Server-only CRUD |
| `app/admin/categories/actions.ts` | Create | Admin-checked actions |
| `app/admin/AdminTabs.tsx` | Create | "Products · Categories" tab bar |
| `app/admin/categories/page.tsx`, `new/page.tsx`, `[slug]/page.tsx`, `CategoryForm.tsx`, `DeleteCategory.tsx` | Create | Admin UI |
| `CLAUDE.md` | Modify | Document categories + pending M2 |

---

### Task 1: Category rules

**Files:** Create `lib/category-form.ts`, `lib/category-form.test.ts`

**Interfaces:**
- Consumes: `isValidProductId` (`lib/product-form.ts`), `Category` type from `lib/products.ts` — define the new type there in this task: `export type Category = { slug: string; name: string; swatch: [string, string]; sortOrder: number }` (keep the old `CATEGORIES`/union for now under the name `LegacyCategory`/`CATEGORIES` until Task 3 removes them; rename the old union to `LegacyCategory` and update its few imports so the build stays green).
- Produces:
  - `export type CategoryInput = { name: string; swatch: [string, string]; sort_order: number }`
  - `export type CategoryFieldName = "slug" | "name" | "swatchA" | "swatchB" | "sortOrder"`
  - `export function parseCategoryForm(fields: Record<string, string | undefined>, mode: "create" | "update"): { ok: true; slug: string | null; value: CategoryInput } | { ok: false; errors: Partial<Record<CategoryFieldName, string>> }`
  - `export function resolveCategoryParam(param: string | undefined, categories: Category[]): Category | null` — trimmed, case-insensitive match on slug or name
  - `export function categoryNameFor(value: string, categories: Category[]): string` — resolved name, else `value`
  - `export function productsInCategory<T extends { category: string }>(products: T[], category: Category, categories: Category[]): T[]` — products whose `category` resolves to `category.slug`

- [ ] **Step 1: Failing tests** covering: valid create (`slug "qa-test-cat"`, `name " QA Cat "` → `"QA Cat"`, swatch `#AABBCC/#112233` → lowercase, sortOrder `""` → 0); update mode ignores slug (`"Bad Slug"`) → `slug: null`; each error copy (slug `"Bad Slug"`, name `""` and 41 chars, swatchA `"red"`, sortOrder `"1.5"`); `resolveCategoryParam` with `"outerwear"`, `"Outerwear"`, `" OUTERWEAR "` → outerwear; `"Hats"`, `""`, `undefined` → null; `categoryNameFor("tops") → "Tops"`, `categoryNameFor("Tops") → "Tops"`, `categoryNameFor("gone") → "gone"`; `productsInCategory` returns products stored as `"Outerwear"` **and** `"outerwear"`, not `"Tops"` (Review Focus 1). Use a fixture of the four seeded categories.
- [ ] **Step 2: Run** `npm test` → FAIL (module missing).
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npm test`, `npx tsc --noEmit` → PASS.
- [ ] **Step 5: Commit** → "Add category form and matching rules".

---

### Task 2: Product form validates against DB categories

**Files:** Modify `lib/product-form.ts`, `lib/product-form.test.ts`

**Interfaces:** `parseProductForm(fields, mode, categorySlugs: string[])`; `ProductInput.category: string`.

- [ ] **Step 1: Failing tests:** existing fixture passes `["tops","bottoms","outerwear","accessories"]` and uses `category: "accessories"`; unknown slug `"hats"` and old name `"Outerwear"` → `Pick a category.`; existing tests updated to the new signature.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement**; stop importing `CATEGORIES` in this file.
- [ ] **Step 4: Run** `npm test` → PASS (callers fixed in Task 3; until then `tsc` may fail only in `app/admin/products/actions.ts` — fix it here by passing the slugs from `getCategories()` once Task 3 adds it; to keep this task green, temporarily pass `["tops","bottoms","outerwear","accessories"]` there and remove that in Task 3).
- [ ] **Step 5: Commit** → "Validate product categories against a list of slugs".

---

### Task 3: M1 + shop and admin read categories from the database

**Files:** M1 migration; `lib/products.ts`, `lib/catalog.ts`, `app/page.tsx`, `app/products/page.tsx`, `app/products/[id]/page.tsx`, `app/components/ProductImage.tsx`, `app/admin/page.tsx`, `app/admin/products/ProductForm.tsx`, `app/admin/products/new/page.tsx`, `app/admin/products/[id]/page.tsx`, `app/admin/products/actions.ts`

**Interfaces:**
- Consumes: Task 1, Task 2.
- Produces: `getCategories(): Promise<Category[]>` (cached, order `sort_order`, `name`); every `Product` has `categoryName: string`; `ProductForm` prop `categories: Category[]`.

- [ ] **Step 1: Apply M1** via Supabase MCP `apply_migration` (`create_categories`): the spec's `create table`, index, RLS, policy, grants and seed inserts, plus `alter table public.products drop constraint products_category_check;` — **not** the `update`/FK lines. Save the file with the reported version.
- [ ] **Step 2: Verify** SQL: 4 categories; `products` still has no FK; RLS on `categories` true; anon has SELECT only.
- [ ] **Step 3: Types and catalog.** Remove `CATEGORIES`/`LegacyCategory`; `Product.category: string`, add `categoryName`. In `lib/catalog.ts`, `toProduct(row, categories)` sets `categoryName = categoryNameFor(row.category, categories)`; product getters load `getCategories()` once. `getProductsByCategory(category: Category)` filters with `.in("category", [category.slug, category.name])`.
- [ ] **Step 4: Shop pages.** Home tiles from `getCategories()` with `swatch`, counted via `productsInCategory`, hidden when 0, `href ?category=<slug>`; hero link `?category=outerwear`; `/products` tabs from `getCategories()`, active via `resolveCategoryParam`; product page uses `categoryName` for text and the resolved slug for links (`resolveCategoryParam(product.category, categories)?.slug ?? product.category`); `ProductImage` chip shows `categoryName`.
- [ ] **Step 5: Admin.** Product pages load `getCategories()` and pass `categories` to `ProductForm` (option value = slug, label = name; default = the product's resolved slug, else first); create/update actions pass `(await getCategories()).map(c => c.slug)` to `parseProductForm`; admin list shows `categoryName`.
- [ ] **Step 6: Verify** `npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run build` (○/● unchanged); dev server: `/`, `/products?category=outerwear`, `/products?category=Outerwear`, `/products/essential-tee` → 200, home shows 4 tiles.
- [ ] **Step 7: Commit** migration + all files → "Read categories from the database".

---

### Task 4: Category data access and actions

**Files:** Create `lib/admin-categories.ts`, `app/admin/categories/actions.ts`

**Interfaces:**
- `lib/admin-categories.ts` (`server-only`): `type AdminCategory = Category & { productCount: number }`; `listCategoriesForAdmin(): Promise<AdminCategory[]>` (count = products resolving to it via `productsInCategory`, including unpublished); `getCategoryForAdmin(slug): Promise<AdminCategory | null>`; `insertCategory(slug, input): Promise<"ok" | "slug_taken" | "name_taken">`; `updateCategory(slug, input): Promise<"ok" | "name_taken">`; `deleteCategory(slug): Promise<{ deleted: true } | { deleted: false } | { blocked: number }>` (count first; also map Postgres `23503` → `blocked`). Unique violation `23505`: constraint `categories_pkey` → `slug_taken`, `categories_name_lower_idx` → `name_taken` (read `error.message`/`details` for the constraint name).
- `app/admin/categories/actions.ts`: `type CategoryFormState = { errors: Partial<Record<CategoryFieldName | "form", string>> }`; `createCategoryAction(prev, formData)`; `updateCategoryAction(slug, prev, formData)`; `type DeleteCategoryState = { error: string | null }`; `deleteCategoryAction(slug, prev, formData)` (typed slug checked with `isDeleteConfirmed`; blocked → `This category has N products. Move or delete them first.`). Success → revalidate (Global Constraints) and `redirect("/admin/categories")`; `redirect`/`notFound` outside try/catch.

- [ ] **Step 1: Implement both files.**
- [ ] **Step 2: Verify** `npx tsc --noEmit`, `npm run lint`, `npm test`; confirm each exported action's first statement is `await requireAdmin(`.
- [ ] **Step 3: Commit** → "Add category admin actions".

---

### Task 5: Category admin UI

**Files:** Create `app/admin/AdminTabs.tsx`, `app/admin/categories/page.tsx`, `app/admin/categories/new/page.tsx`, `app/admin/categories/[slug]/page.tsx`, `app/admin/categories/CategoryForm.tsx`, `app/admin/categories/DeleteCategory.tsx`; modify `app/admin/page.tsx`

- [ ] **Step 1:** `AdminTabs` (server component, prop `active: "products" | "categories"`) on `/admin` and `/admin/categories`.
- [ ] **Step 2:** List page (swatch preview from `swatch`, name, slug, product count, Edit; "New category"); `CategoryForm` (slug only in create mode, name, two colour inputs, sort order; `onSubmit` + `startTransition`; field errors + `errors.form`); new/edit pages (`params` is a Promise; unknown slug → `notFound()`).
- [ ] **Step 3:** `DeleteCategory` (props `slug`, `name`, `productCount`): when `productCount > 0`, disabled button + the blocked copy; else the type-to-confirm flow from `DeleteProduct`.
- [ ] **Step 4: Verify** `npx tsc --noEmit`, `npm run lint`, `npm test`, `npm run build`.
- [ ] **Step 5: Commit** → "Add category admin pages".

---

### Task 6: Manual check, M2 file, docs

- [ ] **Step 1: Manual checklist** (needs an admin session — the user signs in with Google in the in-app browser): spec items 1–5 using `qa-test-cat` and the hidden `qa-test-cap` product; plus Review Focus 2 (rename `qa-test-cat` to `tops` → name error). Delete `qa-test-cat` at the end. Record pass/fail.
- [ ] **Step 2: Write (do not apply)** `supabase/migrations/<timestamp>_link_products_to_categories.sql`:
  ```sql
  update public.products set category = lower(category);
  alter table public.products
    add constraint products_category_fkey
    foreign key (category) references public.categories (slug) on delete restrict;
  ```
  Add a header comment: apply after this branch is live in production.
- [ ] **Step 3: CLAUDE.md:** categories table, slug vs name, `getCategories`, slug-or-name resolution, admin pages, and "M2 pending until deployed" note.
- [ ] **Step 4: Verify** `npm test && npm run lint && npm run build`.
- [ ] **Step 5: Commit** → "Document categories; add pending FK migration".

### After merge and production deploy (not part of branch execution)

Apply M2 with `apply_migration` (`link_products_to_categories`), rename the local file to the reported version, verify every product's category matches a slug and the FK exists, and commit the rename.
