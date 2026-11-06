import { describe, expect, it } from "vitest";
import { segmentCount } from "./notifications";
import {
  buildOwnerMessage,
  DEFAULT_OWNER_ALERT_SETTINGS,
  lowStockHits,
  OWNER_DAILY_CAP,
  ownerDedupe,
  parseOwnerAlertSettings,
  shouldSendOwner,
  withinOwnerCap,
} from "./owner-alerts";

const on = { ...DEFAULT_OWNER_ALERT_SETTINGS, enabled: true, phone: "0771234567" };

describe("parseOwnerAlertSettings", () => {
  const base = { phone: "077 123 4567", lowStockAt: "3", event_new_order: "on" };

  it("accepts a valid form and normalises the number", () => {
    const result = parseOwnerAlertSettings({ ...base, enabled: "on" });
    expect(result).toMatchObject({ ok: true, value: { enabled: true, phone: "0771234567", lowStockAt: 3 } });
    if (result.ok) {
      expect(result.value.events).toEqual({ new_order: true, new_slip: false, low_stock: false, sms_failed: false });
    }
  });
  it("accepts +94 numbers", () => {
    const result = parseOwnerAlertSettings({ ...base, phone: "+94771234567" });
    expect(result).toMatchObject({ ok: true, value: { phone: "0771234567" } });
  });
  it("lets the switch stay off without a number", () => {
    expect(parseOwnerAlertSettings({ lowStockAt: "3" }).ok).toBe(true);
  });
  it("needs a number to switch on", () => {
    const result = parseOwnerAlertSettings({ enabled: "on", lowStockAt: "3" });
    expect(result).toMatchObject({ ok: false });
    if (!result.ok) expect(result.errors.phone).toBeDefined();
  });
  it("rejects a landline or junk number", () => {
    expect(parseOwnerAlertSettings({ ...base, phone: "0112345678" }).ok).toBe(false);
    expect(parseOwnerAlertSettings({ ...base, phone: "abc" }).ok).toBe(false);
  });
  it("checks the low stock threshold", () => {
    for (const lowStockAt of ["", "0", "51", "-1", "2.5", "abc"]) {
      expect(parseOwnerAlertSettings({ ...base, lowStockAt }).ok).toBe(false);
    }
    expect(parseOwnerAlertSettings({ ...base, lowStockAt: "1" }).ok).toBe(true);
    expect(parseOwnerAlertSettings({ ...base, lowStockAt: "50" }).ok).toBe(true);
  });
});

describe("buildOwnerMessage", () => {
  it("describes each event and stays within 2 SMS segments", () => {
    const messages = [
      buildOwnerMessage({ event: "new_order", orderNumber: "NB-10001", total: 1250000, advanceAmount: 0 }),
      buildOwnerMessage({ event: "new_order", orderNumber: "NB-10001", total: 1250000, advanceAmount: 250000 }),
      buildOwnerMessage({ event: "new_slip", orderNumber: "NB-10001" }),
      buildOwnerMessage({ event: "low_stock", productName: "Merino Longsleeve", size: "M", left: 2 }),
      buildOwnerMessage({ event: "sms_failed", orderNumber: "NB-10001", customerEvent: "shipped" }),
    ];
    for (const message of messages) {
      expect(message.startsWith("Northbound:")).toBe(true);
      expect(segmentCount(message)).toBeLessThanOrEqual(2);
    }
    expect(messages[0]).toContain("COD");
    expect(messages[1]).toContain("advance");
  });
  it("keeps a Sinhala or very long product name from breaking the message", () => {
    const sinhala = buildOwnerMessage({ event: "low_stock", productName: "ලස්සන ටී ෂර්ට්", size: "M", left: 1 });
    expect(segmentCount(sinhala)).toBe(1);
    const long = buildOwnerMessage({ event: "low_stock", productName: "x".repeat(300), size: "M", left: 1 });
    expect(segmentCount(long)).toBeLessThanOrEqual(2);
  });
  it("says sold out at zero", () => {
    expect(buildOwnerMessage({ event: "low_stock", productName: "Tee", size: "S", left: 0 })).toContain("sold out");
  });
});

describe("shouldSendOwner", () => {
  const input = { settings: on, event: "new_order" as const, tokenSet: true, senderId: "Northbound" };
  it("sends when everything is set", () => {
    expect(shouldSendOwner(input)).toBe("send");
  });
  it("skips when off, event off, token or sender missing, or number invalid", () => {
    expect(shouldSendOwner({ ...input, settings: { ...on, enabled: false } })).toBe("skip");
    expect(shouldSendOwner({ ...input, settings: { ...on, events: { ...on.events, new_order: false } } })).toBe("skip");
    expect(shouldSendOwner({ ...input, tokenSet: false })).toBe("skip");
    expect(shouldSendOwner({ ...input, senderId: "  " })).toBe("skip");
    expect(shouldSendOwner({ ...input, settings: { ...on, phone: "" } })).toBe("skip");
  });
});

describe("lowStockHits", () => {
  const stock = new Map<string, Record<string, number> | null>([
    ["tee", { S: 10, M: 2, L: 0 }],
    ["hat", null],
  ]);
  const item = (productId: string, size: string) => ({ productId, productName: productId, size });

  it("returns tracked sizes at or under the threshold", () => {
    const hits = lowStockHits([item("tee", "S"), item("tee", "M"), item("tee", "L")], stock, 3);
    expect(hits.map((h) => `${h.size}:${h.left}`)).toEqual(["M:2", "L:0"]);
  });
  it("ignores untracked products, missing sizes and duplicates", () => {
    expect(lowStockHits([item("hat", "M"), item("tee", "XL"), item("nope", "M")], stock, 3)).toEqual([]);
    expect(lowStockHits([item("tee", "M"), item("tee", "M")], stock, 3)).toHaveLength(1);
  });
  it("never goes below zero and caps the number of alerts", () => {
    const many = new Map([["a", { S: -2, M: 1, L: 1, XL: 1 }]]);
    const hits = lowStockHits([item("a", "S"), item("a", "M"), item("a", "L"), item("a", "XL")], many, 3);
    expect(hits).toHaveLength(3);
    expect(hits[0].left).toBe(0);
  });
});

describe("caps and dedupe", () => {
  it("allows alerts under the daily cap only", () => {
    expect(withinOwnerCap(OWNER_DAILY_CAP - 1)).toBe(true);
    expect(withinOwnerCap(OWNER_DAILY_CAP)).toBe(false);
  });
  it("repeats low stock only on a new day", () => {
    expect(ownerDedupe("low_stock", "tee:M", "2026-11-12")).not.toBe(ownerDedupe("low_stock", "tee:M", "2026-11-13"));
    expect(ownerDedupe("new_order", "NB-10001")).toBe("NB-10001");
  });
});
