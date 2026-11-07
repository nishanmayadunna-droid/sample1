// The shop's brand: name, logo, colours, fonts. Pure rules, no I/O, safe in client components.
// Everything an owner may change lives in the `store_brand` row; DEFAULT_BRAND is today's Northbound look.
import { FONT_PAIRS, FONT_VARS, PRESETS, type PresetTokens } from "./brand-presets";

export { FONT_PAIRS, FONT_VARS, PRESETS };
export type { PresetTokens };

export const OVERRIDE_KEYS = ["bg", "surface", "text", "muted", "accent", "panel", "panelInk", "panelMuted"] as const;
export type OverrideKey = (typeof OVERRIDE_KEYS)[number];
export type Overrides = { light?: Partial<PresetTokens>; dark?: Partial<PresetTokens> };
export type Mode = "light" | "dark";

export type ThemeMode = PresetTokens & { line: string; onAccent: string };
export type Theme = { light: ThemeMode; dark: ThemeMode };

export type Brand = {
  name: string;
  shortName: string;
  /** Shown as the logo when there is no picture; a · gets the accent colour. */
  logoText: string;
  senderName: string;
  taglineSi: string;
  taglineEn: string;
  seoTitle: string;
  seoDescription: string;
  logoPath: string | null;
  logoDarkPath: string | null;
  faviconPath: string | null;
  shareImagePath: string | null;
  themeId: string;
  accent: string | null;
  themeOverrides: Overrides;
  fontPair: string;
};

export const DEFAULT_BRAND: Brand = {
  name: "Northbound",
  shortName: "Northbound",
  logoText: "North·bound",
  senderName: "",
  taglineSi: "Demo සාප්පුවකි. ඉවත දමන්න නොව, දිගු කලක් අඳින්නට.",
  taglineEn: "A demo storefront. Built to be worn out, not thrown out.",
  seoTitle: "Northbound — Hard-wearing field apparel",
  seoDescription:
    "Honest materials, quiet design, and hardware built to outlast the season. Field apparel for the cold miles.",
  logoPath: null,
  logoDarkPath: null,
  faviconPath: null,
  shareImagePath: null,
  themeId: "northbound",
  accent: null,
  themeOverrides: {},
  fontPair: "northbound",
};

// Colour maths -------------------------------------------------------------------------------

export function isHex(value: unknown): value is string {
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value);
}

