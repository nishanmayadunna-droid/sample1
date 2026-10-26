// Pure category rules: validating the admin form and matching a value (a URL
// param or a product's stored category) to a category by slug or by name.
// Until the products→categories foreign key migration runs, products may
// store either the old display name ('Outerwear') or the slug ('outerwear').
import { isValidProductId } from "@/lib/product-form";
import type { Category } from "@/lib/products";

export type CategoryInput = {
  name: string;
  swatch: [string, string];
  sort_order: number;
};

export type CategoryFieldName = "slug" | "name" | "swatchA" | "swatchB" | "sortOrder";

const HEX_PATTERN = /^#[0-9a-fA-F]{6}$/;
const NAME_MAX = 40;

export function parseCategoryForm(
  fields: Record<string, string | undefined>,
  mode: "create" | "update",
):
  | { ok: true; slug: string | null; value: CategoryInput }
  | { ok: false; errors: Partial<Record<CategoryFieldName, string>> } {
  const errors: Partial<Record<CategoryFieldName, string>> = {};

  let slug: string | null = null;
  if (mode === "create") {
    slug = (fields.slug ?? "").trim();
    // Same slug rule as product ids.
    if (!isValidProductId(slug)) errors.slug = "Use lowercase letters, numbers and dashes.";
  }

  const name = (fields.name ?? "").trim();
  if (name.length < 1 || name.length > NAME_MAX) {
    errors.name = "Name is required (max 40 characters).";
  }

  const swatch: string[] = [];
  for (const field of ["swatchA", "swatchB"] as const) {
    const value = (fields[field] ?? "").trim();
    if (!HEX_PATTERN.test(value)) errors[field] = "Pick a color.";
    else swatch.push(value.toLowerCase());
  }

  const rawSort = (fields.sortOrder ?? "").trim();
  const sortOrder = rawSort === "" ? 0 : Number(rawSort);
  if (!/^-?\d+$/.test(rawSort || "0") || !Number.isSafeInteger(sortOrder)) {
    errors.sortOrder = "Enter a whole number.";
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    slug,
    value: { name, swatch: [swatch[0], swatch[1]], sort_order: sortOrder },
  };
}

/** The category a slug or name refers to (trimmed, case-insensitive), else null. */
export function resolveCategoryParam(
  param: string | undefined,
  categories: Category[],
): Category | null {
  const key = (param ?? "").trim().toLowerCase();
  if (key === "") return null;
  return (
    categories.find((c) => c.slug === key) ??
    categories.find((c) => c.name.toLowerCase() === key) ??
    null
  );
}

/** Display name for a stored category value; falls back to the raw value. */
export function categoryNameFor(value: string, categories: Category[]): string {
  return resolveCategoryParam(value, categories)?.name ?? value;
}

export function productsInCategory<T extends { category: string }>(
  products: T[],
  category: Category,
  categories: Category[],
): T[] {
  return products.filter(
    (p) => resolveCategoryParam(p.category, categories)?.slug === category.slug,
  );
}
