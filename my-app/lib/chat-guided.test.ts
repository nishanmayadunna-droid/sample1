import { describe, expect, it } from "vitest";
import type { ChatConfig, ChatFacts, ChatTopic } from "./chat";
import { DEFAULT_CONFIG, DEFAULT_TOPICS } from "./chat-defaults";
import {
  answerFor,
  fillFacts,
  greetingFor,
  matchTopics,
  normalize,
  pageContext,
  replyForTopic,
  replyForTopicId,
  visibleTopics,
} from "./chat-guided";

const off = { card: false, advance: false, sms: false, smsLogin: false, email: false, push: false, points: false, notify: false };
const facts = (over: Partial<ChatFacts> = {}): ChatFacts => ({ features: { ...off }, ...over });
const config = (over: Partial<ChatConfig> = {}): ChatConfig => ({ ...DEFAULT_CONFIG, enabled: true, ...over });

const topic = (id: string, keywords: string[], extra: Partial<ChatTopic> = {}): ChatTopic => ({
  id,
  title: { si: id, en: id },
  keywords,
  answer: { si: `${id} si`, en: `${id} en` },
  links: [],
  followUps: [],
  sortOrder: 1,
  visible: true,
  ...extra,
});

describe("normalize", () => {
  it("lowercases, strips punctuation and collapses spaces", () => {
    expect(normalize("  Delivery?! ")).toBe("delivery");
    expect(normalize("Check   OUT,now")).toBe("check out now");
  });
  it("keeps Sinhala letters and joiners intact", () => {
    const word = "ශ්‍රී ලංකා";
    expect(normalize(word)).toBe(word);
  });
});

describe("matchTopics", () => {
  it("finds topics from Singlish, English and Sinhala", () => {
    expect(matchTopics("kohomada checkout karanne", DEFAULT_TOPICS)[0].id).toBe("checkout");
    expect(matchTopics("ගෙවන්නේ කොහොමද", DEFAULT_TOPICS)[0].id).toBe("payment");
    expect(matchTopics("delivery status", DEFAULT_TOPICS)[0].id).toBe("tracking");
    expect(matchTopics("cancel order", DEFAULT_TOPICS)[0].id).toBe("cancel");
  });
  it("matches Latin keywords as whole words only", () => {
    expect(matchTopics("reorder", [topic("a", ["order"])])).toEqual([]);
    expect(matchTopics("my order", [topic("a", ["order"])]).length).toBe(1);
  });
  it("returns nothing for empty or unrelated text and never throws on huge text", () => {
    expect(matchTopics("", DEFAULT_TOPICS)).toEqual([]);
    expect(matchTopics("zzzz", DEFAULT_TOPICS)).toEqual([]);
    expect(() => matchTopics("a".repeat(5000), DEFAULT_TOPICS)).not.toThrow();
  });
});

describe("fillFacts", () => {
  it("fills known facts and drops a sentence with a missing one", () => {
    expect(fillFacts("Call {phone}. Returns in {returnDays} days.", facts({ returnDays: 7 }))).toBe("Returns in 7 days.");
  });
  it("never leaves braces or undefined", () => {
    for (const t of ["{whatsapp}", "{nope}", "Hi {phone} there"]) {
      const out = fillFacts(t, facts());
      expect(out).not.toContain("{");
      expect(out).not.toContain("undefined");
    }
    expect(fillFacts("{whatsapp}", facts())).toBe("");
  });
  it("formats money from cents", () => {
    expect(fillFacts("Fee {shippingFee}.", facts({ shippingFee: 35000 }))).toBe("Fee Rs 350.00.");
  });
  it("keeps a [feature] line only while the feature is on", () => {
    const t = "Always.\n[sms] By SMS.";
    expect(fillFacts(t, facts())).toBe("Always.");
    expect(fillFacts(t, facts({ features: { ...off, sms: true } }))).toBe("Always.\nBy SMS.");
  });
  it("shows a rating only with at least 5 reviews", () => {
    const t = "{reviewCount} reviews, {averageRating} stars.";
    expect(fillFacts(t, facts({ reviewCount: 4, averageRating: 4.5 }))).toBe("");
    expect(fillFacts(t, facts({ reviewCount: 5, averageRating: 4.5 }))).toBe("5 reviews, 4.5 stars.");
  });
  it("treats zero return days as unknown", () => {
    expect(fillFacts("In {returnDays} days.", facts({ returnDays: 0 }))).toBe("");
  });
});

describe("visibleTopics and replies", () => {
  const a = topic("a", ["a"], { followUps: ["b", "c"], sortOrder: 2 });
  const b = topic("b", ["b"], { requires: "points", sortOrder: 1 });
  const c = topic("c", ["c"], { visible: false, sortOrder: 3 });
  it("hides hidden topics and topics whose feature is off, sorted", () => {
    expect(visibleTopics([a, b, c], off).map((t) => t.id)).toEqual(["a"]);
    expect(visibleTopics([a, b, c], { ...off, points: true }).map((t) => t.id)).toEqual(["b", "a"]);
  });
  it("never offers a hidden topic as a follow-up chip", () => {
    const reply = replyForTopic(a, [a, b, c], facts());
    expect(reply.chips).toEqual([]);
    const withPoints = replyForTopic(a, [a, b, c], facts({ features: { ...off, points: true } }));
    expect(withPoints.chips.map((x) => x.id)).toEqual(["b"]);
  });
  it("adds call and WhatsApp links to the contact reply from the shop's details", () => {
    const contact = DEFAULT_TOPICS.find((t) => t.id === "contact")!;
    const reply = replyForTopic(contact, DEFAULT_TOPICS, facts({ phone: "0771234567", whatsapp: "0771234567" }));
    const hrefs = reply.links.map((l) => l.href);
    expect(hrefs.some((h) => h.startsWith("tel:"))).toBe(true);
    expect(hrefs.some((h) => h.startsWith("https://wa.me/"))).toBe(true);
  });
});

