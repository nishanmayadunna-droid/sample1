import { describe, expect, it } from "vitest";
import type { Category } from "./products";
import {
  categoryNameFor,
  categorySelectDefault,
  parseCategoryForm,
  productsInCategory,
  resolveCategoryParam,
} from "./category-form";

const categories: Category[] = [
  { slug: "tops", name: "Tops", swatch: ["#1e293b", "#0f172a"], sortOrder: 1 },
  { slug: "bottoms", name: "Bottoms", swatch: ["#3b82f6", "#1e3a8a"], sortOrder: 2 },
  { slug: "outerwear", name: "Outerwear", swatch: ["#4d7c0f", "#365314"], sortOrder: 3 },
  { slug: "accessories", name: "Accessories", swatch: ["#d97706", "#78350f"], sortOrder: 4 },
];
const outerwear = categories[2];

const valid: Record<string, string | undefined> = {
  slug: "qa-test-cat",
  name: " QA Cat ",
  swatchA: "#AABBCC",
  swatchB: "#112233",
  sortOrder: "",
};
const errorsFor = (overrides: Record<string, string | undefined>) => {
  const result = parseCategoryForm({ ...valid, ...overrides }, "create");
  return result.ok ? {} : result.errors;
};

describe("parseCategoryForm", () => {
  it("parses a valid create form", () =>
    expect(parseCategoryForm(valid, "create")).toEqual({
      ok: true,
      slug: "qa-test-cat",
      value: { name: "QA Cat", swatch: ["#aabbcc", "#112233"], sort_order: 0 },
    }));

  it("ignores the slug in update mode", () => {
    const result = parseCategoryForm({ ...valid, slug: "Bad Slug" }, "update");
    expect(result.ok && result.slug).toBeNull();
  });

  it("rejects a bad slug", () =>
    expect(errorsFor({ slug: "Bad Slug" }).slug).toBe("Use lowercase letters, numbers and dashes."));

  it.each(["", "   ", "n".repeat(41)])("rejects name %j", (name) =>
    expect(errorsFor({ name }).name).toBe("Name is required (max 40 characters)."));

  it("rejects a bad swatch", () => expect(errorsFor({ swatchA: "red" }).swatchA).toBe("Pick a color."));

  it("rejects a non-integer sort order", () =>
    expect(errorsFor({ sortOrder: "1.5" }).sortOrder).toBe("Enter a whole number."));

  it("reads a negative sort order", () => {
    const result = parseCategoryForm({ ...valid, sortOrder: "-2" }, "create");
    expect(result.ok && result.value.sort_order).toBe(-2);
  });
});

describe("resolveCategoryParam", () => {
  it.each(["outerwear", "Outerwear", " OUTERWEAR "])("resolves %j", (param) =>
    expect(resolveCategoryParam(param, categories)).toBe(outerwear));

  it.each(["Hats", "", "  ", undefined])("returns null for %j", (param) =>
    expect(resolveCategoryParam(param, categories)).toBeNull());
});

describe("categoryNameFor", () => {
  it.each([
    ["tops", "Tops"],
    ["Tops", "Tops"],
    ["gone", "gone"],
  ])("%s → %s", (value, name) => expect(categoryNameFor(value, categories)).toBe(name));
});

describe("productsInCategory", () => {
  it("matches products stored by old name and by slug", () => {
    const products = [
      { id: "a", category: "Outerwear" },
      { id: "b", category: "outerwear" },
      { id: "c", category: "Tops" },
      { id: "d", category: "gone" },
    ];
    expect(productsInCategory(products, outerwear, categories).map((p) => p.id)).toEqual([
      "a",
      "b",
    ]);
  });
});

describe("categorySelectDefault", () => {
  it("selects the product's resolved slug", () =>
    expect(categorySelectDefault("Outerwear", categories)).toEqual({ value: "outerwear", missing: null }));
  it("selects the first category for a new product", () =>
    expect(categorySelectDefault(undefined, categories)).toEqual({ value: "tops", missing: null }));
  // A missing category must not silently become "Tops" on the next save.
  it("keeps a missing category unselectable instead of defaulting to the first", () =>
    expect(categorySelectDefault("gone", categories)).toEqual({ value: "", missing: "gone" }));
});

describe("renamed categories", () => {
  const renamed: Category[] = [
    ...categories.filter((c) => c.slug !== "outerwear"),
    { slug: "outerwear", name: "Jackets", swatch: ["#4d7c0f", "#365314"], sortOrder: 3 },
    { slug: "coats", name: "Outerwear", swatch: ["#000000", "#111111"], sortOrder: 5 },
  ];
  const products = [
    { id: "legacy", category: "Outerwear" }, // stored before the FK migration
    { id: "new", category: "outerwear" },
    { id: "coat", category: "coats" },
  ];

  it("keeps legacy rows in the renamed category (slug wins over another's name)", () =>
    expect(
      productsInCategory(products, renamed.find((c) => c.slug === "outerwear")!, renamed).map((p) => p.id),
    ).toEqual(["legacy", "new"]));

  it("does not give legacy rows to a new category that took the old name", () =>
    expect(
      productsInCategory(products, renamed.find((c) => c.slug === "coats")!, renamed).map((p) => p.id),
    ).toEqual(["coat"]));
});
