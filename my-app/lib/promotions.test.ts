import { describe, expect, it } from "vitest";
import {
  freeShippingThreshold,
  isRunning,
  itemPricing,
  promotionStatus,
  ruleMatches,
  type PromotionRule,
} from "./promotions";
import { categories, chino, old, promo, rule, shirt, tee } from "./test-fixtures/promotions";

const now = new Date("2026-10-28T12:00:00.000Z");

describe("isRunning / promotionStatus", () => {
  it("runs from its start until (not including) its end", () => {
    expect(isRunning(promo({ startsAt: now.toISOString() }), now)).toBe(true);
    expect(isRunning(promo({ endsAt: now.toISOString() }), now)).toBe(false);
    expect(isRunning(promo(), now)).toBe(true);
    expect(isRunning(promo({ active: false }), now)).toBe(false);
  });

  it("names each state", () => {
    expect(promotionStatus(promo(), now)).toBe("running");
    expect(promotionStatus(promo({ startsAt: "2026-11-01T00:00:00.000Z" }), now)).toBe("scheduled");
    expect(promotionStatus(promo({ endsAt: "2026-10-27T00:00:00.000Z" }), now)).toBe("ended");
    expect(promotionStatus(promo({ active: false }), now)).toBe("off");
  });
});

describe("ruleMatches", () => {
  it("matches everything for scope all", () => {
    expect(ruleMatches(rule(), chino, categories)).toBe(true);
  });

  it("matches categories by slug or old name", () => {
    const r = rule({ scope: "categories", categorySlugs: ["tops"] });
    expect([tee, old, chino].map((p) => ruleMatches(r, p, categories))).toEqual([true, true, false]);
  });

  it("matches chosen products only", () => {
    const r = rule({ scope: "products", productIds: ["tee"] });
    expect([tee, shirt].map((p) => ruleMatches(r, p, categories))).toEqual([true, false]);
  });

  it("matches nothing for a deleted category or product", () => {
    expect(ruleMatches(rule({ scope: "categories", categorySlugs: ["gone"] }), tee, categories)).toBe(false);
    expect(ruleMatches(rule({ scope: "products", productIds: ["gone"] }), tee, categories)).toBe(false);
  });
});

describe("itemPricing", () => {
  const tops20 = promo({ rules: [rule({ scope: "categories", categorySlugs: ["tops"] })] });

  it("keeps a better sale price over a promotion", () => {
    const p = itemPricing(shirt, [tops20], categories);
    expect([p.price, p.promotion, p.compareAt]).toEqual([1500000, null, 2000000]);
  });

  it("applies the best matching item rule", () => {
    const p = itemPricing(tee, [tops20], categories);
    expect([p.price, p.promotion?.slug, p.discountPercent, p.compareAt]).toEqual([
      800000, "halloween", 20, 1000000,
    ]);
    const both = promo({ rules: [rule(), rule({ kind: "amount_off_item", value: 300000 })] });
    expect(itemPricing(tee, [both], categories).price).toBe(700000);
  });

  it("never goes below zero", () => {
    const big = promo({ rules: [rule({ kind: "amount_off_item", value: 5000000 })] });
    expect(itemPricing(tee, [big], categories).price).toBe(0);
  });

  it("rounds percentages to the cent", () => {
    const p33 = promo({ rules: [rule({ value: 33 })] });
    expect(itemPricing({ id: "x", category: "tops", price: 999 }, [p33], categories).price).toBe(669);
  });

  it("lists rules with a minimum as conditional, without pricing them", () => {
    const conditional = promo({ rules: [rule({ minSubtotal: 1000000 })] });
    const p = itemPricing(tee, [conditional], categories);
    expect(p.price).toBe(1000000);
    expect(p.compareAt).toBeNull();
    expect(p.conditional).toHaveLength(1);
  });

  it("flags free shipping from a matching rule with no minimum", () => {
    const ship = promo({ rules: [rule({ kind: "free_shipping", value: 0, scope: "products", productIds: ["tee"] })] });
    expect(itemPricing(tee, [ship], categories).freeShipping?.slug).toBe("halloween");
    expect(itemPricing(chino, [ship], categories).freeShipping).toBeNull();
  });
});

describe("freeShippingThreshold", () => {
  const ship = (min: number, over: Partial<PromotionRule> = {}) =>
    rule({ kind: "free_shipping", value: 0, minSubtotal: min, ...over });

  it("is the smallest scope-all minimum", () => {
    expect(freeShippingThreshold([promo({ rules: [ship(500000)] }), promo({ rules: [ship(300000)] })])).toBe(300000);
  });

  it("ignores category-scoped rules and is null without any", () => {
    expect(freeShippingThreshold([promo({ rules: [ship(100, { scope: "categories", categorySlugs: ["tops"] })] })])).toBeNull();
    expect(freeShippingThreshold([])).toBeNull();
  });
});
