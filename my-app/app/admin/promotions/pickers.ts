import "server-only";
import { listCategoriesForAdmin } from "@/lib/admin-categories";
import { listProductsForAdmin } from "@/lib/admin-products";
import type { PickerCategory, PickerProduct } from "./RulesEditor";

/** Every category and product (hidden ones too) for the rule scope pickers. */
export async function getPickers(): Promise<{ categories: PickerCategory[]; products: PickerProduct[] }> {
  const [categories, products] = await Promise.all([listCategoriesForAdmin(), listProductsForAdmin()]);
  return {
    categories: categories.map((c) => ({ slug: c.slug, name: c.name })),
    products: products.map((p) => ({ id: p.id, name: p.name })),
  };
}
