import { describe, expect, it } from "vitest";
import { planOrder } from "./order-plan";
import { summarizeCart } from "./cart-summary";
import type { Product } from "./products";
import type { Promotion } from "./promotions";
import type { PointsSettings } from "./points";
import { categories, promo, rule } from "./test-fixtures/promotions";

function product(over: Partial<Product> = {}): Product {
  return {
    id: "tee",
    name: "Tee",
    price: 1000000,
    category: "tops",
    categoryName: "Tops",
    description: "d",
    sizes: ["M", "L"],
    spec: { material: "m", construction: "c", origin: "o" },
    swatch: ["#000000", "#111111"],
    gallery: [],
    stock: null,
    rating: null,
    createdAt: "2026-01-01T00:00:00Z",
    ...over,
  };
}

const FEE = 35000;
const pointsOff: PointsSettings = { enabled: false, earnPer: 10000, pointValue: 100, maxPercent: 50 };
const pointsOn: PointsSettings = { ...pointsOff, enabled: true };
const base = {
  products: [product()],
  promotions: [] as Promotion[],
  shippingFee: FEE,
  categories,
  pointsRequested: 0,
  pointsBalance: 0,
  pointsSettings: pointsOff,
};

function totalFor(lines: { id: string; size: string; quantity: number }[], promotions = base.promotions) {
  return summarizeCart(lines, base.products, promotions, FEE, categories).total;
}

describe("planOrder", () => {
  it("rejects empty lines", () => {
    expect(planOrder({ ...base, lines: [], expectedTotal: 0 })).toEqual({ ok: false, error: "empty" });
    expect(planOrder({ ...base, lines: "nope", expectedTotal: 0 })).toEqual({ ok: false, error: "empty" });
  });

  it("rejects a product the shop does not sell (hidden or deleted)", () => {
    const result = planOrder({ ...base, lines: [{ id: "ghost", size: "M", quantity: 1 }], expectedTotal: 1 });
    expect(result).toEqual({ ok: false, error: "unknown_product", productId: "ghost" });
  });

  it("rejects a size the product does not offer", () => {
    const result = planOrder({ ...base, lines: [{ id: "tee", size: "XXL", quantity: 1 }], expectedTotal: 1 });
    expect(result).toMatchObject({ ok: false, error: "unknown_product", productId: "tee" });
  });

  it("rejects a quantity above tracked stock and reports what is left", () => {
    const products = [product({ stock: { M: 1 } })];
    const result = planOrder({
      ...base,
      products,
      lines: [{ id: "tee", size: "M", quantity: 2 }],
      expectedTotal: 1,
    });
    expect(result).toEqual({ ok: false, error: "out_of_stock", productId: "tee", size: "M", left: 1 });
  });

  it("does not limit untracked sizes", () => {
    const lines = [{ id: "tee", size: "L", quantity: 50 }];
    expect(planOrder({ ...base, products: [product({ stock: { M: 1 } })], lines, expectedTotal: totalFor(lines) }).ok).toBe(true);
  });

  it("prices the order with the promotions and returns the planned items", () => {
    const promotions = [promo({ rules: [rule({ kind: "percent_off", value: 20 })] })];
    const lines = [{ id: "tee", size: "M", quantity: 2 }];
    const result = planOrder({ ...base, promotions, lines, expectedTotal: totalFor(lines, promotions) });
    expect(result).toEqual({
      ok: true,
      items: [{ productId: "tee", productName: "Tee", size: "M", quantity: 2, unitPrice: 800000, compareAt: 1000000 }],
      totals: { subtotal: 1600000, discount: 0, pointsDiscount: 0, shipping: FEE, total: 1600000 + FEE },
      points: { used: 0, toEarn: 0 },
    });
  });

  it("returns price_changed with the new total when the expected total is stale", () => {
    const lines = [{ id: "tee", size: "M", quantity: 1 }];
    const result = planOrder({ ...base, lines, expectedTotal: 12345 });
    expect(result).toEqual({ ok: false, error: "price_changed", total: totalFor(lines) });
  });

  it("collapses duplicate lines before pricing", () => {
    const lines = [
      { id: "tee", size: "M", quantity: 1 },
      { id: "tee", size: "M", quantity: 3 },
    ];
    const result = planOrder({ ...base, lines, expectedTotal: totalFor([{ id: "tee", size: "M", quantity: 3 }]) });
    expect(result.ok && result.items).toHaveLength(1);
  });

  describe("points", () => {
    const lines = [{ id: "tee", size: "M", quantity: 1 }]; // Rs 10,000 goods, Rs 350 shipping
    const withPoints = { ...base, lines, pointsSettings: pointsOn, pointsBalance: 500 };

    it("takes the points discount off the total and earns on what is left of the goods", () => {
      const expectedTotal = totalFor(lines) - 10000; // 100 points = Rs 100
      const result = planOrder({ ...withPoints, pointsRequested: 100, expectedTotal });
      expect(result).toMatchObject({
        ok: true,
        totals: { subtotal: 1000000, pointsDiscount: 10000, total: expectedTotal },
        // Goods Rs 10,000 - Rs 100 = Rs 9,900 -> 99 points; shipping earns nothing.
        points: { used: 100, toEarn: 99 },
      });
    });

    it("clamps points to the balance and the percent cap", () => {
      const clampedBalance = planOrder({ ...withPoints, pointsBalance: 40, pointsRequested: 400, expectedTotal: totalFor(lines) - 4000 });
      expect(clampedBalance).toMatchObject({ ok: true, points: { used: 40 } });
      const clampedCap = planOrder({ ...withPoints, pointsBalance: 99999, pointsRequested: 99999, expectedTotal: totalFor(lines) - 500000 });
      expect(clampedCap).toMatchObject({ ok: true, points: { used: 5000 } });
    });

    it("returns price_changed when the form's total ignored the points", () => {
      const result = planOrder({ ...withPoints, pointsRequested: 100, expectedTotal: totalFor(lines) });
      expect(result).toEqual({ ok: false, error: "price_changed", total: totalFor(lines) - 10000 });
    });

    it("changes nothing when points are off", () => {
      const result = planOrder({ ...base, lines, pointsRequested: 100, pointsBalance: 500, expectedTotal: totalFor(lines) });
      expect(result).toMatchObject({ ok: true, points: { used: 0, toEarn: 0 } });
    });
  });
});
