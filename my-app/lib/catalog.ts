// Server-side catalog queries against the Supabase `products` table.
// Import only from Server Components (it bundles supabase-js).
import { cache } from "react";
import { createClient } from "@supabase/supabase-js";
import type { Category, Product } from "./products";

// The catalog is public and per-user state isn't involved, so a cookie-less
// client is used. That keeps product pages statically generated (ISR) instead
// of opting every route into dynamic rendering via cookies().
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  { auth: { persistSession: false } },
);

type ProductRow = {
  id: string;
  name: string;
  price: number;
  sale_price: number | null;
  category: Category;
  description: string;
  sizes: string[];
  material: string;
  construction: string;
  origin: string;
  swatch: string[];
  image_url: string | null;
  featured: boolean;
};

const COLUMNS =
  "id, name, price, sale_price, category, description, sizes, material, construction, origin, swatch, image_url, featured";

function toProduct(row: ProductRow): Product {
  return {
    id: row.id,
    name: row.name,
    price: row.price,
    salePrice: row.sale_price ?? undefined,
    category: row.category,
    description: row.description,
    sizes: row.sizes,
    spec: {
      material: row.material,
      construction: row.construction,
      origin: row.origin,
    },
    swatch: [row.swatch[0], row.swatch[1]],
    imageUrl: row.image_url ?? undefined,
    featured: row.featured,
  };
}

// Unpublished products (hidden by an admin) never reach the shop.
const selectProducts = () =>
  supabase.from("products").select(COLUMNS).eq("published", true);

// cache() dedupes calls within one render (e.g. generateMetadata + page).
export const getAllProducts = cache(async (): Promise<Product[]> => {
  const { data, error } = await selectProducts()
    .order("sort_order")
    .overrideTypes<ProductRow[], { merge: false }>();
  if (error) throw new Error(`Failed to load products: ${error.message}`);
  return data.map(toProduct);
});

export const getProduct = cache(
  async (id: string): Promise<Product | undefined> => {
    const { data, error } = await selectProducts()
      .eq("id", id)
      .maybeSingle()
      .overrideTypes<ProductRow, { merge: false }>();
    if (error) throw new Error(`Failed to load product ${id}: ${error.message}`);
    return data ? toProduct(data) : undefined;
  },
);

export const getProductsByCategory = cache(
  async (category: Category): Promise<Product[]> => {
    const { data, error } = await selectProducts()
      .eq("category", category)
      .order("sort_order")
      .overrideTypes<ProductRow[], { merge: false }>();
    if (error) throw new Error(`Failed to load ${category}: ${error.message}`);
    return data.map(toProduct);
  },
);
