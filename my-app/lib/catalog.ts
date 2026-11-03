// Server-side catalog queries against the Supabase `products` table.
// Import only from Server Components (it bundles supabase-js).
import { cache } from "react";
import { createClient } from "@supabase/supabase-js";
import { categoryNameFor, productsInCategory } from "./category-form";
import { summarizeRatings, type Review } from "./reviews";
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
  stock: Record<string, number> | null;
  /** Embedded approved reviews (RLS and the select filter hide the rest). */
  reviews: { rating: number }[] | null;
};

export const COLUMNS =
  "id, name, price, sale_price, category, description, sizes, material, construction, origin, swatch, image_url, featured, created_at, product_images(path, sort_order), stock, reviews(rating)";

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
    stock: row.stock ?? null,
    rating: summarizeRatings((row.reviews ?? []).map((r) => r.rating)),
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
  supabase
    .from("products")
    .select(COLUMNS)
    .eq("published", true)
    .eq("reviews.status", "approved");

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

type ReviewRow = {
  id: string;
  author_name: string;
  rating: number;
  body: string;
  created_at: string;
  verified: boolean;
};

/** Approved reviews for one product, newest first. */
export const getProductReviews = cache(async (productId: string): Promise<Review[]> => {
  const { data, error } = await supabase
    .from("reviews")
    .select("id, author_name, rating, body, created_at, verified")
    .eq("product_id", productId)
    .eq("status", "approved")
    .order("created_at", { ascending: false })
    .limit(50)
    .overrideTypes<ReviewRow[], { merge: false }>();
  if (error) throw new Error(`Failed to load reviews for ${productId}: ${error.message}`);
  return data.map((row) => ({
    id: row.id,
    authorName: row.author_name,
    rating: row.rating,
    body: row.body,
    createdAt: row.created_at,
    verified: row.verified,
  }));
});

// Filters the full catalog with the same slug-or-legacy-name rule the rest of
// the shop uses. A database filter can't: until the FK migration, a renamed
// seeded category's products still store the old name ('Outerwear').
export const getProductsByCategory = cache(
  async (category: Category): Promise<Product[]> => {
    const [products, categories] = await Promise.all([getAllProducts(), getCategories()]);
    return productsInCategory(products, category, categories);
  },
);
