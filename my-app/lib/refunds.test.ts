import { describe, expect, it } from "vitest";
import { canRefund, parseRefundForm, refundMethodLabel, refundSummary } from "./refunds";

const form = { amount: "500", method: "bank_transfer", reference: "", note: "" };

describe("canRefund", () => {
  const base = { status: "cancelled", paymentStatus: "advance_paid", advanceAmount: 50000 } as const;
  it("is true for a cancelled order with a paid advance", () => {
    expect(canRefund(base)).toBe(true);
  });
  it("is false in every other state", () => {
    expect(canRefund({ ...base, status: "pending" })).toBe(false);
    expect(canRefund({ ...base, status: "delivered" })).toBe(false);
    expect(canRefund({ ...base, paymentStatus: "advance_due" })).toBe(false);
    expect(canRefund({ ...base, paymentStatus: "slip_uploaded" })).toBe(false);
    expect(canRefund({ ...base, paymentStatus: "unpaid" })).toBe(false);
    expect(canRefund({ ...base, advanceAmount: 0 })).toBe(false);
  });
});

describe("refundSummary", () => {
  it("starts with nothing refunded", () => {
    expect(refundSummary(50000, [])).toEqual({ refunded: 0, remaining: 50000, state: "none" });
  });
  it("tracks a partial refund", () => {
    expect(refundSummary(50000, [{ amount: 20000 }])).toEqual({ refunded: 20000, remaining: 30000, state: "partial" });
  });
  it("is full once everything is back, and never goes negative", () => {
    expect(refundSummary(50000, [{ amount: 20000 }, { amount: 30000 }]).state).toBe("full");
    expect(refundSummary(50000, [{ amount: 60000 }]).remaining).toBe(0);
  });
});

describe("parseRefundForm", () => {
  it("accepts a valid form and converts rupees to cents", () => {
    expect(parseRefundForm({ ...form, amount: "250.50", reference: " TX1 ", note: "ok" }, 50000)).toEqual({
      ok: true,
      value: { amount: 25050, method: "bank_transfer", reference: "TX1", note: "ok" },
    });
  });
  it("allows refunding exactly what is owed", () => {
    expect(parseRefundForm(form, 50000).ok).toBe(true);
  });
  it("rejects a blank, zero, negative or fractional-cent amount", () => {
    for (const amount of ["", "0", "-5", "abc", "1.234"]) {
      const result = parseRefundForm({ ...form, amount }, 50000);
      expect(result.ok).toBe(false);
    }
  });
  it("rejects more than is owed", () => {
    const result = parseRefundForm({ ...form, amount: "500.01" }, 50000);
    expect(result).toMatchObject({ ok: false });
    if (!result.ok) expect(typeof result.errors.amount).toBe("string");
  });
  it("rejects an unknown method", () => {
    expect(parseRefundForm({ ...form, method: "paypal" }, 50000).ok).toBe(false);
  });
  it("rejects over-long text and control characters", () => {
    expect(parseRefundForm({ ...form, reference: "x".repeat(101) }, 50000).ok).toBe(false);
    expect(parseRefundForm({ ...form, note: "x".repeat(201) }, 50000).ok).toBe(false);
    expect(parseRefundForm({ ...form, note: "a\u0000b" }, 50000).ok).toBe(false);
    expect(parseRefundForm({ ...form, note: "line\nbreak" }, 50000).ok).toBe(true);
  });
});

describe("refundMethodLabel", () => {
  it("has both languages", () => {
    expect(refundMethodLabel("cash").en).toBe("Cash");
    expect(refundMethodLabel("bank_transfer").si.length).toBeGreaterThan(0);
  });
});
