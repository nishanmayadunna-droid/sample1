# Admin-Managed Categories — Design

Date: 2026-10-26
Status: Approved in brainstorming, pending written-spec review
Scope: Spec 4. Builds on Spec 3 (admin products) and the product-delete change.
Lives on `feat/categories`, branched from `feat/product-delete`.

## Goal

Admins create, rename, recolour, reorder and delete product categories from
`/admin`, instead of the four categories being hard-coded.

Success means:

- The shop looks and behaves the same after the migration (same four
  categories, names, tile colours and order).
- An admin can add a category, assign products to it, and see it in the shop
  at once.
- Renaming a category changes every place its name is shown, without changing
  any URL.
- A category that still has products cannot be deleted; an empty one can,
  after typing its slug.
- Old links such as `/products?category=Outerwear` keep working.

## Decisions

| Topic | Decision |
|---|---|
| Identity | Immutable lowercase `slug` (primary key, used in URLs and in `products.category`) + editable display `name` |
| Delete with products | Blocked (UI, server and a `on delete restrict` foreign key) |
| Tile visual | Two admin-chosen gradient colours (`swatch`), as today |
| Empty categories | Hidden from the home-page tiles; shown in the `/products` filter |
| Out of scope | Sub-categories, multiple categories per product, category photos, hiding categories |

## Data

New migration `supabase/migrations/<version>_create_categories.sql`, applied to
the remote project in one transaction and saved locally with the matching version.

```sql
create table public.categories (
  slug       text primary key check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) <= 60),
  name       text not null check (length(btrim(name)) between 1 and 40),
  swatch     text[] not null check (cardinality(swatch) = 2),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create unique index categories_name_lower_idx on public.categories (lower(name));

alter table public.categories enable row level security;
create policy "Categories are publicly readable"
  on public.categories for select to anon, authenticated using (true);
revoke all on table public.categories from anon, authenticated;
grant select on table public.categories to anon, authenticated;

insert into public.categories (slug, name, swatch, sort_order) values
  ('tops',        'Tops',        array['#1e293b', '#0f172a'], 1),
  ('bottoms',     'Bottoms',     array['#3b82f6', '#1e3a8a'], 2),
  ('outerwear',   'Outerwear',   array['#4d7c0f', '#365314'], 3),
  ('accessories', 'Accessories', array['#d97706', '#78350f'], 4);

alter table public.products drop constraint products_category_check;
update public.products set category = lower(category);
alter table public.products
  add constraint products_category_fkey
  foreign key (category) references public.categories (slug) on delete restrict;
```

The colours and order are the ones hard-coded today in `app/page.tsx`
(`CATEGORY_SWATCH`) and `lib/products.ts` (`CATEGORIES`). The CHECK
constraint name `products_category_check` was confirmed against the remote schema.

## Types and reads

`lib/products.ts`:

- Remove the `CATEGORIES` array and the `Category` string union.
- Add `export type Category = { slug: string; name: string; swatch: [string, string]; sortOrder: number }`.
- `Product.category` holds the slug (`string`); add `Product.categoryName: string`.

`lib/catalog.ts`:

- `getCategories(): Promise<Category[]>`, wrapped in `cache()`, ordered by
  `sort_order`, then `name`, using the same cookie-less client (pages stay static).
- Product queries select `categories(name)` through the foreign key and map it to
  `categoryName`.
- `getProductsByCategory(slug)` filters by slug.

## Pure rules

`lib/category-form.ts` (no I/O, unit-tested):

- `parseCategoryForm(fields, mode: "create" | "update")` →
  `{ ok: true; slug: string | null; value: CategoryInput }` or
  `{ ok: false; errors }`, where `CategoryInput = { name, swatch: [a, b], sort_order }`.

| Field | Rule | Error |
|---|---|---|
| `slug` (create only) | same rule as product ids (`isValidProductId`) | `Use lowercase letters, numbers and dashes.` |
| `name` | trimmed, 1–40 chars | `Name is required (max 40 characters).` |
| `swatchA`, `swatchB` | `#rrggbb`, stored lowercase | `Pick a color.` |
| `sortOrder` | integer, blank = 0 | `Enter a whole number.` |

- `resolveCategoryParam(param: string | undefined, categories: Category[]): Category | null`
  — matches a slug or a name, case-insensitively, after trimming; else `null`.

