import { describe, expect, it } from "vitest";
import { paymentStatusLabel } from "./advance";
import { canCustomerCancel, collectOnDelivery } from "./orders";

describe("an order paid online", () => {
  it("collects nothing at the door", () => {
    expect(collectOnDelivery({ total: 835_000, advanceAmount: 0, paymentStatus: "online_paid" })).toBe(0);
  });
  it("keeps the old collect rules for the other payment states", () => {
    expect(collectOnDelivery({ total: 835_000, advanceAmount: 0, paymentStatus: "unpaid" })).toBe(835_000);
    expect(collectOnDelivery({ total: 835_000, advanceAmount: 100_000, paymentStatus: "advance_paid" })).toBe(735_000);
    expect(collectOnDelivery({ total: 835_000, advanceAmount: 100_000, paymentStatus: "advance_due" })).toBe(835_000);
  });
  it("cannot be cancelled by the customer (money is involved, the shop refunds it)", () => {
    expect(canCustomerCancel("pending", "online_paid")).toBe(false);
    expect(canCustomerCancel("pending", "unpaid")).toBe(true);
  });
  it("has a label in both languages", () => {
    const label = paymentStatusLabel("online_paid");
    expect(label.en).toBe("Paid online");
    expect(label.si.length).toBeGreaterThan(0);
  });
});
