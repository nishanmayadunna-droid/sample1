import { describe, expect, it } from "vitest";
import {
  NOTIFICATION_EVENTS,
  buildMessage,
  dedupeKey,
  eventForStatus,
  parseNotificationSettings,
  segmentCount,
  shouldSend,
  type MessageData,
  type NotificationEvent,
  type NotificationSettings,
} from "./notifications";
import { formatPrice } from "./products";

const base: MessageData = { orderNumber: "NB-10001", total: 450000 };

describe("buildMessage", () => {
  it("placed shows the order number and total", () => {
    const m = buildMessage("placed", base, "en");
    expect(m).toContain("NB-10001");
    expect(m).toContain(formatPrice(450000));
  });

  it("shipped includes courier, tracking and url; omits http without a url", () => {
    const data: MessageData = {
      ...base,
      courierName: "Pronto",
      trackingNumber: "AB1234",
      trackingUrl: "https://t.example/AB1234",
    };
    const m = buildMessage("shipped", data, "en");
    expect(m).toContain("Pronto");
    expect(m).toContain("AB1234");
    expect(m).toContain("https://t.example/AB1234");
    expect(buildMessage("shipped", { ...data, trackingUrl: null }, "en")).not.toContain("http");
  });

  it("advance_due includes the amount and the Colombo date only when given", () => {
    const withDate = buildMessage(
      "advance_due",
      { ...base, advanceAmount: 100000, payBefore: new Date("2026-11-12T20:00:00Z") },
      "en",
    );
    expect(withDate).toContain(formatPrice(100000));
    expect(withDate).toContain("2026-11-13"); // 20:00Z is 01:30 next day in Colombo
    const without = buildMessage("advance_due", { ...base, advanceAmount: 100000, payBefore: null }, "en");
    expect(without).toContain(formatPrice(100000));
    expect(without).not.toContain("before");
  });

  it("delivered mentions points only when positive", () => {
    expect(buildMessage("delivered", { ...base, pointsEarned: 20 }, "en")).toContain("20");
    expect(buildMessage("delivered", { ...base, pointsEarned: 0 }, "en")).not.toMatch(/point/i);
  });

  it("cancelled mentions the advance only when system cancelled", () => {
    expect(buildMessage("cancelled", { ...base, systemCancelled: true }, "en")).toContain("advance");
    expect(buildMessage("cancelled", base, "en")).not.toContain("advance");
  });

  it("slip_rejected includes the reason", () => {
    expect(buildMessage("slip_rejected", { ...base, rejectReason: "Blurry image" }, "en")).toContain(
      "Blurry image",
    );
  });

  it("stays within 2 segments for every event and language in the worst case", () => {
    const worst: MessageData = {
      orderNumber: "NB-10001",
      total: 999999900,
      advanceAmount: 999999900,
      payBefore: new Date("2026-11-12T20:00:00Z"),
      courierName: "C".repeat(20),
      trackingNumber: "T".repeat(15),
      trackingUrl: "https://t.example/" + "x".repeat(42),
      pointsEarned: 99999,
      systemCancelled: true,
      rejectReason: "r".repeat(200),
    };
    for (const event of NOTIFICATION_EVENTS) {
      for (const lang of ["en", "si"] as const) {
        const m = buildMessage(event, worst, lang);
        expect(segmentCount(m), `${event}/${lang}: ${m}`).toBeLessThanOrEqual(2);
      }
    }
    // The URL is dropped first, keeping courier and tracking number.
    const shipped = buildMessage("shipped", worst, "en");
    expect(shipped).toContain("C".repeat(20));
    expect(shipped).toContain("T".repeat(15));
  });
});

