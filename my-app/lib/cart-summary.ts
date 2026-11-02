// Cart money in one place: the drawer and /cart both use it, so they always
// agree. Prices come from the promotions engine with the promotion list the
// server rendered. Pure and client-safe.
import type { CartLine } from "./cart-rules";
import {
  applyItemRule,
  isItemRule,
  ruleMatches,
  type Promotion,
  type PromotionRule,
  type RuleKind,
} from "./promotions";
import { effectivePrice, type Category, type Product } from "./products";

type CartProduct = Pick<Product, "id" | "category" | "price" | "salePrice">;

export type CartLineSummary<P> = {
  line: CartLine;
  product: P;
  /** What one unit costs after promotions. */
  unitPrice: number;
  /** The list price, when `unitPrice` is lower. */
  compareAt: number | null;
  /** The promotion that set `unitPrice`, if any. */
  promotion: Promotion | null;
};

/** How far the cart is from a rule it doesn't meet yet. */
export type Nudge = { promotion: Promotion; kind: RuleKind; missing: number };

export type CartSummary<P> = {
  /** Lines whose product still exists, priced. */
  items: CartLineSummary<P>[];
  itemCount: number;
  subtotal: number;
  orderDiscount: { amount: number; promotion: Promotion } | null;
  shipping: number;
  /** The promotion that made shipping free, if it is. */
  freeShippingBy: Promotion | null;
  total: number;
  /** Unmet rules, closest first. */
  nudges: Nudge[];
};

export function summarizeCart<P extends CartProduct>(
  lines: CartLine[],
  products: P[],
  promotions: Promotion[],
  shippingFee: number,
  categories: Category[],
): CartSummary<P> {
  const byId = new Map(products.map((p) => [p.id, p]));
  // Lines for products no longer in the catalog are skipped, not charged.
  const present = lines.flatMap((line) => {
    const product = byId.get(line.id);
    return product ? [{ line, product }] : [];
  });

  // Minimums are measured on list/sale prices, before any promotion, so a
  // discount can never undo the condition that granted it.
  function scopeTotal(rule: PromotionRule): { matched: number; total: number } {
    let matched = 0;
    let total = 0;
    for (const { line, product } of present) {
      if (!ruleMatches(rule, product, categories)) continue;
      matched += 1;
      total += effectivePrice(product) * line.quantity;
    }
    return { matched, total };
  }
  const qualifies = (rule: PromotionRule) => {
    const { matched, total } = scopeTotal(rule);
    return matched > 0 && total >= rule.minSubtotal;
  };

  const items = present.map(({ line, product }) => {
    let unitPrice = effectivePrice(product);
    let promotion: Promotion | null = null;
    for (const promo of promotions) {
      for (const rule of promo.rules) {
        if (!isItemRule(rule) || !ruleMatches(rule, product, categories)) continue;
        if (rule.minSubtotal > 0 && !qualifies(rule)) continue;
        const candidate = applyItemRule(product.price, rule);
        if (candidate < unitPrice) {
          unitPrice = candidate;
          promotion = promo;
        }
      }
    }
    const compareAt = unitPrice < product.price ? product.price : null;
    return { line, product, unitPrice, compareAt, promotion };
  });

  const itemCount = items.reduce((sum, { line }) => sum + line.quantity, 0);
  const subtotal = items.reduce((sum, { line, unitPrice }) => sum + unitPrice * line.quantity, 0);

  let orderDiscount: CartSummary<P>["orderDiscount"] = null;
  let freeShippingBy: Promotion | null = null;
  const nudges: Nudge[] = [];
  for (const promo of promotions) {
    for (const rule of promo.rules) {
      const { matched, total } = scopeTotal(rule);
      if (matched === 0) continue;
      if (total < rule.minSubtotal) {
        nudges.push({ promotion: promo, kind: rule.kind, missing: rule.minSubtotal - total });
        continue;
      }
      if (rule.kind === "amount_off_order") {
        const amount = Math.min(rule.value, subtotal);
        if (!orderDiscount || amount > orderDiscount.amount) orderDiscount = { amount, promotion: promo };
      } else if (rule.kind === "free_shipping" && !freeShippingBy) {
        freeShippingBy = promo;
      }
    }
  }

  const shipping = items.length === 0 || freeShippingBy ? 0 : shippingFee;
  return {
    items,
    itemCount,
    subtotal,
    orderDiscount,
    shipping,
    freeShippingBy,
    total: subtotal - (orderDiscount?.amount ?? 0) + shipping,
    // A free-shipping nudge means nothing once shipping is already free.
    nudges: nudges
      .filter((n) => !(n.kind === "free_shipping" && freeShippingBy))
      .sort((a, b) => a.missing - b.missing),
  };
}

/**
 * The header badge: items whose product still exists, so a hidden or deleted
 * product isn't counted. With no product list (the shell couldn't load it)
 * every line counts, rather than showing an empty cart.
 */
export function cartBadgeCount(
  lines: CartLine[],
  products: Pick<Product, "id">[],
): number {
  const known = new Set(products.map((p) => p.id));
  return lines
    .filter((line) => products.length === 0 || known.has(line.id))
    .reduce((sum, line) => sum + line.quantity, 0);
}
