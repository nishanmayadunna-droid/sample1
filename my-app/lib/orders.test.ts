import { describe, expect, it } from "vitest";
import {
  ORDER_STATUSES,
  canCustomerCancel,
  collectOnDelivery,
  cancelReasonLabel,
  nextStatuses,
  normalizePhone,
  orderTotals,
  parseCheckoutDetails,
  statusLabel,
} from "./orders";

describe("nextStatuses", () => {
  it("allows only the forward steps and cancel", () => {
    expect(nextStatuses("pending")).toEqual(["confirmed", "cancelled"]);
    expect(nextStatuses("confirmed")).toEqual(["shipped", "cancelled"]);
    expect(nextStatuses("shipped")).toEqual(["delivered", "cancelled"]);
    expect(nextStatuses("delivered")).toEqual([]);
    expect(nextStatuses("cancelled")).toEqual([]);
  });

  it("has a label for every status", () => {
    for (const status of ORDER_STATUSES) {
      expect(statusLabel(status).en).not.toBe("");
      expect(statusLabel(status).si).not.toBe("");
    }
  });
});

describe("canCustomerCancel", () => {
  it("is true only while pending", () => {
    expect(ORDER_STATUSES.filter((status) => canCustomerCancel(status))).toEqual(["pending"]);
  });

  it("is false once a slip is uploaded or the advance is paid, so the money isn't lost track of", () => {
    expect(canCustomerCancel("pending", "unpaid")).toBe(true);
    expect(canCustomerCancel("pending", "advance_due")).toBe(true);
    expect(canCustomerCancel("pending", "slip_uploaded")).toBe(false);
    expect(canCustomerCancel("pending", "advance_paid")).toBe(false);
    expect(canCustomerCancel("confirmed", "unpaid")).toBe(false);
  });
});

describe("normalizePhone", () => {
  it.each(["0771234567", "+94771234567", "94771234567", "077 123 4567", "077-123-4567"])(
    "accepts %j",
    (raw) => expect(normalizePhone(raw)).toBe("0771234567"),
  );

  it.each(["0112345678", "12345", "", "07712345678", "abc"])("rejects %j", (raw) =>
    expect(normalizePhone(raw)).toBeNull(),
  );
});

describe("parseCheckoutDetails", () => {
  const valid = {
    name: "Nimal Perera",
    phone: "077 123 4567",
    address: "12 Temple Road",
    city: "Colombo",
    district: "Colombo",
    note: "",
  };

  it("parses valid details, normalising the phone and blank note", () => {
    expect(parseCheckoutDetails(valid)).toEqual({
      ok: true,
      value: { name: "Nimal Perera", phone: "0771234567", address: "12 Temple Road", city: "Colombo", district: "Colombo", note: null },
    });
  });

  it("flags a missing district", () => {
    expect(parseCheckoutDetails({ ...valid, district: undefined })).toEqual({ ok: false, errors: { district: true } });
  });

  it("keeps a note, trimmed", () => {
    const result = parseCheckoutDetails({ ...valid, note: "  call first \n" });
    expect(result.ok && result.value.note).toBe("call first");
  });

  it.each([
    ["name", { name: "A" }],
    ["phone", { phone: "12345" }],
    ["address", { address: "abc" }],
    ["city", { city: "" }],
    ["district", { district: "" }],
    ["district", { district: "Atlantis" }],
    ["district", { district: "colombo" }],
    ["note", { note: "x".repeat(501) }],
    ["address", { address: "x\u0000y road" }],
  ] as const)("flags only %s", (field, override) => {
    const result = parseCheckoutDetails({ ...valid, ...override });
    expect(result).toEqual({ ok: false, errors: { [field]: true } });
  });
});

describe("orderTotals", () => {
  it("maps a cart summary, with and without a discount", () => {
    expect(
      orderTotals({ subtotal: 10000, orderDiscount: { amount: 1000 }, shipping: 350, total: 9350 }),
    ).toEqual({ subtotal: 10000, discount: 1000, pointsDiscount: 0, shipping: 350, total: 9350 });
    expect(orderTotals({ subtotal: 10000, orderDiscount: null, shipping: 0, total: 10000 })).toEqual({
      subtotal: 10000,
      discount: 0,
      pointsDiscount: 0,
      shipping: 0,
      total: 10000,
    });
  });

  it("takes the points discount off the total", () => {
    expect(orderTotals({ subtotal: 10000, orderDiscount: null, shipping: 350, total: 10350 }, 2000)).toEqual({
      subtotal: 10000,
      discount: 0,
      pointsDiscount: 2000,
      shipping: 350,
      total: 8350,
    });
  });
});

describe("cancelReasonLabel", () => {
  it("explains an expired advance in both languages", () => {
    expect(cancelReasonLabel("advance_expired").en).not.toBe("");
    expect(cancelReasonLabel("advance_expired").si).not.toBe("");
  });
});

describe("collectOnDelivery", () => {
  it("subtracts the advance only once it is paid", () => {
    expect(collectOnDelivery({ total: 500000, advanceAmount: 100000, paymentStatus: "advance_paid" })).toBe(400000);
    expect(collectOnDelivery({ total: 500000, advanceAmount: 100000, paymentStatus: "advance_due" })).toBe(500000);
    expect(collectOnDelivery({ total: 500000, advanceAmount: 0, paymentStatus: "unpaid" })).toBe(500000);
  });
  it("never goes below zero", () => {
    expect(collectOnDelivery({ total: 100000, advanceAmount: 150000, paymentStatus: "advance_paid" })).toBe(0);
  });
});
