import { describe, expect, it } from "vitest";
import {
  allSoldOut,
  isSoldOut,
  lowStockLeft,
  maxQuantity,
  parseStockField,
  sizeStock,
} from "./stock";

const sizes = ["M", "L"];

describe("stock rules", () => {
  it("treats null stock as untracked", () => {
    const p = { sizes, stock: null };
    expect(sizeStock(p, "M")).toEqual({ tracked: false, quantity: Infinity });
    expect(isSoldOut(p, "M")).toBe(false);
    expect(maxQuantity(p, "M")).toBe(Infinity);
    expect(lowStockLeft(p, "M")).toBeNull();
    expect(allSoldOut(p)).toBe(false);
  });

  it("treats a size missing from the map as untracked", () => {
    const p = { sizes, stock: { M: 0 } };
    expect(isSoldOut(p, "M")).toBe(true);
    expect(isSoldOut(p, "L")).toBe(false);
  });

  it("reports low stock only from 1 up to below 5", () => {
    expect(lowStockLeft({ stock: { M: 3 } }, "M")).toBe(3);
    expect(lowStockLeft({ stock: { M: 4 } }, "M")).toBe(4);
    expect(lowStockLeft({ stock: { M: 5 } }, "M")).toBeNull();
    expect(lowStockLeft({ stock: { M: 0 } }, "M")).toBeNull();
  });

  it("returns the tracked quantity as the cap", () => {
    expect(maxQuantity({ stock: { M: 7 } }, "M")).toBe(7);
  });

  it("is all sold out only when every size is tracked and zero", () => {
    expect(allSoldOut({ sizes, stock: { M: 0, L: 0 } })).toBe(true);
    expect(allSoldOut({ sizes, stock: { M: 0 } })).toBe(false);
    expect(allSoldOut({ sizes: [], stock: {} })).toBe(false);
  });
});

describe("parseStockField", () => {
  it("returns null for blank input", () => {
    for (const raw of [undefined, "", "  ", "{}"]) {
      expect(parseStockField(raw, sizes)).toEqual({ ok: true, value: null });
    }
  });

  it("parses a valid object", () => {
    expect(parseStockField('{"M":4,"L":0}', sizes)).toEqual({ ok: true, value: { M: 4, L: 0 } });
  });

  it("rejects bad values, unknown sizes and malformed input", () => {
    for (const raw of ['{"M":-1}', '{"M":1.5}', '{"M":10000}', '{"XL":2}', "[1]", "not json", '{"M":"3"}']) {
      expect(parseStockField(raw, sizes)).toEqual({ ok: false });
    }
  });
});
