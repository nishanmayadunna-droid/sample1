// Server-side category management for /admin/categories. Uses the secret-key
// client; callers must check requireAdmin() first (app/admin/categories/actions.ts).
import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getCategories } from "@/lib/catalog";
import { productsInCategory, type CategoryInput } from "@/lib/category-form";
import type { Category } from "@/lib/products";

export type AdminCategory = Category & { productCount: number };

// Postgres error codes.
const UNIQUE_VIOLATION = "23505";
const FOREIGN_KEY_VIOLATION = "23503";

function fail(error: unknown): never {
  console.error("admin categories query failed", error);
  throw new Error("admin categories query failed");
}

/** Every product (including hidden ones) with its stored category value. */
async function allProductCategories(): Promise<{ category: string }[]> {
  const { data, error } = await supabaseAdmin
    .from("products")
    .select("category")
    .returns<{ category: string }[]>();
  if (error) fail(error);
  return data;
}

function withCounts(categories: Category[], products: { category: string }[]): AdminCategory[] {
  return categories.map((category) => ({
    ...category,
    productCount: productsInCategory(products, category, categories).length,
  }));
}

export async function listCategoriesForAdmin(): Promise<AdminCategory[]> {
  const [categories, products] = await Promise.all([getCategories(), allProductCategories()]);
  return withCounts(categories, products);
}

export async function getCategoryForAdmin(slug: string): Promise<AdminCategory | null> {
  const categories = await listCategoriesForAdmin();
  return categories.find((category) => category.slug === slug) ?? null;
}

function uniqueConflict(error: { code?: string; message?: string; details?: string }) {
  if (error.code !== UNIQUE_VIOLATION) return null;
  const text = `${error.message ?? ""} ${error.details ?? ""}`;
  return text.includes("categories_name_lower_idx") ? "name_taken" : "slug_taken";
}

export async function insertCategory(
  slug: string,
  input: CategoryInput,
): Promise<"ok" | "slug_taken" | "name_taken"> {
  const { error } = await supabaseAdmin.from("categories").insert({ slug, ...input });
  if (error) return uniqueConflict(error) ?? fail(error);
  return "ok";
}

export async function updateCategory(
  slug: string,
  input: CategoryInput,
): Promise<"ok" | "name_taken"> {
  const { error } = await supabaseAdmin.from("categories").update(input).eq("slug", slug);
  if (error) return uniqueConflict(error) === "name_taken" ? "name_taken" : fail(error);
  return "ok";
}

/**
 * Deletes an empty category. Blocked while any product (hidden ones too) still
 * uses it; the products→categories foreign key also blocks it once in place.
 */
export async function deleteCategory(
  slug: string,
): Promise<{ deleted: true } | { deleted: false } | { blocked: number }> {
  const category = await getCategoryForAdmin(slug);
  if (!category) return { deleted: false };
  if (category.productCount > 0) return { blocked: category.productCount };

  const { data, error } = await supabaseAdmin
    .from("categories")
    .delete()
    .eq("slug", slug)
    .select("slug");
  if (error?.code === FOREIGN_KEY_VIOLATION) {
    // A product was assigned between the count and the delete.
    return { blocked: (await getCategoryForAdmin(slug))?.productCount ?? 1 };
  }
  if (error) fail(error);
  return data.length > 0 ? { deleted: true } : { deleted: false };
}
