import { describe, expect, it } from "vitest";
import {
  DISTRICTS,
  isDistrict,
  parseShipment,
  shippingFeeFor,
  trackingUrl,
  validateCourier,
  validateZones,
  type Zone,
} from "./shipping";

const zone = (id: string, fee: number, districts: string[], sortOrder = 0): Zone => ({
  id,
  name: id,
  fee,
  districts,
  sortOrder,
});

describe("DISTRICTS", () => {
  it("has the 25 districts with English and Sinhala names", () => {
    expect(DISTRICTS).toHaveLength(25);
    expect(new Set(DISTRICTS.map((d) => d.en)).size).toBe(25);
    for (const d of DISTRICTS) {
      expect(d.en.length).toBeGreaterThan(0);
      expect(d.si.length).toBeGreaterThan(0);
    }
  });

  it("isDistrict matches the exact English name only", () => {
    expect(isDistrict("Colombo")).toBe(true);
    expect(isDistrict("Nuwara Eliya")).toBe(true);
    expect(isDistrict("colombo")).toBe(false);
    expect(isDistrict("Atlantis")).toBe(false);
    expect(isDistrict(null)).toBe(false);
    expect(isDistrict(5)).toBe(false);
  });
});

describe("shippingFeeFor", () => {
  const zones = [zone("a", 20000, ["Colombo", "Gampaha"]), zone("b", 45000, ["Jaffna"])];

  it("uses the zone containing the district", () => {
    expect(shippingFeeFor("Gampaha", zones, 35000)).toBe(20000);
    expect(shippingFeeFor("Jaffna", zones, 35000)).toBe(45000);
  });

  it("falls back to the default fee when no zone has the district", () => {
    expect(shippingFeeFor("Galle", zones, 35000)).toBe(35000);
    expect(shippingFeeFor(null, zones, 35000)).toBe(35000);
    expect(shippingFeeFor("Colombo", [], 35000)).toBe(35000);
  });

  it("takes the first zone if a district is in several", () => {
    const dup = [zone("a", 100, ["Galle"]), zone("b", 200, ["Galle"])];
    expect(shippingFeeFor("Galle", dup, 999)).toBe(100);
  });

  it("allows a zone fee of 0", () => {
    expect(shippingFeeFor("Colombo", [zone("free", 0, ["Colombo"])], 35000)).toBe(0);
  });
});

describe("validateZones", () => {
  const ok = { name: " Western ", fee: "200", districts: ["Colombo", "Gampaha"] };

  it("trims names and converts rupees to cents", () => {
    const result = validateZones([ok, { name: "North", fee: 450, districts: ["Jaffna"] }]);
    expect(result).toEqual({
      ok: true,
      value: [
        { name: "Western", fee: 20000, districts: ["Colombo", "Gampaha"] },
        { name: "North", fee: 45000, districts: ["Jaffna"] },
      ],
    });
  });

  it("accepts no zones", () => {
    expect(validateZones([])).toEqual({ ok: true, value: [] });
  });

  it("accepts a fee of 0 and the maximum 100000", () => {
    expect(validateZones([{ ...ok, fee: "0" }]).ok).toBe(true);
    expect(validateZones([{ ...ok, fee: 100000 }]).ok).toBe(true);
  });

  it("rejects fees out of range or not whole numbers", () => {
    for (const fee of ["-1", 100001, "1.5", "abc", "", "  ", NaN, 2.5]) {
      expect(validateZones([{ ...ok, fee }]).ok, String(fee)).toBe(false);
    }
  });

  it("rejects a name that is empty or over 40 characters", () => {
    expect(validateZones([{ ...ok, name: "   " }]).ok).toBe(false);
    expect(validateZones([{ ...ok, name: "x".repeat(41) }]).ok).toBe(false);
    expect(validateZones([{ ...ok, name: "x".repeat(40) }]).ok).toBe(true);
  });

  it("rejects an unknown district", () => {
    expect(validateZones([{ ...ok, districts: ["Colombo", "Atlantis"] }]).ok).toBe(false);
  });

  it("rejects a district in two zones", () => {
    const result = validateZones([
      { name: "A", fee: 1, districts: ["Colombo"] },
      { name: "B", fee: 2, districts: ["Galle", "Colombo"] },
    ]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.length).toBeGreaterThan(0);
  });

  it("rejects the same district twice in one zone", () => {
    expect(validateZones([{ ...ok, districts: ["Colombo", "Colombo"] }]).ok).toBe(false);
  });

  it("rejects more than 10 zones", () => {
    const names = DISTRICTS.slice(0, 11).map((d) => ({
      name: d.en,
      fee: 1,
      districts: [d.en],
    }));
    expect(validateZones(names.slice(0, 10)).ok).toBe(true);
    expect(validateZones(names).ok).toBe(false);
  });
});

