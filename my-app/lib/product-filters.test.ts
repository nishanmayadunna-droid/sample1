import { describe, expect, it } from "vitest";
import { filterProducts, matchesQuery, parseView } from "./product-filters";
import type { Category, Product } from "./products";
import { withPricing, type Promotion } from "./promotions";
import { promo, rule } from "./test-fixtures/promotions";

const categories: Category[] = [
  { slug: "tops", name: "Tops", swatch: ["#000", "#111"], sortOrder: 1 },
  { slug: "bottoms", name: "Bottoms", swatch: ["#000", "#111"], sortOrder: 2 },
];

function product(over: Partial<Product> & { id: string }): Product {
  return {
    name: over.id,
    price: 10000,
    category: "tops",
    categoryName: "Tops",
    description: "",
    sizes: ["M"],
    spec: { material: "", construction: "", origin: "" },
    swatch: ["#000", "#111"],
    createdAt: "2026-10-01T00:00:00Z",
    ...over,
  };
}

const tee = product({
  id: "tee",
  name: "Essential Tee",
  description: "Soft jersey",
  featured: true,
  createdAt: "2026-10-03T00:00:00Z",
});
const shirt = product({
  id: "shirt",
  name: "Oxford Shirt",
  price: 10000,
  salePrice: 7500,
  createdAt: "2026-10-01T00:00:00Z",
});
const chino = product({
  id: "chino",
  name: "Stretch Chino",
  category: "Bottoms",
  categoryName: "Bottoms",
  price: 10000,
  salePrice: 5000,
  createdAt: "2026-10-04T00:00:00Z",
});
const cap = product({ id: "cap", name: "Wool Cap", createdAt: "2026-10-02T00:00:00Z" });
const plain = [tee, shirt, chino, cap];
const all = withPricing(plain, [], categories);
const priced = (promotions: Promotion[]) => withPricing(plain, promotions, categories);

describe("matchesQuery", () => {
  it("does not throw on regex characters and needs every word", () => {
    expect(matchesQuery(tee, "  TEE (  ")).toBe(false);
  });

  it("matches words in any case across name and description", () => {
    expect(matchesQuery(tee, "essential tee")).toBe(true);
    expect(matchesQuery(tee, "JERSEY")).toBe(true);
  });

  it("matches the category name", () => {
    expect(matchesQuery(tee, "tops")).toBe(true);
  });

  it("matches everything for an empty query", () => {
    expect(matchesQuery(tee, "")).toBe(true);
  });
});

describe("parseView", () => {
  it("accepts the three views", () => {
    expect(["deals", "picks", "new"].map(parseView)).toEqual(["deals", "picks", "new"]);
  });

  it("ignores anything else", () => {
    expect(parseView("bogus")).toBeNull();
    expect(parseView(undefined)).toBeNull();
  });
});

describe("filterProducts", () => {
  const ids = (list: Product[]) => list.map((p) => p.id);

  it("deals: sale items only, biggest discount first", () => {
    expect(ids(filterProducts(all, { view: "deals" }, categories))).toEqual(["chino", "shirt"]);
  });

  it("picks: featured only", () => {
    expect(ids(filterProducts(all, { view: "picks" }, categories))).toEqual(["tee"]);
  });

  it("new: everything, newest first", () => {
    expect(ids(filterProducts(all, { view: "new" }, categories))).toEqual([
      "chino",
      "tee",
      "cap",
      "shirt",
    ]);
  });

  it("combines view, category and query", () => {
    expect(
      ids(filterProducts(all, { view: "deals", category: categories[0], q: "oxford" }, categories)),
    ).toEqual(["shirt"]);
    expect(
      ids(filterProducts(all, { view: "deals", category: categories[0], q: "chino" }, categories)),
    ).toEqual([]);
  });

  it("keeps catalog order without a view", () => {
    expect(ids(filterProducts(all, {}, categories))).toEqual(["tee", "shirt", "chino", "cap"]);
  });

  it("deals: includes products a promotion discounts, by best discount", () => {
    // cap gets 60% off from the promotion: ahead of chino (50%) and shirt (25%).
    const capDeal = promo({ rules: [rule({ value: 60, scope: "products", productIds: ["cap"] })] });
    expect(ids(filterProducts(priced([capDeal]), { view: "deals" }, categories))).toEqual([
      "cap",
      "chino",
      "shirt",
    ]);
  });

  it("promo: keeps only products the promotion's rules match", () => {
    const bottoms = promo({ rules: [rule({ scope: "categories", categorySlugs: ["bottoms"] })] });
    expect(ids(filterProducts(all, { promo: bottoms }, categories))).toEqual(["chino"]);
    expect(ids(filterProducts(all, { promo: promo() }, categories))).toEqual(["tee", "shirt", "chino", "cap"]);
  });
});
