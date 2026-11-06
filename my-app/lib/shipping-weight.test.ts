import { describe, expect, it } from "vitest";
import { feeForWeight, orderWeightGrams, shippingFeeFor, validateZones, type Zone } from "./shipping";

const flat: Zone = { id: "z", name: "Western", fee: 35000, districts: ["Colombo"], sortOrder: 0 };
const banded: Zone = {
  ...flat,
  bands: [
    { upToGrams: 500, fee: 35000 },
    { upToGrams: 1000, fee: 45000 },
  ],
  extraPerKg: 10000,
};

describe("feeForWeight", () => {
  it("is the flat fee with no bands or an unknown weight", () => {
    expect(feeForWeight(flat, 5000)).toBe(35000);
    expect(feeForWeight(banded, null)).toBe(35000);
    expect(feeForWeight(banded, undefined)).toBe(35000);
    expect(feeForWeight({ ...banded, bands: [] }, 5000)).toBe(35000);
  });
  it("uses the first band that fits, including the edges", () => {
    expect(feeForWeight(banded, 1)).toBe(35000);
    expect(feeForWeight(banded, 500)).toBe(35000);
    expect(feeForWeight(banded, 501)).toBe(45000);
    expect(feeForWeight(banded, 1000)).toBe(45000);
  });
  it("adds the per-kilogram fee for every started kilogram above the last band", () => {
    expect(feeForWeight(banded, 1001)).toBe(55000);
    expect(feeForWeight(banded, 2000)).toBe(55000);
    expect(feeForWeight(banded, 2001)).toBe(65000);
    expect(feeForWeight({ ...banded, extraPerKg: 0 }, 9999)).toBe(45000);
    expect(feeForWeight({ ...banded, extraPerKg: undefined }, 9999)).toBe(45000);
  });
  it("ignores a junk weight", () => {
    expect(feeForWeight(banded, -5)).toBe(35000);
    expect(feeForWeight(banded, Number.NaN)).toBe(35000);
  });
});

describe("orderWeightGrams", () => {
  const products = [
    { id: "tee", weightGrams: 200 },
    { id: "hoodie", weightGrams: 600 },
    { id: "hat", weightGrams: null },
    { id: "cap" },
  ];
  it("adds weight times quantity", () => {
    expect(
      orderWeightGrams(
        [
          { id: "tee", quantity: 2 },
          { id: "hoodie", quantity: 1 },
        ],
        products,
      ),
    ).toBe(1000);
  });
  it("is unknown when any item has no weight, is missing or the cart is empty", () => {
    expect(orderWeightGrams([{ id: "tee", quantity: 1 }, { id: "hat", quantity: 1 }], products)).toBeNull();
    expect(orderWeightGrams([{ id: "cap", quantity: 1 }], products)).toBeNull();
    expect(orderWeightGrams([{ id: "gone", quantity: 1 }], products)).toBeNull();
    expect(orderWeightGrams([], products)).toBeNull();
  });
});

describe("shippingFeeFor with weight", () => {
  it("charges by weight inside a banded zone and flat elsewhere", () => {
    expect(shippingFeeFor("Colombo", [banded], 50000, 800)).toBe(45000);
    expect(shippingFeeFor("Jaffna", [banded], 50000, 800)).toBe(50000);
    expect(shippingFeeFor(null, [banded], 50000, 800)).toBe(50000);
  });
  it("stays the flat zone fee without a weight (old callers)", () => {
    expect(shippingFeeFor("Colombo", [banded], 50000)).toBe(35000);
    expect(shippingFeeFor("Colombo", [flat], 50000, 800)).toBe(35000);
  });
});

describe("validateZones with weight bands", () => {
  const base = { name: "Western", fee: "350", districts: ["Colombo"] };

  it("keeps the old shape for a flat zone", () => {
    expect(validateZones([base])).toEqual({ ok: true, value: [{ name: "Western", fee: 35000, districts: ["Colombo"] }] });
  });
  it("converts bands to cents and carries the extra fee", () => {
    const result = validateZones([
      { ...base, bands: [{ upToGrams: "500", fee: "350" }, { upToGrams: 1000, fee: 450 }], extraPerKg: "100" },
    ]);
    expect(result).toEqual({
      ok: true,
      value: [
        {
          name: "Western",
          fee: 35000,
          districts: ["Colombo"],
          bands: [
            { upToGrams: 500, fee: 35000 },
            { upToGrams: 1000, fee: 45000 },
          ],
          extraPerKg: 10000,
        },
      ],
    });
  });
  it("treats a blank extra fee as zero", () => {
    const result = validateZones([{ ...base, bands: [{ upToGrams: "500", fee: "350" }], extraPerKg: "" }]);
    expect(result.ok && result.value[0].extraPerKg).toBe(0);
  });
  it("rejects bands that are not strictly ascending", () => {
    for (const bands of [
      [{ upToGrams: "500", fee: "1" }, { upToGrams: "500", fee: "2" }],
      [{ upToGrams: "500", fee: "1" }, { upToGrams: "400", fee: "2" }],
    ]) {
      expect(validateZones([{ ...base, bands }]).ok).toBe(false);
    }
  });
  it("rejects bad grams, bad fees and too many bands", () => {
    for (const band of [
      { upToGrams: "0", fee: "1" },
      { upToGrams: "100001", fee: "1" },
      { upToGrams: "1.5", fee: "1" },
      { upToGrams: "abc", fee: "1" },
      { upToGrams: "500", fee: "-1" },
      { upToGrams: "500", fee: "100001" },
      { upToGrams: "500", fee: "" },
    ]) {
      expect(validateZones([{ ...base, bands: [band] }]).ok, JSON.stringify(band)).toBe(false);
    }
    const seven = Array.from({ length: 7 }, (_, i) => ({ upToGrams: String((i + 1) * 100), fee: "1" }));
    expect(validateZones([{ ...base, bands: seven }]).ok).toBe(false);
  });
  it("rejects an extra fee with no bands, or a bad extra fee", () => {
    expect(validateZones([{ ...base, extraPerKg: "50" }]).ok).toBe(false);
    expect(validateZones([{ ...base, bands: [{ upToGrams: "500", fee: "1" }], extraPerKg: "-1" }]).ok).toBe(false);
    expect(validateZones([{ ...base, bands: [{ upToGrams: "500", fee: "1" }], extraPerKg: "100001" }]).ok).toBe(false);
  });
});