function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function luminance(hex: string): number {
  const [r, g, b] = rgb(hex).map((c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two #rrggbb colours (1 to 21). */
export function contrastRatio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** White or near-black, whichever reads better on the accent. */
export function pickOnAccent(accent: string): string {
  return contrastRatio("#ffffff", accent) >= contrastRatio("#111111", accent) ? "#ffffff" : "#111111";
}

// Theme --------------------------------------------------------------------------------------

function lineFrom(textHex: string): string {
  const [r, g, b] = rgb(textHex);
  return `rgba(${r},${g},${b},0.16)`;
}

function resolveMode(preset: PresetTokens, accent: string | null, overrides: Partial<PresetTokens> | undefined): ThemeMode {
  const tokens: PresetTokens = { ...preset };
  if (accent && isHex(accent)) tokens.accent = accent.toLowerCase();
  for (const key of OVERRIDE_KEYS) {
    const value = overrides?.[key];
    if (isHex(value)) tokens[key] = value.toLowerCase();
  }
  return { ...tokens, line: lineFrom(tokens.text), onAccent: pickOnAccent(tokens.accent) };
}

/** Preset, then the owner's accent, then their per-token overrides. An unknown preset is Northbound. */
export function resolveTheme(brand: Brand): Theme {
  const preset = PRESETS[brand.themeId] ?? PRESETS.northbound;
  return {
    light: resolveMode(preset.light, brand.accent, brand.themeOverrides.light),
    dark: resolveMode(preset.dark, brand.accent, brand.themeOverrides.dark),
  };
}

const RULES: { code: string; fg: keyof ThemeMode; bg: keyof ThemeMode; min: number }[] = [
  { code: "text_bg", fg: "text", bg: "bg", min: 7 },
  { code: "muted_bg", fg: "muted", bg: "bg", min: 4.5 },
  { code: "panelink_panel", fg: "panelInk", bg: "panel", min: 7 },
  { code: "panelmuted_panel", fg: "panelMuted", bg: "panel", min: 4.5 },
  { code: "onaccent_accent", fg: "onAccent", bg: "accent", min: 4.5 },
  { code: "accent_bg", fg: "accent", bg: "bg", min: 3 },
  { code: "accent_surface", fg: "accent", bg: "surface", min: 3 },
];

/** The contrast rules a theme breaks, as codes like `light_accent_bg`. Empty means it is fine. */
export function checkTheme(theme: Theme): string[] {
  const failed: string[] = [];
  for (const mode of ["light", "dark"] as const) {
    for (const rule of RULES) {
      if (contrastRatio(theme[mode][rule.fg], theme[mode][rule.bg]) < rule.min) failed.push(`${mode}_${rule.code}`);
    }
  }
  return failed;
}

const LINE = /^rgba\(\d{1,3},\d{1,3},\d{1,3},0\.16\)$/;

function modeCss(mode: ThemeMode): string {
  const vars: [string, string, boolean][] = [
    ["--bg", mode.bg, true],
    ["--surface", mode.surface, true],
    ["--text", mode.text, true],
    ["--muted", mode.muted, true],
    ["--line", mode.line, false],
    ["--accent", mode.accent, true],
    ["--panel", mode.panel, true],
    ["--panel-ink", mode.panelInk, true],
    ["--panel-muted", mode.panelMuted, true],
    ["--on-accent", mode.onAccent, true],
  ];
  // Only validated colours are written; anything else is left out (the stylesheet default applies).
  return vars
    .filter(([, value, hex]) => (hex ? isHex(value) : typeof value === "string" && LINE.test(value)))
    .map(([name, value, hex]) => `${name}:${hex ? value.toLowerCase() : value}`)
    .join(";");
}

/** The CSS text injected in the layout: light on :root, dark under prefers-color-scheme. */
export function themeCss(theme: Theme): string {
  // :root:root outranks the stylesheet's :root whichever comes first in the document.
  return `:root:root{${modeCss(theme.light)}}@media (prefers-color-scheme: dark){:root:root{${modeCss(theme.dark)}}}`;
}

// Names ---------------------------------------------------------------------------------------

/** The text shown as the logo when no picture is uploaded. */
export function logoText(brand: Brand): string {
  return brand.logoText.trim() || brand.shortName || brand.name;
}

/** The name used in SMS, email and push. Owner alerts must stay printable ASCII (a Sinhala name costs more per SMS). */
export function senderName(brand: Brand, opts: { ascii: boolean }): string {
  const name = brand.senderName.trim() || brand.shortName || brand.name;
  return opts.ascii && /[^\x20-\x7e]/.test(name) ? "Shop" : name;
}

// Images --------------------------------------------------------------------------------------

export const BRAND_IMAGE_MAX_BYTES = 1_048_576;
export const BRAND_SLOTS = ["logo", "logoDark", "favicon", "share"] as const;
export type BrandSlot = (typeof BRAND_SLOTS)[number];

/** PNG / WebP / JPEG up to 1 MB. SVG is refused on purpose. */
export function isBrandImage(type: string, size: number): boolean {
  return ["image/png", "image/webp", "image/jpeg"].includes(type) && Number.isInteger(size) && size > 0 && size <= BRAND_IMAGE_MAX_BYTES;
}

export function isValidBrandPath(path: string): boolean {
  return typeof path === "string" && /^\d{10,16}-(logo|logoDark|favicon|share)\.(png|webp|jpg|jpeg)$/.test(path);
}

// Row and form --------------------------------------------------------------------------------

type Row = Record<string, unknown>;
const asRow = (value: unknown): Row => (typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Row) : {});
const text = (value: unknown, max: number, fallback: string): string =>
  typeof value === "string" ? value.trim().slice(0, max) : fallback;
const required = (value: unknown, max: number, fallback: string): string => text(value, max, fallback) || fallback;
const path = (value: unknown): string | null => (typeof value === "string" && isValidBrandPath(value) ? value : null);

function parseOverrides(value: unknown): Overrides {
  const out: Overrides = {};
  const row = asRow(value);
  for (const mode of ["light", "dark"] as const) {
    const part = asRow(row[mode]);
    const kept: Partial<PresetTokens> = {};
    for (const key of OVERRIDE_KEYS) if (isHex(part[key])) kept[key] = (part[key] as string).toLowerCase();
    if (Object.keys(kept).length > 0) out[mode] = kept;
  }
  return out;
}

/** The one `store_brand` row. A missing or odd row, or a bad value in it, gives the default for that field. */
export function parseBrandRow(input: unknown): Brand {
  const row = asRow(input);
  const d = DEFAULT_BRAND;
  return {
    name: required(row.name, 40, d.name),
    shortName: required(row.short_name, 24, d.shortName),
    logoText: required(row.logo_text, 30, d.logoText),
    senderName: text(row.sender_name, 24, d.senderName),
    taglineSi: text(row.tagline_si, 120, d.taglineSi),
    taglineEn: text(row.tagline_en, 120, d.taglineEn),
    seoTitle: required(row.seo_title, 70, d.seoTitle),
    seoDescription: text(row.seo_description, 200, d.seoDescription),
    logoPath: path(row.logo_path),
    logoDarkPath: path(row.logo_dark_path),
    faviconPath: path(row.favicon_path),
    shareImagePath: path(row.share_image_path),
    themeId: typeof row.theme_id === "string" && row.theme_id in PRESETS ? row.theme_id : d.themeId,
    accent: isHex(row.accent) ? row.accent.toLowerCase() : null,
    themeOverrides: parseOverrides(row.theme_overrides),
    fontPair: typeof row.font_pair === "string" && row.font_pair in FONT_PAIRS ? row.font_pair : d.fontPair,
  };
}

export type BrandRow = {
  name: string;
  short_name: string;
  logo_text: string;
  sender_name: string;
  tagline_si: string;
  tagline_en: string;
  seo_title: string;
  seo_description: string;
  theme_id: string;
  accent: string | null;
  theme_overrides: Overrides;
  font_pair: string;
};

const field = (fd: FormData, name: string, max: number) => {
  const raw = fd.get(name);
  return typeof raw === "string" ? raw.trim().slice(0, max + 1) : "";
};

/** The branding form. The final theme must pass the contrast gate; every error is a code, never free text. */
export function validateBrandForm(fd: FormData): { ok: true; value: BrandRow } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  const name = field(fd, "name", 40);
  if (name === "" || name.length > 40) errors.push("name");
  const shortName = field(fd, "short_name", 24);
  if (shortName === "" || shortName.length > 24) errors.push("short_name");
  const logoTextValue = field(fd, "logo_text", 30);
  // A control character (a line break, say) could break a line in an email subject or an SMS.
  for (const [code, value] of [["name", name], ["short_name", shortName], ["logo_text", logoTextValue], ["sender_name", field(fd, "sender_name", 24)]] as const) {
    if (/[ -]/.test(value) && !errors.includes(code)) errors.push(code);
  }
  if (logoTextValue.length > 30) errors.push("logo_text");
  const senderNameValue = field(fd, "sender_name", 24);
  if (senderNameValue.length > 24) errors.push("sender_name");
  const taglineSi = field(fd, "tagline_si", 120);
  const taglineEn = field(fd, "tagline_en", 120);
  if (taglineSi.length > 120 || taglineEn.length > 120) errors.push("tagline");
  const seoTitle = field(fd, "seo_title", 70);
  if (seoTitle === "" || seoTitle.length > 70) errors.push("seo_title");
  const seoDescription = field(fd, "seo_description", 200);
  if (seoDescription.length > 200) errors.push("seo_description");

  const themeId = field(fd, "theme_id", 20);
  if (!(themeId in PRESETS)) errors.push("theme_id");
  const fontPair = field(fd, "font_pair", 20);
  if (!(fontPair in FONT_PAIRS)) errors.push("font_pair");
  const accentRaw = field(fd, "accent", 7);
  if (accentRaw !== "" && !isHex(accentRaw)) errors.push("accent");

  const overrides: Overrides = {};
  for (const mode of ["light", "dark"] as const) {
    const kept: Partial<PresetTokens> = {};
    for (const key of OVERRIDE_KEYS) {
      const name = `ov_${mode}_${key}`;
      const raw = field(fd, name, 7);
      if (raw === "") continue;
      if (isHex(raw)) kept[key] = raw.toLowerCase();
      else errors.push(name);
    }
    if (Object.keys(kept).length > 0) overrides[mode] = kept;
  }
  if (errors.length > 0) return { ok: false, errors };

  const value: BrandRow = {
    name,
    short_name: shortName,
    logo_text: logoTextValue || shortName,
    sender_name: senderNameValue,
    tagline_si: taglineSi,
    tagline_en: taglineEn,
    seo_title: seoTitle,
    seo_description: seoDescription,
    theme_id: themeId,
    accent: accentRaw === "" ? null : accentRaw.toLowerCase(),
    theme_overrides: overrides,
    font_pair: fontPair,
  };
  const failed = checkTheme(
    resolveTheme({ ...DEFAULT_BRAND, themeId, accent: value.accent, themeOverrides: overrides }),
  );
  return failed.length > 0 ? { ok: false, errors: failed } : { ok: true, value };
}

/** The public URL of an uploaded brand image (the Supabase URL is public, so this works in client components). */
export function brandAssetUrl(path: string): string {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/brand-assets/${path}`;
}