`lib/product-form.ts`: `parseProductForm` takes the allowed category slugs
(`parseProductForm(fields, mode, categorySlugs: string[])`) and rejects others
with `Pick a category.`; `ProductInput.category` becomes `string`.

## Server

`lib/admin-categories.ts` (`import "server-only"`, secret-key client):

- `listCategoriesForAdmin(): Promise<(Category & { productCount: number })[]>`
  (counts include unpublished products).
- `getCategoryForAdmin(slug)`
- `insertCategory(slug, input): Promise<"ok" | "exists">` — `"exists"` on a
  duplicate slug or a duplicate name (both unique violations).
- `updateCategory(slug, input): Promise<"ok" | "name_taken">`
- `deleteCategory(slug): Promise<{ deleted: true } | { blocked: number } | { deleted: false }>`
  — counts products first; also maps the foreign-key violation (`23503`) to
  `blocked`, in case a product was assigned in between.

`app/admin/categories/actions.ts` (`"use server"`), each starting with
`await requireAdmin(...)`:

- `createCategoryAction`, `updateCategoryAction(slug, …)`, `deleteCategoryAction(slug, …)`
  (delete requires typing the slug, checked with `isDeleteConfirmed`).
- Errors: duplicate slug → `A category with this slug already exists.`;
  duplicate name → `Another category already uses this name.`; blocked delete →
  `This category has N products. Move or delete them first.`; other failures →
  `Something went wrong, please try again.`
- After every write: `revalidatePath("/")`, `"/products"`,
  `revalidatePath("/products/[id]", "page")` (names shown on product pages),
  `"/cart"`, `"/admin"`, `"/admin/categories"`.

## UI

Admin (all `requireAdmin`, Northbound styling):

| Route | Contents |
|---|---|
| `/admin` and `/admin/categories` | A small "Products · Categories" tab bar at the top of both. |
| `/admin/categories` | "New category" button; one row per category: swatch preview, name, slug, product count, "Edit". |
| `/admin/categories/new` | `CategoryForm` (slug, name, two colour pickers, sort order). |
| `/admin/categories/[slug]` | `CategoryForm` with slug read-only, plus a Danger zone. Unknown slug → 404. |

- Danger zone: with products, the delete button is disabled and the blocked
  message is shown; with none, it uses the same type-to-confirm pattern as
  product delete.
- `CategoryForm` submits through `onSubmit` + `startTransition` (like
  `ProductForm`) so a validation error doesn't reset the inputs.
- `ProductForm` gets its category options from `getCategories()` via the page;
  the option value is the slug, the label the name.

Shop (same look as today):

- Home "Shop by category": tiles from `getCategories()`, colours from `swatch`,
  hiding categories with no published products; links `?category=<slug>`.
- Hero "Shop outerwear" link → `?category=outerwear`.
- `/products`: filter tabs from `getCategories()`; `?category=` resolved with
  `resolveCategoryParam`, so `Outerwear`, `outerwear` and `OUTERWEAR` all work;
  unknown values show all products, as today.
- Product page breadcrumb, "More in …" and `ProductImage`'s chip use
  `categoryName`; links use the slug.
- Admin products list shows the category name.

## Testing

**Unit (Vitest):**

- `parseCategoryForm`: every rule above; slug ignored in update mode; swatch
  lowercased.
- `resolveCategoryParam`: slug, exact name, other case, padded, unknown, empty,
  `undefined`.
- `parseProductForm`: accepts an allowed slug, rejects an unknown one and the
  old display name `"Outerwear"`.

**Manual (in-app browser, admin account):**

1. Create category `qa-test-cat`, assign a product to it → its tile appears on
   the home page and in the `/products` filter.
2. Rename it → new name on the tile, filter and product breadcrumb; URLs unchanged.
3. Try to delete it while it has products → blocked with the count.
4. Move the product back, delete the category → gone everywhere.
5. `/products?category=Outerwear` still filters to outerwear.

**Checks:** `npm test`, `npm run lint`, `npm run build` pass; `/`, `/cart`,
`/products/[id]` stay static/ISR.

## Out of scope

- Sub-categories or several categories per product
- Category photos
- Hiding/unpublishing categories
- Drag-and-drop ordering (`sortOrder` is a number field)
