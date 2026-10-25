import { describe, expect, it } from "vitest";
import {
  imagePathFor,
  isValidImagePath,
  parsePriceToCents,
  parseProductForm,
} from "./product-form";

const valid: Record<string, string | undefined> = {
  id: "trail-cap",
  name: "Trail Cap",
  price: "28.00",
  salePrice: "",
  category: "Accessories",
  description: "Cap.",
  sizes: "One Size",
  material: "x",
  construction: "x",
  origin: "x",
  swatchA: "#AABBCC",
  swatchB: "#112233",
  featured: "on",
  sortOrder: "",
};

const errorsFor = (overrides: Record<string, string | undefined>, mode: "create" | "update" = "create") => {
  const result = parseProductForm({ ...valid, ...overrides }, mode);
  return result.ok ? {} : result.errors;
};

describe("parsePriceToCents", () => {
  it.each([
    ["28", 2800],
    ["28.5", 2850],
    ["28.50", 2850],
    ["19.99", 1999],
    [" 7.10 ", 710],
  ])("%j → %i", (raw, cents) => expect(parsePriceToCents(raw)).toBe(cents));

  it.each(["0", "-1", "28.999", "abc", "", undefined, "100000"])("%j → null", (raw) =>
    expect(parsePriceToCents(raw)).toBeNull());
});

describe("parseProductForm", () => {
  it("parses a valid create form", () =>
    expect(parseProductForm(valid, "create")).toEqual({
      ok: true,
      id: "trail-cap",
      value: {
        name: "Trail Cap",
        price: 2800,
        sale_price: null,
        category: "Accessories",
        description: "Cap.",
        sizes: ["One Size"],
        material: "x",
        construction: "x",
        origin: "x",
        swatch: ["#aabbcc", "#112233"],
        featured: true,
        sort_order: 0,
      },
    }));

  it("ignores id in update mode", () => {
    const result = parseProductForm({ ...valid, id: "Bad ID" }, "update");
    expect(result.ok && result.id).toBeNull();
  });

  it.each(["Bad ID", "-x", "a".repeat(61)])("rejects id %j", (id) =>
    expect(errorsFor({ id }).id).toBe("Use lowercase letters, numbers and dashes."));

  it.each(["", "n".repeat(101)])("rejects name %j", (name) =>
    expect(errorsFor({ name }).name).toBe("Name is required (max 100 characters)."));

  it("rejects a bad price", () =>
    expect(errorsFor({ price: "abc" }).price).toBe("Enter a price like 28.00."));

  it("accepts a sale price below the price", () => {
    const result = parseProductForm({ ...valid, salePrice: "20" }, "create");
    expect(result.ok && result.value.sale_price).toBe(2000);
  });

  it.each(["28.00", "30"])("rejects sale price %j not below 28.00", (salePrice) =>
    expect(errorsFor({ salePrice }).salePrice).toBe("Sale price must be lower than the price."));

  it("rejects an unknown category", () =>
    expect(errorsFor({ category: "Hats" }).category).toBe("Pick a category."));

  it.each(["", "d".repeat(2001)])("rejects description %j", (description) =>
    expect(errorsFor({ description }).description).toBe(
      "Description is required (max 2000 characters).",
    ));

  it.each([
    "",
    Array.from({ length: 13 }, (_, i) => `S${i}`).join(","),
    "x".repeat(21),
  ])("rejects sizes %j", (sizes) =>
    expect(errorsFor({ sizes }).sizes).toBe("Enter 1–12 sizes separated by commas."));

  it("trims sizes and drops blanks and duplicates", () => {
    const result = parseProductForm({ ...valid, sizes: " S, M ,S,, L " }, "create");
    expect(result.ok && result.value.sizes).toEqual(["S", "M", "L"]);
  });

  it.each(["material", "construction", "origin"])("rejects blank and long %s", (field) => {
    expect(errorsFor({ [field]: "" })[field as "material"]).toBe("Required (max 200 characters).");
    expect(errorsFor({ [field]: "m".repeat(201) })[field as "material"]).toBe(
      "Required (max 200 characters).",
    );
  });

  it("rejects a bad swatch", () =>
    expect(errorsFor({ swatchA: "red" }).swatchA).toBe("Pick a color."));

  it("rejects a non-integer sort order", () =>
    expect(errorsFor({ sortOrder: "1.5" }).sortOrder).toBe("Enter a whole number."));

  it("reads featured and sort order", () => {
    const result = parseProductForm({ ...valid, featured: undefined, sortOrder: "-3" }, "create");
    expect(result.ok && result.value.featured).toBe(false);
    expect(result.ok && result.value.sort_order).toBe(-3);
  });
});

describe("imagePathFor", () => {
  it.each([
    ["image/jpeg", "tee-123.jpg"],
    ["image/png", "tee-123.png"],
    ["image/webp", "tee-123.webp"],
  ])("%s → %s", (type, path) => expect(imagePathFor("tee", type, 123)).toBe(path));

  it("rejects other types", () => expect(imagePathFor("tee", "image/gif", 123)).toBeNull());
});

describe("isValidImagePath", () => {
  it.each(["tee-123.jpg", "tee-1.webp"])("accepts %s for tee", (path) =>
    expect(isValidImagePath("tee", path)).toBe(true));

  it.each([
    "other-123.jpg",
    "tee-abc.jpg",
    "tee-123.gif",
    "../tee-123.jpg",
    "x/tee-123.jpg",
    "tee-shirt-123.jpg",
    "tee-123.jpg.png",
  ])("rejects %s for tee", (path) => expect(isValidImagePath("tee", path)).toBe(false));
});
