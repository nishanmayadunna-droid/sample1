// Validation for the /admin/promotions form. Pure and tested.
import type { RuleKind, RuleScope } from "./promotions";

export const MAX_RULES = 10;
export const MAX_AMOUNT_CENTS = 100_000_000; // Rs 1,000,000
const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const COLOR_PATTERN = /^#[0-9a-f]{6}$/;
const LOCAL_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;
// Sri Lanka is UTC+05:30 all year (no daylight saving).
const COLOMBO_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;
const RULE_KINDS: readonly RuleKind[] = ["free_shipping", "percent_off", "amount_off_item", "amount_off_order"];
const RULE_SCOPES: readonly RuleScope[] = ["all", "categories", "products"];

/** A `datetime-local` value in Colombo time → ISO UTC, or null. */
export function colomboToUtcIso(local: string): string | null {
  const m = LOCAL_PATTERN.exec(local.trim());
  if (!m) return null;
  const [year, month, day, hour, minute] = m.slice(1).map(Number);
  const utc = Date.UTC(year, month - 1, day, hour, minute) - COLOMBO_OFFSET_MS;
  const check = new Date(utc + COLOMBO_OFFSET_MS);
  // Reject dates that rolled over (e.g. month 13, 31 November).
  if (check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day || hour > 23 || minute > 59) {
    return null;
  }
  return new Date(utc).toISOString();
}

/** ISO UTC → the `datetime-local` value in Colombo time. */
export function utcIsoToColombo(iso: string): string {
  return new Date(Date.parse(iso) + COLOMBO_OFFSET_MS).toISOString().slice(0, 16);
}

/** Rupees ("500", "12.50") → cents, or null. Allows 0. */
function rupeesToCents(raw: unknown): number | null {
  if (typeof raw !== "string") return null;
  const m = /^(\d+)(?:\.(\d{1,2}))?$/.exec(raw.trim());
  if (!m) return null;
  return Number(m[1]) * 100 + Number((m[2] ?? "").padEnd(2, "0"));
}

const stringList = (raw: unknown): string[] =>
  Array.isArray(raw) ? raw.filter((v): v is string => typeof v === "string" && v.length > 0) : [];

export type RuleInput = {
  kind: RuleKind;
  value: number;
  scope: RuleScope;
  category_slugs: string[];
  product_ids: string[];
  min_subtotal: number;
};

/** One rule row from the rules editor (value and minimum in rupees, or % for percent_off). */
export function parseRule(raw: unknown): { ok: true; value: RuleInput } | { ok: false; error: string } {
  if (typeof raw !== "object" || raw === null) return { ok: false, error: "Invalid rule." };
  const r = raw as Record<string, unknown>;
  const kind = RULE_KINDS.find((k) => k === r.kind);
  if (!kind) return { ok: false, error: "Choose what the rule does." };
  const scope = RULE_SCOPES.find((s) => s === r.scope);
  if (!scope) return { ok: false, error: "Choose what the rule applies to." };

  let value = 0;
  if (kind === "percent_off") {
    const percent = typeof r.value === "string" && /^\d+$/.test(r.value.trim()) ? Number(r.value) : NaN;
    if (!(percent >= 1 && percent <= 90)) return { ok: false, error: "Percent off must be 1–90." };
    value = percent;
  } else if (kind !== "free_shipping") {
    const cents = rupeesToCents(r.value);
    if (cents === null || cents <= 0 || cents > MAX_AMOUNT_CENTS) {
      return { ok: false, error: "Enter an amount between Rs 0.01 and Rs 1,000,000." };
    }
    value = cents;
  }

  const categorySlugs = scope === "categories" ? stringList(r.categorySlugs) : [];
  const productIds = scope === "products" ? stringList(r.productIds) : [];
  if (scope === "categories" && categorySlugs.length === 0) return { ok: false, error: "Tick at least one category." };
  if (scope === "products" && productIds.length === 0) return { ok: false, error: "Choose at least one product." };

  const minRaw = typeof r.min === "string" && r.min.trim() !== "" ? r.min : "0";
  const min = rupeesToCents(minRaw);
  if (min === null || min > MAX_AMOUNT_CENTS) return { ok: false, error: "Enter a minimum like 5000, or leave it empty." };

  return {
    ok: true,
    value: { kind, value, scope, category_slugs: categorySlugs, product_ids: productIds, min_subtotal: min },
  };
}

export type PromotionInput = {
  name_si: string;
  name_en: string;
  starts_at: string;
  ends_at: string | null;
  active: boolean;
  sort_order: number;
  banner_mode: "none" | "template" | "image";
  headline_si: string;
  headline_en: string;
  subtext_si: string;
  subtext_en: string;
  button_si: string;
  button_en: string;
  color_from: string;
  color_to: string;
  text_color: string;
  image_alt_si: string;
  image_alt_en: string;
};

