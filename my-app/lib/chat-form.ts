// Admin form rules for /admin/chat. Pure: errors are codes, never free text.
import {
  CHAT_FEATURES,
  DEFAULT_ACCENT,
  isAllowedLink,
  type ChatFeature,
  type ChatLink,
  type ChatTopic,
} from "./chat";

export type ChatSettingsRow = {
  enabled: boolean;
  engine: "guided" | "ai";
  assistant_name: string;
  accent: string;
  show_bubble: boolean;
  greeting_si: string;
  greeting_en: string;
  first_message_si: string;
  first_message_en: string;
  trust_si: string;
  trust_en: string;
  // The AI fields are absent when the form's AI section was greyed out (disabled controls are not
  // sent), and then the stored values are kept.
  ai_model?: string;
  ai_guest_per_minute?: number;
  ai_guest_per_day?: number;
  ai_user_per_minute?: number;
  ai_user_per_day?: number;
  ai_shop_daily_cap?: number;
  ai_max_message_chars?: number;
  ai_max_reply_tokens?: number;
};

export type FormResult<T> = { ok: true; value: T } | { ok: false; errors: string[] };

const text = (fd: FormData, name: string, max: number) => {
  const raw = fd.get(name);
  return typeof raw === "string" ? raw.trim().slice(0, max) : "";
};

/** A whole-number field that may be absent (undefined = keep the stored value); present but invalid is an error. */
const limit = (fd: FormData, name: string, min: number, max: number, errors: string[]): number | undefined => {
  if (!fd.has(name)) return undefined;
  const raw = fd.get(name);
  const value = typeof raw === "string" && /^\d{1,6}$/.test(raw.trim()) ? Number(raw.trim()) : NaN;
  if (!Number.isInteger(value) || value < min || value > max) {
    errors.push(name);
    return undefined;
  }
  return value;
};

/** The settings form. The AI engine can only be chosen while the server has a model key. */
export function parseChatSettingsForm(fd: FormData, ctx: { aiKeySet: boolean }): FormResult<ChatSettingsRow> {
  const errors: string[] = [];
  const enabled = fd.get("enabled") === "on";
  const engine = fd.get("engine") === "ai" ? "ai" : "guided";
  if (engine === "ai" && !ctx.aiKeySet) errors.push("ai_key_missing");

  const assistantName = text(fd, "assistant_name", 40);
  if (assistantName === "") errors.push("assistant_name");

  const accentRaw = text(fd, "accent", 7);
  const accent = accentRaw === "" ? DEFAULT_ACCENT : accentRaw;
  if (!/^#[0-9a-fA-F]{6}$/.test(accent)) errors.push("accent");

  const model = fd.has("ai_model") ? text(fd, "ai_model", 80) : undefined;
  if (model === "") errors.push("ai_model");

  const value: ChatSettingsRow = {
    enabled,
    engine,
    assistant_name: assistantName,
    accent,
    show_bubble: fd.get("show_bubble") === "on",
    greeting_si: text(fd, "greeting_si", 120),
    greeting_en: text(fd, "greeting_en", 120),
    first_message_si: text(fd, "first_message_si", 300),
    first_message_en: text(fd, "first_message_en", 300),
    trust_si: text(fd, "trust_si", 600),
    trust_en: text(fd, "trust_en", 600),
    ai_model: model,
    ai_guest_per_minute: limit(fd, "ai_guest_per_minute", 1, 100000, errors),
    ai_guest_per_day: limit(fd, "ai_guest_per_day", 1, 100000, errors),
    ai_user_per_minute: limit(fd, "ai_user_per_minute", 1, 100000, errors),
    ai_user_per_day: limit(fd, "ai_user_per_day", 1, 100000, errors),
    ai_shop_daily_cap: limit(fd, "ai_shop_daily_cap", 1, 100000, errors),
    ai_max_message_chars: limit(fd, "ai_max_message_chars", 50, 2000, errors),
    ai_max_reply_tokens: limit(fd, "ai_max_reply_tokens", 50, 2000, errors),
  };
  // Leave out the AI fields that were not sent, so a save never overwrites them with nothing.
  for (const key of Object.keys(value) as (keyof ChatSettingsRow)[]) {
    if (value[key] === undefined) delete value[key];
  }
  return errors.length > 0 ? { ok: false, errors } : { ok: true, value };
}

/** One link per line: `/path|Sinhala label|English label`. */
function parseLinkLines(raw: string): ChatLink[] | null {
  const links: ChatLink[] = [];
  for (const line of raw.split("\n").map((l) => l.trim()).filter(Boolean)) {
    const [href, si, en] = line.split("|").map((p) => p.trim());
    if (!href || !si || !en || !isAllowedLink(href) || si.length > 60 || en.length > 60) return null;
    links.push({ label: { si, en }, href });
  }
  return links.length <= 4 ? links : null;
}

/** A topic from the admin form: keywords split on commas/lines, links on lines, follow-ups on commas. */
export function parseTopicForm(fd: FormData): FormResult<ChatTopic> {
  const errors: string[] = [];
  const id = text(fd, "id", 40);
  if (!/^[a-z0-9-]{1,40}$/.test(id)) errors.push("id");

  const titleSi = text(fd, "title_si", 80);
  const titleEn = text(fd, "title_en", 80);
  if (!titleSi || !titleEn) errors.push("title");
  const answerSi = text(fd, "answer_si", 600);
  const answerEn = text(fd, "answer_en", 600);
  if (!answerSi || !answerEn) errors.push("answer");

  const keywords = text(fd, "keywords", 2000)
    .split(/[,\n]/)
    .map((k) => k.trim().toLowerCase())
    .filter((k) => k !== "" && k.length <= 40)
    .slice(0, 40);
  if (keywords.length === 0) errors.push("keywords");

  const links = parseLinkLines(text(fd, "links", 1000));
  if (links === null) errors.push("links");

  const followUps = text(fd, "follow_ups", 400)
    .split(/[,\n]/)
    .map((f) => f.trim())
    .filter(Boolean);
  if (followUps.length > 4 || followUps.some((f) => !/^[a-z0-9-]{1,40}$/.test(f))) errors.push("follow_ups");

  const requiresRaw = text(fd, "requires", 20);
  let requires: ChatFeature | undefined;
  if (requiresRaw !== "") {
    if (CHAT_FEATURES.includes(requiresRaw as ChatFeature)) requires = requiresRaw as ChatFeature;
    else errors.push("requires");
  }

  const sortRaw = text(fd, "sort_order", 6);
  const sortOrder = sortRaw === "" ? 0 : Number(sortRaw);
  if (!Number.isInteger(sortOrder) || sortOrder < 0 || sortOrder > 100000) errors.push("sort_order");

  if (errors.length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: {
      id,
      title: { si: titleSi, en: titleEn },
      keywords,
      answer: { si: answerSi, en: answerEn },
      links: links ?? [],
      followUps,
      requires,
      sortOrder,
      visible: fd.get("visible") === "on",
    },
  };
}
