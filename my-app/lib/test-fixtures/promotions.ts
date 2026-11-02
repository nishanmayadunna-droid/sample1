// Shared fixtures for the promotions and cart-summary tests.
import type { Promotion, PromotionRule } from "../promotions";
import type { Category } from "../products";

export const tee = { id: "tee", category: "tops", price: 1000000 };
export const shirt = { id: "shirt", category: "tops", price: 2000000, salePrice: 1500000 };
export const old = { id: "old", category: "Tops", price: 1000000 };
export const chino = { id: "chino", category: "bottoms", price: 1000000 };

export const categories: Category[] = [
  { slug: "tops", name: "Tops", swatch: ["#000", "#111"], sortOrder: 1 },
  { slug: "bottoms", name: "Bottoms", swatch: ["#000", "#111"], sortOrder: 2 },
];

export function rule(over: Partial<PromotionRule> = {}): PromotionRule {
  return {
    kind: "percent_off",
    value: 20,
    scope: "all",
    categorySlugs: [],
    productIds: [],
    minSubtotal: 0,
    ...over,
  };
}

export function promo(over: Partial<Promotion> = {}): Promotion {
  return {
    id: "p1",
    slug: "halloween",
    nameSi: "හැලොවීන්",
    nameEn: "Halloween",
    startsAt: "2026-10-25T00:00:00.000Z",
    endsAt: null,
    active: true,
    sortOrder: 0,
    banner: { mode: "none" },
    rules: [rule()],
    ...over,
  };
}
