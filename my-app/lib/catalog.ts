// Server-side catalog queries against the Supabase `products` table.
// Import only from Server Components (it bundles supabase-js).
import { cache } from "react";
import { createClient } from "@supabase/supabase-js";
import { categoryNameFor, productsInCategory } from "./category-form";
import { galleryUrls, sortedPhotoPaths } from "./product-photos";
import type { Category, Product } from "./products";

// The catalog is public and per-user state isn't involved, so a cookie-less
// client is used. That keeps product pages statically generated (ISR) instead
// of opting every route into dynamic rendering via cookies().
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  { auth: { persistSession: false } },
);

export type ProductRow = {
  id: string;
  name: string;
  price: number;
  sale_price: number | null;
  category: string; // a category slug (or, until the FK migration, a display name)
  description: string;
  sizes: string[];
  material: string;
  construction: string;
  origin: string;
  swatch: string[];
  image_url: string | null;
  featured: boolean;
  created_at: string;
  /** Embedded photo rows; null when the table is empty for this product. */
  product_images: { path: string; sort_order: number }[] | null;
};

export const COLUMNS =
  "id, name, price, sale_price, category, description, sizes, material, construction, origin, swatch, image_url, featured, created_at, product_images(path, sort_order)";

export function toProduct(row: ProductRow, categories: Category[]): Product {
  return {
    id: row.id,
    name: row.name,
    price: row.price,
    salePrice: row.sale_price ?? undefined,
    category: row.category,
    categoryName: categoryNameFor(row.category, categories),
    description: row.description,
    sizes: row.sizes,
    spec: {
      material: row.material,
      construction: row.construction,
      origin: row.origin,
    },
    swatch: [row.swatch[0], row.swatch[1]],
    imageUrl: row.image_url ?? undefined,
    gallery: galleryUrls(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      sortedPhotoPaths(row.product_images),
      row.image_url,
    ),
    featured: row.featured,
    createdAt: row.created_at,
  };
}

type CategoryRow = { slug: string; name: string; swatch: string[]; sort_order: number };

export const getCategories = cache(async (): Promise<Category[]> => {
  const { data, error } = await supabase
    .from("categories")
    .select("slug, name, swatch, sort_order")
    .order("sort_order")
    .order("name")
    .overrideTypes<CategoryRow[], { merge: false }>();
  if (error) throw new Error(`Failed to load categories: ${error.message}`);
  return data.map((row) => ({
    slug: row.slug,
    name: row.name,
    swatch: [row.swatch[0], row.swatch[1]],
    sortOrder: row.sort_order,
  }));
});

// Unpublished products (hidden by an admin) never reach the shop.
const selectProducts = () =>
  supabase.from("products").select(COLUMNS).eq("published", true);

// cache() dedupes calls within one render (e.g. generateMetadata + page).
export const getAllProducts = cache(async (): Promise<Product[]> => {
  const { data, error } = await selectProducts()
    .order("sort_order")
    .overrideTypes<ProductRow[], { merge: false }>();
  if (error) throw new Error(`Failed to load products: ${error.message}`);
  const categories = await getCategories();
  return data.map((row) => toProduct(row, categories));
});

export const getProduct = cache(
  async (id: string): Promise<Product | undefined> => {
    const { data, error } = await selectProducts()
      .eq("id", id)
      .maybeSingle()
      .overrideTypes<ProductRow, { merge: false }>();
    if (error) throw new Error(`Failed to load product ${id}: ${error.message}`);
    return data ? toProduct(data, await getCategories()) : undefined;
  },
);

// Filters the full catalog with the same slug-or-legacy-name rule the rest of
// the shop uses. A database filter can't: until the FK migration, a renamed
// seeded category's products still store the old name ('Outerwear').
export const getProductsByCategory = cache(
  async (category: Category): Promise<Product[]> => {
    const [products, categories] = await Promise.all([getAllProducts(), getCategories()]);
    return productsInCategory(products, category, categories);
  },
);
