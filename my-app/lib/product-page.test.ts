import { describe, expect, it } from "vitest";
import { deliveryChips } from "./product-page";
import type { ItemPricing } from "./promotions";
import { promo, rule } from "./test-fixtures/promotions";

function pricing(over: Partial<ItemPricing> = {}): ItemPricing {
  return {
    price: 1000000,
    compareAt: null,
    promotion: null,
    discountPercent: null,
    conditional: [],
    freeShipping: null,
    ...over,
  };
}

describe("deliveryChips", () => {
  it("says the delivery fee depends on the district when nothing ships free", () => {
    const chips = deliveryChips(pricing(), 35000, null);
    expect(chips).toEqual([
      {
        key: "shipping",
        si: "බෙදාහැරීමේ ගාස්තුව ඔබේ දිස්ත්‍රික්කය අනුව වේ, checkout හිදී පෙන්වයි",
        en: "Delivery fee depends on your district, shown at checkout",
      },
    ]);
  });

  it("shows free shipping instead of the fee", () => {
    const chips = deliveryChips(pricing({ freeShipping: promo() }), 35000, null);
    expect(chips).toEqual([
      { key: "free-shipping", si: "නොමිලේ බෙදාහැරීම", en: "Free shipping" },
    ]);
  });

  it("shows no shipping chip when the fee is zero", () => {
    expect(deliveryChips(pricing(), 0, null)).toEqual([]);
  });

  it("adds one chip per conditional offer", () => {
    const offer = { promotion: promo(), rule: rule({ value: 10, minSubtotal: 500000 }) };
    const chips = deliveryChips(pricing({ conditional: [offer] }), 35000, null);
    expect(chips[1]).toEqual({
      key: "offer-halloween",
      si: "හැලොවීන්: Rs 5,000+ ඇණවුම්වලට 10% අඩුවෙන්",
      en: "Halloween: 10% off on orders over Rs 5,000",
    });
  });

  it("adds an end-date chip in Colombo time", () => {
    // 20:00 UTC on 31 Oct is already 1 Nov in Colombo (UTC+05:30).
    const chips = deliveryChips(pricing(), 35000, new Date("2026-10-31T20:00:00Z"));
    const ends = chips.find((chip) => chip.key === "ends");
    expect(ends?.en).toBe("Until November 1");
    expect(ends?.si).toContain("දක්වා");
  });

  it("has no end-date chip without an end", () => {
    expect(deliveryChips(pricing(), 35000, null).some((chip) => chip.key === "ends")).toBe(false);
  });
});
