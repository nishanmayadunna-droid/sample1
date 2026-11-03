import { describe, expect, it } from "vitest";
import { formatPrice, formatPriceWhole, toShellProduct, type Product } from "./products";

describe("formatPrice (Sri Lankan rupees, from cents)", () => {
  it.each([
    [85000, "Rs 850.00"],
    [60000, "Rs 600.00"],
    [2850, "Rs 28.50"],
    [0, "Rs 0.00"],
    [1234500, "Rs 12,345.00"],
    [99999999, "Rs 999,999.99"],
  ])("%i → %s", (cents, text) => expect(formatPrice(cents)).toBe(text));
});

describe("formatPriceWhole (banners)", () => {
  it.each([
    [500000, "Rs 5,000"],
    [35000, "Rs 350"],
    [2850, "Rs 28.50"], // keeps cents when there are any
  ])("%i → %s", (cents, text) => expect(formatPriceWhole(cents)).toBe(text));
});

describe("toShellProduct", () => {
  const base: Product = {
    id: "tee",
    name: "Tee",
    price: 100000,
    category: "tops",
    categoryName: "Tops",
    description: "d",
    sizes: ["M", "L"],
    spec: { material: "m", construction: "c", origin: "o" },
    swatch: ["#000000", "#111111"],
    gallery: [],
    stock: { M: 3 },
    rating: null,
    createdAt: "2026-01-01T00:00:00Z",
  };

  it("carries stock to the browser", () => {
    expect(toShellProduct(base).stock).toEqual({ M: 3 });
    expect(toShellProduct({ ...base, stock: null }).stock).toBeNull();
  });
});
