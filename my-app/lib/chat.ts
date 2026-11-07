// Maya chat: shared types and pure parsing. No I/O, safe in client components.

export type Bi = { si: string; en: string };
/**
 * What a topic or sentence can depend on. `sms` is the order-SMS switch, `smsLogin` is phone sign-in,
 * and `notify` is true when the shop sends customers any notification at all (order SMS, email or push).
 */
export type ChatFeature = "card" | "advance" | "sms" | "smsLogin" | "email" | "push" | "points" | "notify";
export const CHAT_FEATURES: readonly ChatFeature[] = ["card", "advance", "sms", "smsLogin", "email", "push", "points", "notify"];

export type ChatLink = { label: Bi; href: string };

export type ChatTopic = {
  id: string;
  title: Bi;
  keywords: string[];
  answer: Bi;
  links: ChatLink[];
  followUps: string[];
  requires?: ChatFeature;
  sortOrder: number;
  visible: boolean;
};

export type ChatFacts = {
  /** Cents. */
  shippingFee?: number;
  /** Cents; only set while a running promotion offers shop-wide free shipping. */
  freeShippingFrom?: number;
  returnDays?: number;
  phone?: string;
  whatsapp?: string;
  email?: string;
  /** Only set when there are enough approved reviews to mean something. */
  reviewCount?: number;
  averageRating?: number;
  features: Record<ChatFeature, boolean>;
};

export type ChatConfig = {
  enabled: boolean;
  engine: "guided" | "ai";
  assistantName: string;
  mascotUrl: string | null;
  greeting: Bi;
  firstMessage: Bi;
  accent: string;
  showBubble: boolean;
  trust: Bi;
  topics: ChatTopic[];
  facts: ChatFacts;
};

export type ChatReply = {
  text: Bi;
  links: ChatLink[];
  chips: { id: string; label: Bi }[];
};

export type AiSettings = {
  model: string;
  guestPerMinute: number;
  guestPerDay: number;
  userPerMinute: number;
  userPerDay: number;
  shopDailyCap: number;
  maxMessageChars: number;
  maxReplyTokens: number;
};

export const DEFAULT_AI_SETTINGS: AiSettings = {
  model: "claude-haiku-5-5",
  guestPerMinute: 5,
  guestPerDay: 30,
  userPerMinute: 10,
  userPerDay: 100,
  shopDailyCap: 2000,
  maxMessageChars: 500,
  maxReplyTokens: 400,
};

export const DEFAULT_ACCENT = "#d9531e";
export const DEFAULT_ASSISTANT_NAME = "Maya";
export const DEFAULT_GREETING: Bi = {
  si: "Hi Madam/Sir! කොහොමද ඔයාට?",
  en: "Hi there! How can I help?",
};
export const DEFAULT_FIRST_MESSAGE: Bi = {
  si: "Hi! මොකක් ගැනද දැනගන්න ඕන?",
  en: "Hi! What would you like to know?",
};

/** The chat's accent: the shop's accent unless the owner picked a colour of their own for the chat. */
export function chatAccent(chatSetting: string, shopAccent: string): string {
  return /^#[0-9a-fA-F]{6}$/.test(chatSetting) && chatSetting.toLowerCase() !== DEFAULT_ACCENT ? chatSetting : shopAccent;
}

/** Internal paths a topic (or the AI, by id) may link to. Nothing else is ever rendered as a link. */
export const LINK_ALLOWLIST: readonly string[] = [
  "/cart",
  "/checkout",
  "/orders",
  "/account",
  "/returns",
  "/size-guide",
  "/contact",
  "/about",
  "/privacy",
  "/terms",
  "/products?view=new",
  "/products?view=deals",
  "/products?view=picks",
];

export function isAllowedLink(href: string): boolean {
  return typeof href === "string" && LINK_ALLOWLIST.includes(href);
}

export const MASCOT_MAX_BYTES = 1_048_576;
const MASCOT_TYPES = ["image/png", "image/webp", "image/jpeg"];

/** PNG / WebP / JPEG up to 1 MB. SVG is refused on purpose (it can carry script). */
export function isValidMascot(type: string, size: number): boolean {
  return MASCOT_TYPES.includes(type) && Number.isInteger(size) && size > 0 && size <= MASCOT_MAX_BYTES;
}

export function isValidMascotPath(path: string): boolean {
  return typeof path === "string" && /^\d{10,16}\.(png|webp|jpg|jpeg)$/.test(path);
}

/** The chat is not shown in the admin, on the sign-in page or on print pages. */
export function chatVisibleOn(pathname: string): boolean {
  if (pathname === "/admin" || pathname.startsWith("/admin/")) return false;
  if (pathname === "/signin" || pathname.startsWith("/signin/")) return false;
  if (pathname.endsWith("/print")) return false;
  return true;
}

function str(value: unknown, max: number, fallback = ""): string {
  return typeof value === "string" ? value.trim().slice(0, max) : fallback;
}

