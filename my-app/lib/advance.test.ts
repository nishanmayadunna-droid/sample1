import { describe, expect, it } from "vitest";
import {
  advanceFor,
  advanceRequired,
  isValidSlipPath,
  parseAdvanceSettings,
  paymentStatusLabel,
  slipPathFor,
  type AdvanceSettings,
} from "./advance";

const base: AdvanceSettings = { mode: "off", fixed: 50000, percent: 10, min: 50000, max: 500000 };
const fixed = { ...base, mode: "fixed" as const };
const percent = { ...base, mode: "percent" as const };

describe("advanceFor", () => {
  it("is zero when off", () => {
    expect(advanceFor(1000000, base)).toBe(0);
  });

  it("charges the fixed amount, capped at the order total", () => {
    expect(advanceFor(1000000, fixed)).toBe(50000);
    expect(advanceFor(30000, fixed)).toBe(30000);
  });

  it("takes a percentage, clamped to the minimum and maximum", () => {
    expect(advanceFor(1000000, percent)).toBe(100000);
    expect(advanceFor(100000, percent)).toBe(50000); // 10% = 10000, raised to the minimum
    expect(advanceFor(10000000, { ...percent, percent: 50 })).toBe(500000); // 50% capped at the maximum
  });

  it("rounds to whole cents and never exceeds the total", () => {
    expect(advanceFor(3330, { ...percent, min: 0 })).toBe(333);
    expect(advanceFor(333, { ...percent, min: 0, percent: 10 })).toBe(33);
    expect(advanceFor(20000, percent)).toBe(20000); // minimum above the total is cut to the total
  });

  it("is zero for an empty order and never negative", () => {
    expect(advanceFor(0, fixed)).toBe(0);
    expect(advanceFor(-5, fixed)).toBe(0);
  });
});

describe("advanceRequired", () => {
  it("is false for trusted customers and when off", () => {
    expect(advanceRequired(true, fixed)).toBe(false);
    expect(advanceRequired(false, base)).toBe(false);
  });

  it("is true for untrusted customers when on", () => {
    expect(advanceRequired(false, fixed)).toBe(true);
    expect(advanceRequired(false, percent)).toBe(true);
  });
});

describe("parseAdvanceSettings", () => {
  const valid = {
    mode: "fixed",
    fixed: "500",
    percent: "10",
    min: "500",
    max: "5000.50",
    bankName: "BOC",
    accountName: "Northbound",
    accountNumber: "1234567",
    branch: "Colombo",
    note: "Use your order number as the reference.",
  };

  it("parses rupees into cents", () => {
    expect(parseAdvanceSettings(valid)).toEqual({
      ok: true,
      value: {
        mode: "fixed",
        fixed: 50000,
        percent: 10,
        min: 50000,
        max: 500050,
        bankName: "BOC",
        accountName: "Northbound",
        accountNumber: "1234567",
        branch: "Colombo",
        note: "Use your order number as the reference.",
      },
    });
  });

  it("allows a zero minimum", () => {
    const result = parseAdvanceSettings({ ...valid, min: "0" });
    expect(result.ok && result.value.min).toBe(0);
  });

  it.each([
    ["mode", { mode: "weekly" }],
    ["percent", { percent: "0" }],
    ["percent", { percent: "101" }],
    ["percent", { percent: "2.5" }],
    ["fixed", { fixed: "-5" }],
    ["fixed", { fixed: "abc" }],
    ["fixed", { fixed: "0" }],
    ["max", { max: "1000000" }],
    ["max", { min: "600", max: "500" }],
    ["bankName", { bankName: "x".repeat(121) }],
    ["note", { note: "a\u0000b" }],
    ["note", { note: "x".repeat(501) }],
  ])("rejects bad %s", (field, override) => {
    const result = parseAdvanceSettings({ ...valid, ...override });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(Object.keys(result.errors)).toContain(field);
  });
});

describe("slip paths", () => {
  const orderId = "3f2b8c1e-0000-4000-8000-000000000001";
  const other = "3f2b8c1e-0000-4000-8000-000000000002";

  it("builds a path that validates for the same order only", () => {
    const path = slipPathFor(orderId, "image/png", 1700000000000, "ab12cd34");
    expect(path).toBe(`${orderId}/1700000000000-ab12cd34.png`);
    expect(isValidSlipPath(orderId, path!)).toBe(true);
    expect(isValidSlipPath(other, path!)).toBe(false);
  });

  it("maps every allowed type and rejects the rest", () => {
    expect(slipPathFor(orderId, "image/jpeg", 1, "abcdef")).toMatch(/\.jpg$/);
    expect(slipPathFor(orderId, "image/webp", 1, "abcdef")).toMatch(/\.webp$/);
    expect(slipPathFor(orderId, "application/pdf", 1, "abcdef")).toMatch(/\.pdf$/);
    expect(slipPathFor(orderId, "text/html", 1, "abcdef")).toBeNull();
    expect(slipPathFor(orderId, "image/png", 1, "../x")).toBeNull();
  });

  it.each([
    `../${"3f2b8c1e-0000-4000-8000-000000000001"}/1-abc.jpg`,
    "3f2b8c1e-0000-4000-8000-000000000001/../x.jpg",
    "3f2b8c1e-0000-4000-8000-000000000001/a/b.jpg",
    "3f2b8c1e-0000-4000-8000-000000000001/1-abc.exe",
    "3f2b8c1e-0000-4000-8000-000000000001/1-ABC.jpg",
    "3f2b8c1e-0000-4000-8000-000000000001/",
    "",
  ])("rejects %j", (path) => {
    expect(isValidSlipPath(orderId, path)).toBe(false);
  });
});

describe("paymentStatusLabel", () => {
  it("has a label for every payment status", () => {
    for (const status of ["unpaid", "advance_due", "slip_uploaded", "advance_paid"] as const) {
      expect(paymentStatusLabel(status).en).not.toBe("");
      expect(paymentStatusLabel(status).si).not.toBe("");
    }
  });
});
