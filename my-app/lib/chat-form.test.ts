import { describe, expect, it } from "vitest";
import { parseChatSettingsForm, parseTopicForm } from "./chat-form";

function form(entries: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(entries)) fd.set(k, v);
  return fd;
}

const base = {
  enabled: "on",
  engine: "guided",
  assistant_name: "Maya",
  accent: "#d9531e",
  show_bubble: "on",
  greeting_si: "Hi",
  greeting_en: "Hi",
  first_message_si: "Hi",
  first_message_en: "Hi",
  trust_si: "",
  trust_en: "",
  ai_model: "claude-haiku-5-5",
  ai_guest_per_minute: "5",
  ai_guest_per_day: "30",
  ai_user_per_minute: "10",
  ai_user_per_day: "100",
  ai_shop_daily_cap: "2000",
  ai_max_message_chars: "500",
  ai_max_reply_tokens: "400",
};

describe("parseChatSettingsForm", () => {
  it("accepts a good form", () => {
    const r = parseChatSettingsForm(form(base), { aiKeySet: false });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.enabled).toBe(true);
      expect(r.value.engine).toBe("guided");
      expect(r.value.ai_guest_per_minute).toBe(5);
    }
  });
  it("refuses the AI engine without a key", () => {
    const r = parseChatSettingsForm(form({ ...base, engine: "ai" }), { aiKeySet: false });
    expect(r).toEqual({ ok: false, errors: ["ai_key_missing"] });
    expect(parseChatSettingsForm(form({ ...base, engine: "ai" }), { aiKeySet: true }).ok).toBe(true);
  });
  it("refuses an enabled chat with an empty name", () => {
    const r = parseChatSettingsForm(form({ ...base, assistant_name: "  " }), { aiKeySet: false });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors).toContain("assistant_name");
  });
  it("checks the accent colour and limit ranges, returning codes only", () => {
    const r = parseChatSettingsForm(
      form({ ...base, accent: "red", ai_guest_per_minute: "0", ai_shop_daily_cap: "100001", ai_max_message_chars: "abc" }),
      { aiKeySet: false },
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors).toEqual(expect.arrayContaining(["accent", "ai_guest_per_minute", "ai_shop_daily_cap", "ai_max_message_chars"]));
      for (const code of r.errors) expect(code).toMatch(/^[a-z_]+$/);
    }
  });
});

const topicBase = {
  id: "checkout",
  title_si: "ගෙවීම",
  title_en: "Checkout",
  keywords: "checkout, order\nbuy",
  answer_si: "පිළිතුර",
  answer_en: "Answer",
  links: "/cart|කරත්තය|Cart",
  follow_ups: "payment, delivery",
  requires: "",
  sort_order: "10",
  visible: "on",
};

describe("parseTopicForm", () => {
  it("parses keywords, links and follow-ups from text fields", () => {
    const r = parseTopicForm(form(topicBase));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.keywords).toEqual(["checkout", "order", "buy"]);
      expect(r.value.links).toEqual([{ label: { si: "කරත්තය", en: "Cart" }, href: "/cart" }]);
      expect(r.value.followUps).toEqual(["payment", "delivery"]);
      expect(r.value.requires).toBeUndefined();
    }
  });
  it("refuses a link that is not allowlisted", () => {
    const r = parseTopicForm(form({ ...topicBase, links: "https://evil.test|x|x" }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors).toContain("links");
  });
  it("refuses a topic with no keywords, a bad id or an unknown requires", () => {
    for (const [patch, code] of [
      [{ keywords: " , " }, "keywords"],
      [{ id: "Bad Id" }, "id"],
      [{ requires: "teleport" }, "requires"],
    ] as const) {
      const r = parseTopicForm(form({ ...topicBase, ...patch }));
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.errors).toContain(code);
    }
  });
});