describe("answerFor", () => {
  it("answers a clear match with that topic", () => {
    const reply = answerFor("how to checkout", config());
    expect(reply.text.en).toContain("Checking out is easy");
  });
  it("falls back with chips for a Sinhala-only message that matches nothing", () => {
    const reply = answerFor("ඉඉඉ", config());
    expect(reply.chips.length).toBeGreaterThan(0);
    expect(reply.links.map((l) => l.href)).toContain("/contact");
  });
  it("does not throw on empty or huge input", () => {
    expect(() => answerFor("", config())).not.toThrow();
    expect(() => answerFor("x".repeat(5000), config())).not.toThrow();
  });
  it("offers up to 3 chips when two topics tie", () => {
    const cfg = config({ topics: [topic("a", ["alpha"]), topic("b", ["alpha"]), topic("c", ["alpha"]), topic("d", ["alpha"])] });
    const reply = answerFor("alpha", cfg);
    expect(reply.chips.length).toBe(3);
  });
  it("does not answer from a topic whose feature is off", () => {
    const reply = answerFor("points", config());
    expect(reply.text.en).not.toContain("earn points");
  });
});

describe("notifications topic", () => {
  it("is not offered anywhere while the shop sends no notifications", () => {
    const cfg = config();
    expect(greetingFor({ kind: "home" }, cfg).chips.map((c) => c.id)).not.toContain("notifications");
    expect(replyForTopicId("notifications", cfg)).toBeNull();
    const tracking = replyForTopicId("tracking", cfg)!;
    expect(tracking.chips.map((c) => c.id)).not.toContain("notifications");
    expect(answerFor("notifications please", cfg).text.en).not.toContain("keep checking the site");
  });
  it("appears, with only the true channels, once one is on", () => {
    const cfg = config({ facts: { features: { ...off, notify: true, email: true } } });
    expect(greetingFor({ kind: "home" }, cfg).chips.map((c) => c.id)).toContain("notifications");
    const reply = replyForTopicId("notifications", cfg)!;
    expect(reply.text.en).toContain("You also get an email");
    expect(reply.text.en).not.toContain("SMS");
  });
});

describe("trust notes", () => {
  it("are appended to the trust topic only, when the owner wrote some", () => {
    const withNotes = config({ trust: { si: "අපි 2020 සිට", en: "Trading since 2020" } });
    const trustReply = replyForTopicId("trust", withNotes);
    expect(trustReply?.text.en).toContain("Trading since 2020");
    expect(trustReply?.text.si).toContain("අපි 2020 සිට");
    expect(replyForTopicId("delivery", withNotes)?.text.en).not.toContain("Trading since 2020");
    expect(replyForTopicId("trust", config())?.text.en).not.toContain("Trading since");
    expect(answerFor("can i trust you, is it safe", withNotes).text.en).toContain("Trading since 2020");
  });
  it("replyForTopicId is null for an unknown or hidden topic", () => {
    expect(replyForTopicId("nope", config())).toBeNull();
    expect(replyForTopicId("points", config())).toBeNull();
  });
});

describe("pageContext and greetingFor", () => {
  const products = [{ id: "jacket-1", name: "Field Jacket" }];
  it("recognises pages", () => {
    expect(pageContext("/", new URLSearchParams(), products).kind).toBe("home");
    expect(pageContext("/cart", new URLSearchParams(), products).kind).toBe("cart");
    expect(pageContext("/checkout", new URLSearchParams(), products).kind).toBe("checkout");
    expect(pageContext("/orders/NB-10001", new URLSearchParams(), products).kind).toBe("order");
    expect(pageContext("/products/jacket-1", new URLSearchParams(), products)).toMatchObject({
      kind: "product",
      productName: "Field Jacket",
      productId: "jacket-1",
    });
  });
  it("does not throw on a malformed percent sequence in the path", () => {
    expect(() => pageContext("/products/%E0%A4%A", new URLSearchParams(), products)).not.toThrow();
    expect(pageContext("/products/%E0%A4%A", new URLSearchParams(), products).kind).toBe("other");
  });
  it("ignores an unknown product id and cleans utm_source", () => {
    expect(pageContext("/products/ghost", new URLSearchParams(), products).kind).toBe("other");
    expect(pageContext("/", new URLSearchParams("utm_source=Facebook"), products).source).toBe("facebook");
    expect(pageContext("/", new URLSearchParams("utm_source=<script>"), products).source).toBeUndefined();
  });
  it("greets a product page by name with size, delivery and order chips", () => {
    const g = greetingFor({ kind: "product", productName: "Field Jacket" }, config());
    expect(g.text.en).toContain("Field Jacket");
    expect(g.chips.map((c) => c.id)).toEqual(["size-guide", "delivery", "checkout"]);
  });
  it("only offers visible topics as chips", () => {
    const cfg = config({ topics: DEFAULT_TOPICS.filter((t) => t.id !== "delivery") });
    expect(greetingFor({ kind: "cart" }, cfg).chips.map((c) => c.id)).not.toContain("delivery");
  });
});