describe("trackingUrl", () => {
  const template = "https://courier.example/track?no={number}";

  it("fills in the encoded number", () => {
    expect(trackingUrl(template, "AB-123")).toBe("https://courier.example/track?no=AB-123");
    expect(trackingUrl(template, "a b")).toBe("https://courier.example/track?no=a%20b");
  });

  it("returns null for a missing or unusable template", () => {
    expect(trackingUrl(null, "AB-123")).toBeNull();
    expect(trackingUrl("", "AB-123")).toBeNull();
    expect(trackingUrl("https://courier.example/track", "AB-123")).toBeNull();
    expect(trackingUrl("http://courier.example/?no={number}", "AB-123")).toBeNull();
    expect(trackingUrl("javascript:alert({number})", "AB-123")).toBeNull();
  });
});

describe("validateCourier", () => {
  it("accepts a name with a template or without", () => {
    expect(
      validateCourier({ name: " Pronto ", template: " https://x.lk/t/{number} " }),
    ).toEqual({ ok: true, value: { name: "Pronto", template: "https://x.lk/t/{number}" } });
    expect(validateCourier({ name: "Pronto", template: "  " })).toEqual({
      ok: true,
      value: { name: "Pronto", template: null },
    });
  });

  it("rejects a bad name", () => {
    for (const name of ["", "A", "x".repeat(41)]) {
      const result = validateCourier({ name, template: "" });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.errors.name).toBeTruthy();
    }
  });

  it("rejects a template without {number} or with http://", () => {
    for (const template of ["https://x.lk/track", "http://x.lk/{number}", "ftp://x/{number}"]) {
      const result = validateCourier({ name: "Pronto", template });
      expect(result.ok, template).toBe(false);
      if (!result.ok) expect(result.errors.template).toBeTruthy();
    }
  });

  it("rejects a template over 200 characters", () => {
    const template = "https://x.lk/" + "a".repeat(190) + "{number}";
    expect(validateCourier({ name: "Pronto", template }).ok).toBe(false);
  });
});

describe("parseShipment", () => {
  const courierId = "123e4567-e89b-12d3-a456-426614174000";

  it("accepts a UUID and a tracking number", () => {
    expect(parseShipment({ courierId, trackingNumber: " AB-123 " })).toEqual({
      ok: true,
      value: { courierId, trackingNumber: "AB-123" },
    });
  });

  it("rejects a missing or malformed courier id", () => {
    for (const id of [undefined, "", "not-a-uuid"]) {
      const result = parseShipment({ courierId: id, trackingNumber: "AB-123" });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.errors.courierId).toBe(true);
    }
  });

  it("rejects tracking numbers with spaces, slashes or bad length", () => {
    for (const trackingNumber of [undefined, "", "ab", "AB 123", "AB/123", "a?b=c", "x".repeat(41)]) {
      const result = parseShipment({ courierId, trackingNumber });
      expect(result.ok, String(trackingNumber)).toBe(false);
      if (!result.ok) expect(result.errors.trackingNumber).toBe(true);
    }
  });
});