function bi(si: unknown, en: unknown, max: number, fallback: Bi = { si: "", en: "" }): Bi {
  return { si: str(si, max, fallback.si) || fallback.si, en: str(en, max, fallback.en) || fallback.en };
}

function int(value: unknown, min: number, max: number, fallback: number): number {
  return typeof value === "number" && Number.isInteger(value) && value >= min && value <= max ? value : fallback;
}

type Row = Record<string, unknown>;
const asRow = (value: unknown): Row => (typeof value === "object" && value !== null ? (value as Row) : {});

export type ParsedChatSettings = {
  enabled: boolean;
  engine: "guided" | "ai";
  assistantName: string;
  mascotPath: string | null;
  greeting: Bi;
  firstMessage: Bi;
  accent: string;
  showBubble: boolean;
  trust: Bi;
  ai: AiSettings;
};

/** Reads the one `chat_settings` row. A missing or odd row means off, guided and defaults. */
export function parseChatSettings(input: unknown): ParsedChatSettings {
  const row = asRow(input);
  const d = DEFAULT_AI_SETTINGS;
  const mascot = typeof row.mascot_path === "string" && isValidMascotPath(row.mascot_path) ? row.mascot_path : null;
  return {
    enabled: row.enabled === true,
    engine: row.engine === "ai" ? "ai" : "guided",
    assistantName: str(row.assistant_name, 40, DEFAULT_ASSISTANT_NAME) || DEFAULT_ASSISTANT_NAME,
    mascotPath: mascot,
    greeting: bi(row.greeting_si, row.greeting_en, 120, DEFAULT_GREETING),
    firstMessage: bi(row.first_message_si, row.first_message_en, 300, DEFAULT_FIRST_MESSAGE),
    accent: typeof row.accent === "string" && /^#[0-9a-f]{6}$/i.test(row.accent) ? row.accent : DEFAULT_ACCENT,
    showBubble: row.show_bubble !== false,
    trust: bi(row.trust_si, row.trust_en, 600),
    ai: {
      model: str(row.ai_model, 80, d.model) || d.model,
      guestPerMinute: int(row.ai_guest_per_minute, 1, 100000, d.guestPerMinute),
      guestPerDay: int(row.ai_guest_per_day, 1, 100000, d.guestPerDay),
      userPerMinute: int(row.ai_user_per_minute, 1, 100000, d.userPerMinute),
      userPerDay: int(row.ai_user_per_day, 1, 100000, d.userPerDay),
      shopDailyCap: int(row.ai_shop_daily_cap, 1, 100000, d.shopDailyCap),
      maxMessageChars: int(row.ai_max_message_chars, 50, 2000, d.maxMessageChars),
      maxReplyTokens: int(row.ai_max_reply_tokens, 50, 2000, d.maxReplyTokens),
    },
  };
}

function parseLinks(value: unknown): ChatLink[] | null {
  if (value === null || value === undefined) return [];
  if (!Array.isArray(value) || value.length > 4) return null;
  const links: ChatLink[] = [];
  for (const item of value) {
    const link = asRow(item);
    const label = asRow(link.label);
    const href = typeof link.href === "string" ? link.href : "";
    if (!isAllowedLink(href)) return null;
    const parsed = bi(label.si, label.en, 60);
    if (!parsed.si || !parsed.en) return null;
    links.push({ label: parsed, href });
  }
  return links;
}

/** One `chat_topics` row, or null when it breaks a rule (so a bad row never reaches a customer). */
export function parseTopicRow(input: unknown): ChatTopic | null {
  const row = asRow(input);
  const id = typeof row.id === "string" && /^[a-z0-9-]{1,40}$/.test(row.id) ? row.id : null;
  if (!id) return null;
  const title = bi(row.title_si, row.title_en, 80);
  const answer = bi(row.answer_si, row.answer_en, 600);
  if (!title.si || !title.en || !answer.si || !answer.en) return null;
  if (!Array.isArray(row.keywords)) return null;
  const keywords = row.keywords
    .filter((k): k is string => typeof k === "string")
    .map((k) => k.trim().toLowerCase())
    .filter((k) => k.length > 0 && k.length <= 40)
    .slice(0, 40);
  if (keywords.length === 0) return null;
  const links = parseLinks(row.links);
  if (!links) return null;
  const followUps = Array.isArray(row.follow_ups)
    ? row.follow_ups.filter((f): f is string => typeof f === "string" && /^[a-z0-9-]{1,40}$/.test(f)).slice(0, 4)
    : [];
  let requires: ChatFeature | undefined;
  if (row.requires !== null && row.requires !== undefined) {
    if (typeof row.requires !== "string" || !CHAT_FEATURES.includes(row.requires as ChatFeature)) return null;
    requires = row.requires as ChatFeature;
  }
  return {
    id,
    title,
    keywords,
    answer,
    links,
    followUps,
    requires,
    sortOrder: int(row.sort_order, 0, 100000, 0),
    visible: row.visible !== false,
  };
}