describe("buildMessage fallbacks", () => {
  const ship: MessageData = {
    ...base,
    courierName: "C".repeat(20),
    trackingNumber: "T".repeat(15),
    trackingUrl: "https://t.example/" + "x".repeat(42),
  };

  it("drops a long tracking url in si but keeps courier and tracking number", () => {
    const m = buildMessage("shipped", ship, "si");
    expect(m).not.toContain("http");
    expect(segmentCount(m)).toBeLessThanOrEqual(2);
    expect(m).toContain("C".repeat(20));
    expect(m).toContain("T".repeat(15));
  });

  it("keeps the url when it fits", () => {
    const m = buildMessage("shipped", { ...ship, trackingUrl: "https://t.example/AB" }, "en");
    expect(m).toContain("https://t.example/AB");
  });

  it("truncates a long reject reason with an ellipsis", () => {
    const data: MessageData = { ...base, rejectReason: "r".repeat(400) };
    for (const [lang, ellipsis] of [["en", "..."], ["si", "…"]] as const) {
      const m = buildMessage("slip_rejected", data, lang);
      expect(segmentCount(m)).toBeLessThanOrEqual(2);
      expect(m).toContain("NB-10001");
      expect(m).toContain("r" + ellipsis);
      expect(m).not.toContain("r".repeat(400));
    }
  });
});

describe("segmentCount", () => {
  it("counts GSM-7 and Unicode segments", () => {
    expect(segmentCount("a".repeat(160))).toBe(1);
    expect(segmentCount("a".repeat(161))).toBe(2);
    expect(segmentCount("අ".repeat(70))).toBe(1);
    expect(segmentCount("අ".repeat(71))).toBe(2);
    expect(segmentCount("අ".repeat(134))).toBe(2);
    expect(segmentCount("අ".repeat(135))).toBe(3);
  });
});

describe("shouldSend", () => {
  const settings: NotificationSettings = {
    enabled: true,
    events: Object.fromEntries(NOTIFICATION_EVENTS.map((e) => [e, true])) as Record<
      NotificationEvent,
      boolean
    >,
  };
  const ok = { settings, event: "placed" as const, tokenSet: true, phone: "0771234567", senderId: "NB" };

  it("sends when everything is in place", () => {
    expect(shouldSend(ok)).toBe("send");
  });

  it("skips otherwise", () => {
    expect(shouldSend({ ...ok, settings: { ...settings, enabled: false } })).toBe("skip");
    expect(
      shouldSend({ ...ok, settings: { ...settings, events: { ...settings.events, placed: false } } }),
    ).toBe("skip");
    expect(shouldSend({ ...ok, tokenSet: false })).toBe("skip");
    expect(shouldSend({ ...ok, phone: "" })).toBe("skip");
    expect(shouldSend({ ...ok, phone: "123" })).toBe("skip");
    expect(shouldSend({ ...ok, senderId: "" })).toBe("skip");
  });
});

describe("parseNotificationSettings", () => {
  it("reads checkbox fields", () => {
    const s = parseNotificationSettings({ enabled: "on", event_placed: "on" });
    expect(s.enabled).toBe(true);
    for (const e of NOTIFICATION_EVENTS) expect(s.events[e]).toBe(e === "placed");
  });

  it("treats empty input as everything off", () => {
    const s = parseNotificationSettings({});
    expect(s.enabled).toBe(false);
    for (const e of NOTIFICATION_EVENTS) expect(s.events[e]).toBe(false);
  });
});

describe("dedupeKey", () => {
  it("uses the slip id for slip events only", () => {
    expect(dedupeKey("slip_approved", "abc")).toBe("abc");
    expect(dedupeKey("slip_rejected", "abc")).toBe("abc");
    expect(dedupeKey("placed", "abc")).toBe("");
  });
});

describe("eventForStatus", () => {
  it("maps shipped, delivered and cancelled to their events", () => {
    expect(eventForStatus("shipped")).toBe("shipped");
    expect(eventForStatus("delivered")).toBe("delivered");
    expect(eventForStatus("cancelled")).toBe("cancelled");
  });
  it("sends nothing for confirmed, pending or unknown", () => {
    expect(eventForStatus("confirmed")).toBeNull();
    expect(eventForStatus("pending")).toBeNull();
    expect(eventForStatus("x")).toBeNull();
  });
});
