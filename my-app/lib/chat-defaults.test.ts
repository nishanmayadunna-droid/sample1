import { describe, expect, it } from "vitest";
import { isAllowedLink } from "./chat";
import { DEFAULT_CONFIG, DEFAULT_TOPICS } from "./chat-defaults";

const KNOWN_PLACEHOLDERS = [
  "shippingFee",
  "freeShippingFrom",
  "returnDays",
  "phone",
  "whatsapp",
  "email",
  "reviewCount",
  "averageRating",
];

describe("default topics", () => {
  it("has the starter set with unique ids", () => {
    const ids = DEFAULT_TOPICS.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of [
      "checkout", "payment", "payment-card", "advance", "delivery", "tracking", "notifications",
      "new-arrivals", "returns", "size-guide", "cancel", "points", "account", "trust", "contact",
    ]) {
      expect(ids).toContain(id);
    }
  });

  it("is bilingual with at least 3 keywords each", () => {
    for (const t of DEFAULT_TOPICS) {
      expect(t.title.si, t.id).not.toBe("");
      expect(t.title.en, t.id).not.toBe("");
      expect(t.answer.si, t.id).not.toBe("");
      expect(t.answer.en, t.id).not.toBe("");
      expect(t.keywords.length, t.id).toBeGreaterThanOrEqual(3);
    }
  });

  it("links only to allowlisted paths and follows up only to real other topics", () => {
    const ids = new Set(DEFAULT_TOPICS.map((t) => t.id));
    for (const t of DEFAULT_TOPICS) {
      for (const l of t.links) expect(isAllowedLink(l.href), `${t.id} ${l.href}`).toBe(true);
      for (const f of t.followUps) {
        expect(ids.has(f), `${t.id} -> ${f}`).toBe(true);
        expect(f).not.toBe(t.id);
      }
    }
  });

  it("uses only known placeholders", () => {
    for (const t of DEFAULT_TOPICS) {
      for (const text of [t.answer.si, t.answer.en]) {
        for (const m of text.matchAll(/\{(\w+)\}/g)) expect(KNOWN_PLACEHOLDERS, `${t.id} {${m[1]}}`).toContain(m[1]);
        for (const m of text.matchAll(/^\[(\w+)\]/gm)) expect(["card", "advance", "sms", "smsLogin", "email", "push", "points", "notify"]).toContain(m[1]);
      }
    }
  });

  it("never invents urgency or promises new-arrival alerts", () => {
    for (const t of DEFAULT_TOPICS) {
      for (const text of [t.answer.en.toLowerCase(), t.answer.si]) {
        expect(text).not.toMatch(/only\s*\d/);
        expect(text).not.toContain("new arrival notification");
        expect(text).not.toContain("ඉක්මනින්ම අවසන්");
        expect(text).not.toMatch(/notified (about|when) new/);
      }
    }
    const arrivals = DEFAULT_TOPICS.find((t) => t.id === "new-arrivals")!;
    expect(arrivals.links.map((l) => l.href)).toContain("/products?view=new");
  });

  it("gates feature topics", () => {
    const byId = Object.fromEntries(DEFAULT_TOPICS.map((t) => [t.id, t]));
    expect(byId["points"].requires).toBe("points");
    expect(byId["advance"].requires).toBe("advance");
    expect(byId["payment-card"].requires).toBe("card");
    // Only worth showing when the shop really sends customers some kind of notification.
    expect(byId["notifications"].requires).toBe("notify");
  });

  it("keeps the SMS claims on the right switch and the trust answer honest about advances", () => {
    const byId = Object.fromEntries(DEFAULT_TOPICS.map((t) => [t.id, t]));
    // Order SMS ([sms]) is not phone sign-in ([smsLogin]).
    expect(byId["account"].answer.en).toContain("[smsLogin]");
    expect(byId["account"].answer.en).not.toContain("[sms]");
    expect(byId["notifications"].answer.en).toContain("[sms]");
    const trust = byId["trust"].answer.en;
    expect(trust).not.toMatch(/risk/i);
    expect(trust).toContain("[advance]");
    expect(byId["trust"].answer.si).toContain("[advance]");
  });
});

describe("default config", () => {
  it("is off, guided and uses the defaults", () => {
    expect(DEFAULT_CONFIG.enabled).toBe(false);
    expect(DEFAULT_CONFIG.engine).toBe("guided");
    expect(DEFAULT_CONFIG.assistantName).toBe("Maya");
    expect(DEFAULT_CONFIG.topics).toBe(DEFAULT_TOPICS);
    expect(Object.values(DEFAULT_CONFIG.facts.features).every((v) => v === false)).toBe(true);
  });
});
