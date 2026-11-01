// Product types and pure helpers. Safe to import from client components —
// the data itself lives in Supabase and is fetched via `@/lib/catalog`.

export type Category = "Tops" | "Bottoms" | "Outerwear" | "Accessories";

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
  category: Category;
  description: string;
  sizes: string[];
  spec: Spec;
  /** Two hex colors for the placeholder gradient shown behind the photo. */
  swatch: [string, string];
  /** Public URL of the product photo in the `product-images` bucket. */
  imageUrl?: string;
  featured?: boolean;
};

export const CATEGORIES: Category[] = [
  "Tops",
  "Bottoms",
  "Outerwear",
  "Accessories",
];

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

/** Orders at or above this subtotal (in cents) ship free. */
export const FREE_SHIPPING_THRESHOLD = 500000; // Rs 5,000
/** Flat shipping charge (in cents) below the threshold. */
export const SHIPPING_FLAT = 35000; // Rs 350

/** The price actually charged: the sale price when on sale, else the list price. */
export function effectivePrice(product: Product): number {
  return product.salePrice ?? product.price;
}

/** Whole-percent discount for a sale item, e.g. 25 — or null if not on sale. */
export function discountPercent(product: Product): number | null {
  if (product.salePrice == null) return null;
  return Math.round((1 - product.salePrice / product.price) * 100);
}