export type PromotionFieldName = "slug" | "name" | "startsAt" | "endsAt" | "banner" | "rules" | "form";

type Fields = Record<string, string | undefined>;

const text = (fields: Fields, key: string) => (fields[key] ?? "").trim();

/**
 * The whole promotion form. `rules` arrives as JSON from the rules editor;
 * the uploaded photo as `imagePath`, and `hasImage` says one is already saved.
 */
export function parsePromotionForm(
  fields: Fields,
  mode: "create" | "update",
):
  | { ok: true; slug?: string; value: PromotionInput; rules: RuleInput[] }
  | { ok: false; errors: Partial<Record<PromotionFieldName, string>> } {
  const errors: Partial<Record<PromotionFieldName, string>> = {};

  const slug = mode === "create" ? text(fields, "slug") : undefined;
  if (mode === "create" && !(slug && slug.length <= 60 && SLUG_PATTERN.test(slug))) {
    errors.slug = "Use lowercase letters, numbers and dashes, e.g. halloween-2026.";
  }

  const nameSi = text(fields, "nameSi");
  const nameEn = text(fields, "nameEn");
  if ((!nameSi && !nameEn) || nameSi.length > 60 || nameEn.length > 60) {
    errors.name = "Give the promotion a name (up to 60 characters) in Sinhala, English or both.";
  }

  const startsAt = colomboToUtcIso(text(fields, "startsAt"));
  if (!startsAt) errors.startsAt = "Choose when it starts.";
  const endsRaw = text(fields, "endsAt");
  const endsAt = endsRaw ? colomboToUtcIso(endsRaw) : null;
  if (endsRaw && !endsAt) errors.endsAt = "Enter a valid end time, or leave it empty.";
  else if (startsAt && endsAt && endsAt <= startsAt) errors.endsAt = "The end must be after the start.";

  const bannerMode = (["none", "template", "image"] as const).find((m) => m === fields.bannerMode) ?? "none";
  const banner = {
    headline_si: text(fields, "headlineSi"),
    headline_en: text(fields, "headlineEn"),
    subtext_si: text(fields, "subtextSi"),
    subtext_en: text(fields, "subtextEn"),
    button_si: text(fields, "buttonSi"),
    button_en: text(fields, "buttonEn"),
    color_from: text(fields, "colorFrom").toLowerCase() || "#cb4a1c",
    color_to: text(fields, "colorTo").toLowerCase() || "#15231d",
    text_color: text(fields, "textColor").toLowerCase() || "#ffffff",
    image_alt_si: text(fields, "altSi"),
    image_alt_en: text(fields, "altEn"),
  };
  const tooLong =
    banner.headline_si.length > 80 || banner.headline_en.length > 80 ||
    banner.subtext_si.length > 160 || banner.subtext_en.length > 160 ||
    banner.button_si.length > 30 || banner.button_en.length > 30 ||
    banner.image_alt_si.length > 160 || banner.image_alt_en.length > 160;
  const hasImage = !!text(fields, "imagePath") || fields.hasImage === "1";
  if (bannerMode === "template" && !banner.headline_si && !banner.headline_en) {
    errors.banner = "A template banner needs a headline.";
  } else if (bannerMode === "image" && !hasImage) {
    errors.banner = "Upload the banner image.";
  } else if (![banner.color_from, banner.color_to, banner.text_color].every((c) => COLOR_PATTERN.test(c))) {
    errors.banner = "Colours must look like #cb4a1c.";
  } else if (tooLong) {
    errors.banner = "Banner text is too long.";
  }

  let rawRules: unknown;
  try {
    rawRules = JSON.parse(fields.rules ?? "[]");
  } catch {
    rawRules = null;
  }
  const rules: RuleInput[] = [];
  if (!Array.isArray(rawRules)) {
    errors.rules = "The rules couldn't be read. Reload and try again.";
  } else if (rawRules.length > MAX_RULES) {
    errors.rules = `At most ${MAX_RULES} rules.`;
  } else {
    for (const [i, raw] of rawRules.entries()) {
      const parsed = parseRule(raw);
      if (!parsed.ok) {
        errors.rules = `Rule ${i + 1}: ${parsed.error}`;
        break;
      }
      rules.push(parsed.value);
    }
  }

  const sortOrder = Number.parseInt(text(fields, "sortOrder") || "0", 10);
  if (Object.keys(errors).length > 0 || !startsAt) return { ok: false, errors };
  return {
    ok: true,
    slug,
    rules,
    value: {
      name_si: nameSi,
      name_en: nameEn,
      starts_at: startsAt,
      ends_at: endsAt,
      active: fields.active === "on",
      sort_order: Number.isFinite(sortOrder) ? sortOrder : 0,
      banner_mode: bannerMode,
      ...banner,
    },
  };
}
