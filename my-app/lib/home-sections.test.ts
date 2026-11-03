import { describe, expect, it } from "vitest";
import { dealProducts, quickAddMode, savedAmount, shelfProducts, soonestDealEnd } from "./home-sections";
import { withPricing } from "./promotions";
import type { Product } from "./products";
import { categories, promo, rule } from "./test-fixtures/promotions";

function product(id: string, over: Partial<Product> = {}): Product {
  return {
    id,
    name: id,
    price: 1000000,
    category: "tops",
    categoryName: "Tops",
    description: "",
    sizes: ["M"],
    spec: { material: "", construction: "", origin: "" },
    swatch: ["#000", "#111"],
    gallery: [],
    stock: null,
    rating: null,
    createdAt: "2026-10-01T00:00:00Z",
    ...over,
  };
}

const catalog = [
  product("plain"),
  product("sale25", { salePrice: 750000 }),
  product("sale50", { salePrice: 500000, category: "bottoms", categoryName: "Bottoms" }),
  product("old-name", { category: "Tops" }),
  product("sale25b", { salePrice: 750000 }),
];
const ids = (list: { id: string }[]) => list.map((p) => p.id);

describe("dealProducts", () => {
  it("keeps discounted products, biggest discount first, ties in catalog order", () => {
    const priced = withPricing(catalog, [], categories);
    expect(ids(dealProducts(priced))).toEqual(["sale50", "sale25", "sale25b"]);
    expect(ids(dealProducts(priced, 2))).toEqual(["sale50", "sale25"]);
  });
});

describe("soonestDealEnd", () => {
  it("has no end for sale-price-only deals", () => {
    const priced = withPricing(catalog, [], categories);
    expect(soonestDealEnd(dealProducts(priced), [])).toBeNull();
  });

  it("is the earliest end among promotions that priced a shown deal", () => {
    const early = promo({
      id: "early",
      endsAt: "2026-11-05T00:00:00.000Z",
      rules: [rule({ value: 60, scope: "products", productIds: ["plain"] })],
    });
    const late = promo({
      id: "late",
      endsAt: "2026-11-09T00:00:00.000Z",
      rules: [rule({ value: 70, scope: "products", productIds: ["old-name"] })],
    });
    const open = promo({ id: "open", rules: [rule({ value: 80, scope: "products", productIds: ["sale25b"] })] });
    const promotions = [late, early, open];
    const deals = dealProducts(withPricing(catalog, promotions, categories));
    expect(soonestDealEnd(deals, promotions)).toBe("2026-11-05T00:00:00.000Z");
  });
});

describe("shelfProducts", () => {
  const priced = withPricing(catalog, [], categories);

  it("shows everything for the all tab, cut to the limit", () => {
    expect(shelfProducts(priced, null, categories, 3)).toEqual({ items: priced.slice(0, 3), more: true });
  });

  it("includes products stored under an old category name", () => {
    const { items, more } = shelfProducts(priced, categories[0], categories);
    expect(ids(items)).toEqual(["plain", "sale25", "old-name", "sale25b"]);
    expect(more).toBe(false);
  });
});

describe("savedAmount", () => {
  it("is the difference when discounted, else null", () => {
    const base = { promotion: null, discountPercent: 20, conditional: [], freeShipping: null };
    expect(savedAmount({ ...base, price: 800000, compareAt: 1000000 })).toBe(200000);
    expect(savedAmount({ ...base, price: 800000, compareAt: null })).toBeNull();
  });
});

describe("quickAddMode", () => {
  it("adds directly for one size, asks for several, hides for none", () => {
    expect([quickAddMode([]), quickAddMode(["One size"]), quickAddMode(["S", "M"])]).toEqual([
      "none",
      "single",
      "pick",
    ]);
  });
});
