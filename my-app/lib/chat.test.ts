import { describe, expect, it } from "vitest";
import {
  DEFAULT_AI_SETTINGS,
  chatVisibleOn,
  isAllowedLink,
  isValidMascot,
  isValidMascotPath,
  parseChatSettings,
  parseTopicRow,
} from "./chat";

const goodTopic = {
  id: "checkout",
  title_si: "ගෙවීම",
  title_en: "Checkout",
  keywords: ["checkout", "order"],
  answer_si: "පිළිතුර",
  answer_en: "Answer",
  links: [{ label: { si: "කරත්තය", en: "Cart" }, href: "/cart" }],
  follow_ups: ["payment"],
  requires: null,
  sort_order: 1,
  visible: true,
};

describe("isAllowedLink", () => {
  it("accepts internal allowlisted paths", () => {
    expect(isAllowedLink("/checkout")).toBe(true);
    expect(isAllowedLink("/products?view=new")).toBe(true);
  });
  it("rejects everything else", () => {
    for (const bad of ["https://evil.test", "//evil.test", "/admin", "javascript:alert(1)", "", "/checkout/../admin"]) {
      expect(isAllowedLink(bad)).toBe(false);
    }
  });
});

describe("mascot rules", () => {
  it("refuses SVG, oversize and unknown types", () => {
    expect(isValidMascot("image/svg+xml", 100)).toBe(false);
    expect(isValidMascot("image/png", 1048577)).toBe(false);
    expect(isValidMascot("image/gif", 100)).toBe(false);
  });
  it("accepts png/webp/jpeg up to 1 MB", () => {
    expect(isValidMascot("image/webp", 1048576)).toBe(true);
    expect(isValidMascot("image/png", 1)).toBe(true);
    expect(isValidMascot("image/jpeg", 500)).toBe(true);
  });
  it("checks storage paths", () => {
    expect(isValidMascotPath("1700000000000.png")).toBe(true);
    expect(isValidMascotPath("1700000000000.jpeg")).toBe(true);
    expect(isValidMascotPath("../x.png")).toBe(false);
    expect(isValidMascotPath("1700000000000.svg")).toBe(false);
  });
});

describe("parseChatSettings", () => {
  it("is off and guided for a missing row", () => {
    const s = parseChatSettings(null);
    expect(s.enabled).toBe(false);
    expect(s.engine).toBe("guided");
    expect(s.ai).toEqual(DEFAULT_AI_SETTINGS);
  });
  it("falls back for a bogus engine and out-of-range limits", () => {
    const s = parseChatSettings({ enabled: true, engine: "bogus", ai_guest_per_minute: 0, ai_shop_daily_cap: 999999999 });
    expect(s.engine).toBe("guided");
    expect(s.ai.guestPerMinute).toBe(DEFAULT_AI_SETTINGS.guestPerMinute);
    expect(s.ai.shopDailyCap).toBe(DEFAULT_AI_SETTINGS.shopDailyCap);
  });
  it("keeps valid values and rejects a bad accent", () => {
    const s = parseChatSettings({ enabled: true, engine: "ai", assistant_name: "Kasun", accent: "#112233", ai_guest_per_minute: 7 });
    expect(s.enabled).toBe(true);
    expect(s.engine).toBe("ai");
    expect(s.assistantName).toBe("Kasun");
    expect(s.accent).toBe("#112233");
    expect(s.ai.guestPerMinute).toBe(7);
    expect(parseChatSettings({ accent: "red; x" }).accent).toBe("#d9531e");
  });
});

describe("parseTopicRow", () => {
  it("parses a good row", () => {
    const t = parseTopicRow(goodTopic);
    expect(t?.id).toBe("checkout");
    expect(t?.links[0].href).toBe("/cart");
    expect(t?.followUps).toEqual(["payment"]);
  });
  it("rejects a non-allowlisted link, empty keywords or an unknown requires", () => {
    expect(parseTopicRow({ ...goodTopic, links: [{ label: { si: "x", en: "x" }, href: "https://evil.test" }] })).toBeNull();
    expect(parseTopicRow({ ...goodTopic, keywords: [] })).toBeNull();
    expect(parseTopicRow({ ...goodTopic, requires: "teleport" })).toBeNull();
    expect(parseTopicRow(null)).toBeNull();
  });
});

describe("chatVisibleOn", () => {
  it("hides on admin, signin and print pages", () => {
    expect(chatVisibleOn("/admin/chat")).toBe(false);
    expect(chatVisibleOn("/signin")).toBe(false);
    expect(chatVisibleOn("/orders/NB-1/print")).toBe(false);
    expect(chatVisibleOn("/admin/orders/NB-1/print")).toBe(false);
  });
  it("shows on storefront pages", () => {
    expect(chatVisibleOn("/")).toBe(true);
    expect(chatVisibleOn("/products/x")).toBe(true);
    expect(chatVisibleOn("/checkout")).toBe(true);
  });
});
