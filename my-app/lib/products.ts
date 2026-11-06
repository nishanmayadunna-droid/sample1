// Product types and pure helpers. Safe to import from client components —
// the data itself lives in Supabase and is fetched via `@/lib/catalog`.
import type { RatingSummary } from "./reviews";
import type { StockMap } from "./stock";

/** A product category, managed by admins in the `categories` table. */
export type Category = {
  slug: string;
  name: string;
  /** Two hex colors for the home-page tile gradient. */
  swatch: [string, string];
  sortOrder: number;
};

/** Garment spec, shown as the monospace label that runs through the whole UI. */
export type Spec = {
  material: string;
  construction: string;
  origin: string;
};

export type Product = {
  id: string;
  name: string;
  /** Price in cents, to avoid floating-point money bugs. */
  price: number;
  /** Discounted price in cents when the item is in the flash sale. */
  salePrice?: number;
  /** Category slug (or, until the FK migration, the old display name). */
  category: string;
  /** The category's display name. */
  categoryName: string;
  description: string;
  sizes: string[];
  spec: Spec;
  /** Two hex colors for the placeholder gradient shown behind the photo. */
  swatch: [string, string];
  /** Public URL of the product photo in the `product-images` bucket. */
  imageUrl?: string;
  /** Public URLs of the product photos, main photo first (empty = swatch only). */
  gallery: string[];
  /** Units left per size; null (or a missing size) means not tracked. */
  stock: StockMap;
  /** Average of approved reviews; null when there are none. */
  rating: RatingSummary | null;
  /** Weight of one unit in grams; null/absent = unknown (the flat shipping fee applies). */
  weightGrams?: number | null;
  featured?: boolean;
  /** When the product was added (ISO timestamp); drives "New In". */
  createdAt: string;
};


// Prices are Sri Lankan rupees stored in cents. Intl's LKR format prints
// "LKR 850.00", so the "Rs" prefix is added by hand around a plain number.
const amountFormatter = new Intl.NumberFormat("en-LK", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Format a price given in cents as rupees, e.g. 85000 -> "Rs 850.00". */
export function formatPrice(cents: number): string {
  return `Rs ${amountFormatter.format(cents / 100)}`;
}

/** Like formatPrice but drops ".00" for whole rupees, e.g. 500000 -> "Rs 5,000". */
export function formatPriceWhole(cents: number): string {
  return formatPrice(cents).replace(/.00$/, "");
}


/** The price actually charged: the sale price when on sale, else the list price. */
export function effectivePrice(product: Pick<Product, "price" | "salePrice">): number {
  return product.salePrice ?? product.price;
}

/** Whole-percent discount for a sale item, e.g. 25 — or null if not on sale. */
export function discountPercent(product: Product): number | null {
  if (product.salePrice == null) return null;
  return Math.round((1 - product.salePrice / product.price) * 100);
}

/** The product fields the shell (search, cart drawer) needs in the browser. */
export type ShellProduct = Pick<
  Product,
  | "id"
  | "name"
  | "price"
  | "salePrice"
  | "imageUrl"
  | "swatch"
  | "category"
  | "categoryName"
  | "sizes"
  | "stock"
  | "description"
  | "featured"
  | "createdAt"
>;

export function toShellProduct(p: Product): ShellProduct {
  return {
    id: p.id,
    name: p.name,
    price: p.price,
    salePrice: p.salePrice,
    imageUrl: p.imageUrl,
    swatch: p.swatch,
    category: p.category,
    categoryName: p.categoryName,
    sizes: p.sizes,
    stock: p.stock,
    description: p.description,
    featured: p.featured,
    createdAt: p.createdAt,
  };
}

/** A product with its price under the running promotions (see lib/promotions.ts). */
export type PricedProduct = Product & { pricing: import("./promotions").ItemPricing };
