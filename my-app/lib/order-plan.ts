// Pure server-side planning of an order: the browser only says which lines it
// holds and what total it showed; every price and limit is recomputed here from
// the fresh catalog, so a stale or tampered cart can never set a price.
import { sanitizeCartLines } from "./cart-rules";
import { summarizeCart } from "./cart-summary";
import { orderTotals, type OrderTotals } from "./orders";
import { pointsToEarn, pointsToUse, type PointsSettings } from "./points";
import type { Category, Product } from "./products";
import type { Promotion } from "./promotions";
import { sizeStock } from "./stock";

export type PlannedItem = {
  productId: string;
  productName: string;
  size: string;
  quantity: number;
  /** What one unit costs after promotions, in cents. */
  unitPrice: number;
  /** The list price, when `unitPrice` is lower. */
  compareAt: number | null;
};

export type OrderPlan =
  | { ok: true; items: PlannedItem[]; totals: OrderTotals; points: { used: number; toEarn: number } }
  | {
      ok: false;
      error: "empty" | "unknown_product" | "out_of_stock" | "price_changed";
      productId?: string;
      size?: string;
      left?: number;
      total?: number;
    };

export function planOrder(input: {
  /** Untrusted cart lines from the browser. */
  lines: unknown;
  /** The products the shop sells now (hidden ones are not in the list). */
  products: Product[];
  promotions: Promotion[];
  shippingFee: number;
  categories: Category[];
  /** The total the shopper saw, in cents. */
  expectedTotal: number;
  /** How many points the shopper asked to use (untrusted; clamped here). */
  pointsRequested: number;
  /** The shopper's points balance, read on the server. */
  pointsBalance: number;
  pointsSettings: PointsSettings;
}): OrderPlan {
  const lines = sanitizeCartLines(input.lines);
  if (lines.length === 0) return { ok: false, error: "empty" };

  const byId = new Map(input.products.map((product) => [product.id, product]));
  for (const line of lines) {
    const product = byId.get(line.id);
    if (!product || !product.sizes.includes(line.size)) {
      return { ok: false, error: "unknown_product", productId: line.id };
    }
    const { tracked, quantity } = sizeStock(product, line.size);
    if (tracked && line.quantity > quantity) {
      return { ok: false, error: "out_of_stock", productId: line.id, size: line.size, left: Math.max(quantity, 0) };
    }
  }

  const summary = summarizeCart(lines, input.products, input.promotions, input.shippingFee, input.categories);
  // Points pay for goods only (after promotions, before shipping).
  const goods = summary.subtotal - (summary.orderDiscount?.amount ?? 0);
  const used = pointsToUse(input.pointsRequested, input.pointsBalance, goods, input.pointsSettings);
  const totals = orderTotals(summary, used.discount);
  if (totals.total !== input.expectedTotal) {
    return { ok: false, error: "price_changed", total: totals.total };
  }

  return {
    ok: true,
    items: summary.items.map(({ line, product, unitPrice, compareAt }) => ({
      productId: product.id,
      productName: product.name,
      size: line.size,
      quantity: line.quantity,
      unitPrice,
      compareAt,
    })),
    totals,
    points: {
      used: used.points,
      toEarn: pointsToEarn(goods - used.discount, input.pointsSettings),
    },
  };
}
