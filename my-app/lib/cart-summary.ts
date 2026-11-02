// Cart money in one place: the drawer and /cart both use it, so they always
// agree (part P will apply promotion rules here). Pure and client-safe.
import type { CartLine } from "./cart-rules";
import {
  effectivePrice,
  FREE_SHIPPING_THRESHOLD,
  SHIPPING_FLAT,
  type Product,
} from "./products";

export type CartSummary<P> = {
  /** Lines whose product still exists, with that product. */
  items: { line: CartLine; product: P }[];
  itemCount: number;
  subtotal: number;
  shipping: number;
  total: number;
  /** How much more (in cents) until shipping is free; 0 once it is. */
  toFreeShipping: number;
};

export function summarizeCart<P extends Pick<Product, "id" | "price" | "salePrice">>(
  lines: CartLine[],
  products: P[],
): CartSummary<P> {
  const byId = new Map(products.map((p) => [p.id, p]));
  // Lines for products no longer in the catalog are skipped, not charged.
  const items = lines.flatMap((line) => {
    const product = byId.get(line.id);
    return product ? [{ line, product }] : [];
  });
  const itemCount = items.reduce((sum, { line }) => sum + line.quantity, 0);
  const subtotal = items.reduce(
    (sum, { line, product }) => sum + effectivePrice(product) * line.quantity,
    0,
  );
  const shipping = items.length === 0 || subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FLAT;
  return {
    items,
    itemCount,
    subtotal,
    shipping,
    total: subtotal + shipping,
    toFreeShipping: Math.max(0, FREE_SHIPPING_THRESHOLD - subtotal),
  };
}
