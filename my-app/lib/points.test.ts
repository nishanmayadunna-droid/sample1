import { describe, expect, it } from "vitest";
import {
  ledgerKindLabel,
  parsePointsSettings,
  pointsToEarn,
  pointsToUse,
  type PointsSettings,
} from "./points";

// Rs 100 of goods earns 1 point; 1 point is worth Rs 1; at most 50% of an order.
const on: PointsSettings = { enabled: true, earnPer: 10000, pointValue: 100, maxPercent: 50 };
const off: PointsSettings = { ...on, enabled: false };

describe("pointsToUse", () => {
  it("uses nothing when points are off", () => {
    expect(pointsToUse(100, 100, 1000000, off)).toEqual({ points: 0, discount: 0 });
  });

  it("uses what was asked when the balance and the cap allow it", () => {
    expect(pointsToUse(100, 500, 1000000, on)).toEqual({ points: 100, discount: 10000 });
  });

  it("never uses more than the balance", () => {
    expect(pointsToUse(900, 40, 1000000, on)).toEqual({ points: 40, discount: 4000 });
  });

  it("never uses more than the percent cap of the goods", () => {
    // Goods Rs 10,000 with a 50% cap is Rs 5,000 = 5,000 points.
    expect(pointsToUse(99999, 99999, 1000000, on)).toEqual({ points: 5000, discount: 500000 });
  });

  it("rounds the cap down to whole points", () => {
    // Goods Rs 100.99, 50% cap = Rs 50.49 -> 50 points, not 50.49.
    expect(pointsToUse(1000, 1000, 10099, on).points).toBe(50);
  });

  it("uses whole points only", () => {
    expect(pointsToUse(2.9, 10, 1000000, on).points).toBe(2);
  });

  it.each([-3, Number.NaN, Number.POSITIVE_INFINITY])("treats %s as no points", (requested) => {
    expect(pointsToUse(requested, 100, 1000000, on)).toEqual({ points: 0, discount: 0 });
  });

  it("treats a bad balance or goods amount as no points", () => {
    expect(pointsToUse(10, Number.NaN, 1000000, on).points).toBe(0);
    expect(pointsToUse(10, 100, Number.NaN, on).points).toBe(0);
    expect(pointsToUse(10, 100, 0, on).points).toBe(0);
  });

  it("never discounts more than the goods, even with a high point value", () => {
    const rich = { ...on, pointValue: 1000000, maxPercent: 100 };
    const result = pointsToUse(5, 5, 1500000, rich);
    expect(result.discount).toBeLessThanOrEqual(1500000);
    expect(result).toEqual({ points: 1, discount: 1000000 });
  });
});

describe("pointsToEarn", () => {
  it("is zero when off or for no goods", () => {
    expect(pointsToEarn(1000000, off)).toBe(0);
    expect(pointsToEarn(0, on)).toBe(0);
  });

  it("earns one point per earnPer, rounded down", () => {
    expect(pointsToEarn(1000000, on)).toBe(100);
    expect(pointsToEarn(19999, on)).toBe(1);
    expect(pointsToEarn(9999, on)).toBe(0);
  });
});

describe("parsePointsSettings", () => {
  const valid = { enabled: "on", earnPer: "100", pointValue: "1", maxPercent: "50" };

  it("parses rupees into cents", () => {
    expect(parsePointsSettings(valid)).toEqual({ ok: true, value: on });
    expect(parsePointsSettings({ ...valid, enabled: undefined })).toEqual({ ok: true, value: off });
  });

  it("accepts a fractional point value", () => {
    const result = parsePointsSettings({ ...valid, pointValue: "0.50" });
    expect(result.ok && result.value.pointValue).toBe(50);
  });

  it.each([
    ["earnPer", { earnPer: "0.50" }],
    ["earnPer", { earnPer: "abc" }],
    ["earnPer", { earnPer: "1000000" }],
    ["pointValue", { pointValue: "0" }],
    ["pointValue", { pointValue: "-1" }],
    ["maxPercent", { maxPercent: "0" }],
    ["maxPercent", { maxPercent: "101" }],
    ["maxPercent", { maxPercent: "2.5" }],
  ])("rejects bad %s", (field, override) => {
    const result = parsePointsSettings({ ...valid, ...override });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(Object.keys(result.errors)).toContain(field);
  });
});

describe("ledgerKindLabel", () => {
  it("has a label for every kind", () => {
    for (const kind of ["earn", "redeem", "refund", "adjust"] as const) {
      expect(ledgerKindLabel(kind).en).not.toBe("");
      expect(ledgerKindLabel(kind).si).not.toBe("");
    }
  });
});
