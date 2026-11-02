import { describe, expect, it } from "vitest";
import { summarizeCart } from "./cart-summary";
import { FREE_SHIPPING_THRESHOLD, SHIPPING_FLAT } from "./products";

const tee = { id: "tee", price: 100000 };
const shirt = { id: "shirt", price: 200000, salePrice: 150000 };
const products = [tee, shirt];

describe("summarizeCart", () => {
  it("charges the sale price times quantity", () => {
    const s = summarizeCart(
      [
        { id: "tee", size: "M", quantity: 2 },
        { id: "shirt", size: "L", quantity: 1 },
      ],
      products,
    );
    expect(s.subtotal).toBe(350000);
    expect(s.itemCount).toBe(3);
  });

  it("ships free exactly at the threshold", () => {
    const exact = { id: "exact", price: FREE_SHIPPING_THRESHOLD };
    const s = summarizeCart([{ id: "exact", size: "M", quantity: 1 }], [exact]);
    expect([s.shipping, s.toFreeShipping, s.total]).toEqual([0, 0, FREE_SHIPPING_THRESHOLD]);
  });

  it("charges flat shipping one cent below the threshold", () => {
    const below = { id: "below", price: FREE_SHIPPING_THRESHOLD - 1 };
    const s = summarizeCart([{ id: "below", size: "M", quantity: 1 }], [below]);
    expect([s.shipping, s.toFreeShipping]).toEqual([SHIPPING_FLAT, 1]);
    expect(s.total).toBe(FREE_SHIPPING_THRESHOLD - 1 + SHIPPING_FLAT);
  });

  it("drops lines for products that are gone", () => {
    const s = summarizeCart(
      [
        { id: "tee", size: "M", quantity: 1 },
        { id: "deleted", size: "M", quantity: 5 },
      ],
      products,
    );
    expect(s.items.map((i) => i.product.id)).toEqual(["tee"]);
    expect([s.itemCount, s.subtotal]).toEqual([1, 100000]);
  });

  it("is all zero for an empty cart", () => {
    const s = summarizeCart([], products);
    expect([s.itemCount, s.subtotal, s.shipping, s.total]).toEqual([0, 0, 0, 0]);
  });
});
