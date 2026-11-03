// What the home page and product cards show: deals, the countdown end, the
// category shelf and quick-add behaviour. Pure and client-safe.
import { productsInCategory } from "./category-form";
import type { ItemPricing, Promotion } from "./promotions";
import type { Category, PricedProduct } from "./products";

/** Discounted products (sale or promotion), biggest discount first. */
export function dealProducts<T extends PricedProduct>(products: T[], limit = 15): T[] {
  return products
    .filter((p) => p.pricing.compareAt != null)
    // Array sort is stable, so equal discounts keep catalog order.
    .sort((a, b) => (b.pricing.discountPercent ?? 0) - (a.pricing.discountPercent ?? 0))
    .slice(0, limit);
}

/**
 * When the soonest-ending promotion behind a shown deal ends, for a real
 * countdown; null when no shown deal comes from a promotion with an end.
 */
export function soonestDealEnd(deals: PricedProduct[], promotions: Promotion[]): string | null {
  const ids = new Set(deals.flatMap((d) => (d.pricing.promotion ? [d.pricing.promotion.id] : [])));
  let soonest: string | null = null;
  for (const promotion of promotions) {
    if (!ids.has(promotion.id) || !promotion.endsAt) continue;
    if (soonest === null || Date.parse(promotion.endsAt) < Date.parse(soonest)) soonest = promotion.endsAt;
  }
  return soonest;
}

/** One tab of the home category shelf: all products, or one category's. */
export function shelfProducts<T extends PricedProduct>(
  products: T[],
  category: Category | null,
  categories: Category[],
  limit = 15,
): { items: T[]; more: boolean } {
  const all = category ? productsInCategory(products, category, categories) : products;
  return { items: all.slice(0, limit), more: all.length > limit };
}

/** How much the shopper saves on one unit, when discounted. */
export function savedAmount(pricing: ItemPricing): number | null {
  return pricing.compareAt != null ? pricing.compareAt - pricing.price : null;
}

/** The card's 🛒 button: add straight away, ask for a size first, or not shown. */
export function quickAddMode(sizes: string[]): "none" | "single" | "pick" {
  if (sizes.length === 0) return "none";
  return sizes.length === 1 ? "single" : "pick";
}
