// The guided (no-AI) Maya engine. Pure: runs in the browser from the config JSON, so a
// reply costs nothing and there is no endpoint to abuse.
import {
  CHAT_FEATURES,
  isAllowedLink,
  type Bi,
  type ChatConfig,
  type ChatFacts,
  type ChatFeature,
  type ChatLink,
  type ChatReply,
  type ChatTopic,
} from "./chat";
import { formatPrice } from "./products";
import { telHref, whatsappHref } from "./store-contact";

const MAX_INPUT = 300;
const MIN_REVIEWS = 5;

/** Lowercase, punctuation to spaces, spaces collapsed. Sinhala letters and joiners are kept. */
export function normalize(text: string): string {
  return text
    .normalize("NFC")
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}‌‍]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Visible topics (the switch is on and any feature it needs is on), in display order. */
export function visibleTopics(topics: ChatTopic[], features: ChatFacts["features"]): ChatTopic[] {
  return topics
    .filter((t) => t.visible && (!t.requires || features[t.requires]))
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

const LATIN_ONLY = /^[a-z0-9 ]+$/;

function scoreTopic(text: string, topic: ChatTopic): number {
  const padded = ` ${text} `;
  let score = 0;
  for (const raw of topic.keywords) {
    const keyword = normalize(raw);
    if (keyword === "") continue;
    const hit = LATIN_ONLY.test(keyword) ? padded.includes(` ${keyword} `) : text.includes(keyword);
    if (hit) score += keyword.length;
  }
  return score;
}

type Scored = { topic: ChatTopic; score: number };

function scoreAll(rawText: string, topics: ChatTopic[]): Scored[] {
  const text = normalize(rawText.slice(0, MAX_INPUT));
  if (text === "") return [];
  return topics
    .map((topic) => ({ topic, score: scoreTopic(text, topic) }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score || a.topic.sortOrder - b.topic.sortOrder);
}

/** Topics whose keywords appear in the text, best first. Empty when nothing matches. */
export function matchTopics(text: string, topics: ChatTopic[]): ChatTopic[] {
  return scoreAll(text, topics).map((s) => s.topic);
}

function factValue(name: string, facts: ChatFacts): string | null {
  const text = (value: string | undefined) => (value && value.trim() !== "" ? value.trim() : null);
  switch (name) {
    case "shippingFee":
      return facts.shippingFee !== undefined && facts.shippingFee >= 0 ? formatPrice(facts.shippingFee) : null;
    case "freeShippingFrom":
      return facts.freeShippingFrom !== undefined && facts.freeShippingFrom > 0 ? formatPrice(facts.freeShippingFrom) : null;
    case "returnDays":
      return facts.returnDays !== undefined && facts.returnDays > 0 ? String(facts.returnDays) : null;
    case "phone":
      return text(facts.phone);
    case "whatsapp":
      return text(facts.whatsapp);
    case "email":
      return text(facts.email);
    case "reviewCount":
      return facts.reviewCount !== undefined && facts.reviewCount >= MIN_REVIEWS ? String(facts.reviewCount) : null;
    case "averageRating":
      return facts.reviewCount !== undefined &&
        facts.reviewCount >= MIN_REVIEWS &&
        facts.averageRating !== undefined &&
        facts.averageRating > 0
        ? facts.averageRating.toFixed(1)
        : null;
    default:
      return null;
  }
}

const FEATURE_PREFIX = /^\[(\w+)\]\s*/;

/**
 * Fills {facts} into an answer. A sentence that needs a fact that is missing is dropped, and
 * a sentence starting with [feature] is kept only while that feature is on, so Maya never
 * says something the shop cannot back up.
 */
export function fillFacts(template: string, facts: ChatFacts): string {
  const lines: string[] = [];
  for (const line of template.split("\n")) {
    const kept: string[] = [];
    for (const rawSentence of line.split(/(?<=[.!?])\s+/)) {
      let sentence = rawSentence;
      const marker = FEATURE_PREFIX.exec(sentence);
      if (marker) {
        const feature = marker[1] as ChatFeature;
        if (!CHAT_FEATURES.includes(feature) || !facts.features[feature]) continue;
        sentence = sentence.slice(marker[0].length);
      }
      let missing = false;
      const filled = sentence.replace(/\{(\w+)\}/g, (_, name: string) => {
        const value = factValue(name, facts);
        if (value === null) missing = true;
        return value ?? "";
      });
      if (!missing && filled.trim() !== "") kept.push(filled.trim());
    }
    if (kept.length > 0) lines.push(kept.join(" "));
  }
  return lines.join("\n");
}

function chipsFor(ids: string[], visible: ChatTopic[], limit: number) {
  const out: { id: string; label: Bi }[] = [];
  for (const id of ids) {
    const topic = visible.find((t) => t.id === id);
    if (topic && !out.some((c) => c.id === id)) out.push({ id: topic.id, label: topic.title });
    if (out.length >= limit) break;
  }
  return out;
}

/** The reply for one topic: filled answer, allowlisted links and follow-up chips. */
export function replyForTopic(topic: ChatTopic, topics: ChatTopic[], facts: ChatFacts, trust?: Bi): ChatReply {
  let si = fillFacts(topic.answer.si, facts);
  let en = fillFacts(topic.answer.en, facts);
  // The owner's own trust notes belong to the "can I trust this shop" answer only.
  if (topic.id === "trust" && trust) {
    if (trust.si.trim()) si = [si, trust.si.trim()].filter(Boolean).join("\n");
    if (trust.en.trim()) en = [en, trust.en.trim()].filter(Boolean).join("\n");
  }
  const links: ChatLink[] = topic.links.filter((l) => isAllowedLink(l.href));
  if (topic.id === "contact") {
    const tel = facts.phone ? telHref(facts.phone) : null;
    const wa = facts.whatsapp ? whatsappHref(facts.whatsapp) : null;
    if (tel) links.push({ label: { si: "අමතන්න", en: "Call us" }, href: tel });
    if (wa) links.push({ label: { si: "WhatsApp", en: "WhatsApp" }, href: wa });
  }
  const visible = visibleTopics(topics, facts.features);
  return {
    text: { si: si || topic.title.si, en: en || topic.title.en },
    links,
    chips: chipsFor(topic.followUps, visible, 4),
  };
}

/** The reply for a topic picked by id (a quick-reply chip); null when it is unknown or not visible. */
export function replyForTopicId(id: string, config: ChatConfig): ChatReply | null {
  const topic = visibleTopics(config.topics, config.facts.features).find((t) => t.id === id);
  return topic ? replyForTopic(topic, config.topics, config.facts, config.trust) : null;
}

const STARTERS = ["checkout", "payment", "tracking", "notifications", "new-arrivals", "trust"];

function starterChips(visible: ChatTopic[]) {
  const picked = chipsFor(STARTERS, visible, 5);
  if (picked.length > 0) return picked;
  return visible.slice(0, 5).map((t) => ({ id: t.id, label: t.title }));
}

export function fallbackReply(config: ChatConfig): ChatReply {
  const visible = visibleTopics(config.topics, config.facts.features);
  return {
    text: {
      si: "සමාවෙන්න, ඒක මට හරියටම තේරුණේ නෑ. මේවා ගැන අහන්න පුළුවන්:",
      en: "Sorry, I didn't quite get that. You can ask me about:",
    },
    links: [{ label: { si: "අප අමතන්න", en: "Contact us" }, href: "/contact" }],
    chips: starterChips(visible),
  };
}

/** The answer to something the customer typed. */
export function answerFor(text: string, config: ChatConfig): ChatReply {
  const visible = visibleTopics(config.topics, config.facts.features);
  const scored = scoreAll(text, visible);
  if (scored.length === 0) return fallbackReply(config);
  const [top, second] = scored;
  if (!second || top.score >= second.score * 1.5) {
    return replyForTopic(top.topic, config.topics, config.facts, config.trust);
  }
  const close = scored.filter((s) => s.score * 1.5 >= top.score).slice(0, 3);
  return {
    text: { si: "මේවායින් මොකක් ගැනද?", en: "Which of these do you mean?" },
    links: [],
    chips: close.map((s) => ({ id: s.topic.id, label: s.topic.title })),
  };
}

export type PageContext = {
  kind: "home" | "product" | "cart" | "checkout" | "order" | "other";
  productName?: string;
  productId?: string;
  source?: string;
};

/** What the visitor is looking at, from the URL. An unknown product id is ignored. */
export function pageContext(
  pathname: string,
  search: URLSearchParams,
  products: { id: string; name: string }[],
): PageContext {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  const rawSource = (search.get("utm_source") ?? "").trim().toLowerCase();
  const source = /^[a-z0-9_.-]{1,30}$/.test(rawSource) ? rawSource : undefined;
  const base = source ? { source } : {};
  if (path === "/") return { kind: "home", ...base };
  if (path === "/cart") return { kind: "cart", ...base };
  if (path === "/checkout") return { kind: "checkout", ...base };
  if (path.startsWith("/orders/")) return { kind: "order", ...base };
  const product = /^\/products\/([^/]+)$/.exec(path);
  if (product) {
    const found = products.find((p) => p.id === decodeURIComponent(product[1]));
    if (found) return { kind: "product", productName: found.name.slice(0, 60), productId: found.id, ...base };
  }
  return { kind: "other", ...base };
}

/** The opening line and quick-reply chips for the page the visitor is on. */
export function greetingFor(ctx: PageContext, config: ChatConfig) {
  const visible = visibleTopics(config.topics, config.facts.features);
  switch (ctx.kind) {
    case "product":
      return {
        text: {
          si: `${ctx.productName} ගැන දැනගන්න ඕනද?`,
          en: `Want to know about ${ctx.productName}?`,
        },
        chips: chipsFor(["size-guide", "delivery", "checkout"], visible, 3),
      };
    case "cart":
    case "checkout":
      return { text: config.firstMessage, chips: chipsFor(["payment", "delivery", "trust"], visible, 3) };
    case "order":
      return { text: config.firstMessage, chips: chipsFor(["tracking", "cancel", "contact"], visible, 3) };
    default:
      return { text: config.firstMessage, chips: starterChips(visible) };
  }
}
