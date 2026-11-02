// Promotions engine: which promotions are running, and what each product
// costs under them. Pure and client-safe — the server prices cards and pages
// with it, and the cart drawer and /cart use the same functions (see
// lib/cart-summary.ts) with the promotion list the server rendered.
import { resolveCategoryParam } from "./category-form";
import { effectivePrice, type Category, type Product } from "./products";

export type RuleKind = "free_shipping" | "percent_off" | "amount_off_item" | "amount_off_order";
export type RuleScope = "all" | "categories" | "products";

export type PromotionRule = {
  kind: RuleKind;
  /** Percent (1–90) for percent_off, cents for the amount_* kinds, 0 for free_shipping. */
  value: number;
  scope: RuleScope;
  categorySlugs: string[];
  productIds: string[];
  /** Cents; the rule applies once the scope's items reach this (0 = always). */
  minSubtotal: number;
};

export type PromotionBanner =
  | { mode: "none" }
  | {
      mode: "template";
      headlineSi: string;
      headlineEn: string;
      subtextSi: string;
      subtextEn: string;
      buttonSi: string;
      buttonEn: string;
      colorFrom: string;
      colorTo: string;
      textColor: string;
      imageUrl: string | null;
    }
  | { mode: "image"; imageUrl: string; altSi: string; altEn: string };

export type Promotion = {
  id: string;
  slug: string;
  nameSi: string;
  nameEn: string;
  /** ISO timestamps. */
  startsAt: string;
  endsAt: string | null;
  active: boolean;
  sortOrder: number;
  banner: PromotionBanner;
  rules: PromotionRule[];
};

/** A rule with a minimum that applies to a product once the cart qualifies. */
export type ConditionalOffer = { promotion: Promotion; rule: PromotionRule };

export type ItemPricing = {
  /** What one unit costs: the best of list price, sale price and promotions. */
  price: number;
  /** The list price, when `price` is lower. */
  compareAt: number | null;
  /** The promotion that set `price`, if it wasn't the list or sale price. */
  promotion: Promotion | null;
  discountPercent: number | null;
  conditional: ConditionalOffer[];
  /** A running promotion that ships this product free with no minimum. */
  freeShipping: Promotion | null;
};

type PricedFields = Pick<Product, "id" | "category" | "price" | "salePrice">;

export function isRunning(promotion: Promotion, now: Date): boolean {
  return promotionStatus(promotion, now) === "running";
}

export function promotionStatus(
  promotion: Promotion,
  now: Date,
): "running" | "scheduled" | "ended" | "off" {
  if (!promotion.active) return "off";
  const t = now.getTime();
  if (t < Date.parse(promotion.startsAt)) return "scheduled";
  if (promotion.endsAt && t >= Date.parse(promotion.endsAt)) return "ended";
  return "running";
}

export function ruleMatches(
  rule: PromotionRule,
  product: Pick<Product, "id" | "category">,
  categories: Category[],
): boolean {
  switch (rule.scope) {
    case "all":
      return true;
    case "products":
      return rule.productIds.includes(product.id);
    case "categories": {
      const slug = resolveCategoryParam(product.category, categories)?.slug;
      return slug != null && rule.categorySlugs.includes(slug);
    }
  }
}

/** A unit price after one item rule; never below 0. */
export function applyItemRule(base: number, rule: PromotionRule): number {
  if (rule.kind === "percent_off") return Math.max(0, Math.round((base * (100 - rule.value)) / 100));
  if (rule.kind === "amount_off_item") return Math.max(0, base - rule.value);
  return base;
}

export function isItemRule(rule: PromotionRule): boolean {
  return rule.kind === "percent_off" || rule.kind === "amount_off_item";
}

export function itemPricing(
  product: PricedFields,
  promotions: Promotion[],
  categories: Category[],
): ItemPricing {
  // Promotions discount the list price; the sale price competes as its own option.
  let price = effectivePrice(product);
  let promotion: Promotion | null = null;
  const conditional: ConditionalOffer[] = [];
  let freeShipping: Promotion | null = null;

  for (const promo of promotions) {
    for (const rule of promo.rules) {
      if (!ruleMatches(rule, product, categories)) continue;
      if (rule.kind === "free_shipping") {
        if (rule.minSubtotal === 0 && !freeShipping) freeShipping = promo;
        continue;
      }
      if (!isItemRule(rule)) continue;
      if (rule.minSubtotal > 0) {
        conditional.push({ promotion: promo, rule });
        continue;
      }
      const candidate = applyItemRule(product.price, rule);
      if (candidate < price) {
        price = candidate;
        promotion = promo;
      }
    }
  }

  const compareAt = price < product.price ? product.price : null;
  return {
    price,
    compareAt,
    promotion,
    discountPercent: compareAt ? Math.round((1 - price / product.price) * 100) : null,
    conditional,
    freeShipping,
  };
}

/** The lowest "free shipping over Rs X" that applies to the whole shop, if any. */
export function freeShippingThreshold(promotions: Promotion[]): number | null {
  let lowest: number | null = null;
  for (const promo of promotions) {
    for (const rule of promo.rules) {
      if (rule.kind !== "free_shipping" || rule.scope !== "all") continue;
      if (lowest === null || rule.minSubtotal < lowest) lowest = rule.minSubtotal;
    }
  }
  return lowest;
}
