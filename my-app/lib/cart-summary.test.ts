import { describe, expect, it } from "vitest";
import { cartBadgeCount, summarizeCart } from "./cart-summary";
import { categories, chino, promo, rule, shirt, tee } from "./test-fixtures/promotions";

const FEE = 35000;
const freeOver5000 = promo({
  id: "free",
  slug: "free-shipping",
  rules: [rule({ kind: "free_shipping", value: 0, minSubtotal: 500000 })],
});
const products = [tee, shirt, chino];
const line = (id: string, quantity = 1) => ({ id, size: "M", quantity });

describe("summarizeCart", () => {
  it("charges the sale price times quantity", () => {
    const s = summarizeCart([line("tee", 2), line("shirt")], products, [freeOver5000], FEE, categories);
    expect(s.subtotal).toBe(3500000);
    expect(s.itemCount).toBe(3);
  });

  it("ships free exactly at the threshold", () => {
    const exact = { id: "exact", category: "tops", price: 500000 };
    const s = summarizeCart([line("exact")], [exact], [freeOver5000], FEE, categories);
    expect([s.shipping, s.total, s.freeShippingBy?.slug]).toEqual([0, 500000, "free-shipping"]);
    expect(s.nudges).toEqual([]);
  });

  it("charges the fee one cent below the threshold, with a nudge", () => {
    const below = { id: "below", category: "tops", price: 499999 };
    const s = summarizeCart([line("below")], [below], [freeOver5000], FEE, categories);
    expect([s.shipping, s.total]).toEqual([FEE, 499999 + FEE]);
    expect(s.nudges).toEqual([{ promotion: freeOver5000, kind: "free_shipping", missing: 1 }]);
  });

  it("drops lines for products that are gone", () => {
    const s = summarizeCart([line("tee"), line("deleted", 5)], products, [], FEE, categories);
    expect(s.items.map((i) => i.product.id)).toEqual(["tee"]);
    expect([s.itemCount, s.subtotal]).toEqual([1, 1000000]);
  });

  it("is all zero for an empty cart", () => {
    const s = summarizeCart([], products, [freeOver5000], FEE, categories);
    expect([s.itemCount, s.subtotal, s.shipping, s.total]).toEqual([0, 0, 0, 0]);
  });

  it("measures a minimum before discounts, so the discount keeps applying", () => {
    const half = promo({
      rules: [rule({ value: 50, scope: "categories", categorySlugs: ["tops"], minSubtotal: 1000000 })],
    });
    const s = summarizeCart([line("tee")], products, [half], FEE, categories);
    expect([s.items[0].unitPrice, s.items[0].promotion?.slug, s.subtotal]).toEqual([500000, "halloween", 500000]);
  });

  it("applies the single best qualifying order discount", () => {
    const orderRules = promo({
      rules: [
        rule({ kind: "amount_off_order", value: 300000 }),
        rule({ kind: "amount_off_order", value: 500000, minSubtotal: 2000000 }),
      ],
    });
    const small = summarizeCart([line("shirt")], products, [orderRules], FEE, categories);
    expect(small.orderDiscount?.amount).toBe(300000);
    const big = summarizeCart([line("tee"), line("shirt")], products, [orderRules], FEE, categories);
    expect(big.orderDiscount?.amount).toBe(500000);
  });

  it("caps an order discount at the subtotal", () => {
    const huge = promo({ rules: [rule({ kind: "amount_off_order", value: 5000000 })] });
    const s = summarizeCart([line("tee")], products, [huge], FEE, categories);
    expect([s.orderDiscount?.amount, s.total]).toEqual([1000000, FEE]);
  });

  it("ships the whole order free when one item qualifies", () => {
    const bottomsShip = promo({
      rules: [rule({ kind: "free_shipping", value: 0, scope: "categories", categorySlugs: ["bottoms"] })],
    });
    const mixed = summarizeCart([line("tee"), line("chino")], products, [bottomsShip], FEE, categories);
    expect([mixed.shipping, mixed.freeShippingBy?.slug]).toEqual([0, "halloween"]);
    const teeOnly = summarizeCart([line("tee")], products, [bottomsShip], FEE, categories);
    expect(teeOnly.shipping).toBe(FEE);
  });

  it("nudges toward an unmet order discount whose scope is in the cart", () => {
    const order = promo({ rules: [rule({ kind: "amount_off_order", value: 50000, minSubtotal: 1200000 })] });
    const s = summarizeCart([line("tee")], products, [order], FEE, categories);
    expect(s.nudges).toEqual([{ promotion: order, kind: "amount_off_order", missing: 200000 }]);
  });
});

describe("cartBadgeCount", () => {
  it("counts only lines whose product still exists", () => {
    expect(cartBadgeCount([line("tee", 2), line("hidden", 3)], products)).toBe(2);
  });

  it("counts every line when the product list couldn't be loaded", () => {
    expect(cartBadgeCount([line("tee", 2)], [])).toBe(2);
  });
});
