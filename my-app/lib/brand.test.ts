import { describe, expect, it } from "vitest";
import {
  DEFAULT_BRAND,
  FONT_PAIRS,
  PRESETS,
  checkTheme,
  contrastRatio,
  isBrandImage,
  isHex,
  isValidBrandPath,
  parseBrandRow,
  pickOnAccent,
  resolveTheme,
  senderName,
  themeCss,
  logoText,
  validateBrandForm,
  type Brand,
} from "./brand";

const brand = (over: Partial<Brand> = {}): Brand => ({ ...DEFAULT_BRAND, ...over });

describe("contrastRatio and pickOnAccent", () => {
  it("matches known values", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(contrastRatio("#777777", "#777777")).toBeCloseTo(1, 5);
  });
  it("chooses white on a dark accent and near-black on a light one", () => {
    expect(pickOnAccent("#cb4a1c")).toBe("#ffffff");
    expect(pickOnAccent("#f5e960")).not.toBe("#ffffff");
    expect(contrastRatio(pickOnAccent("#f5e960"), "#f5e960")).toBeGreaterThan(4.5);
  });
});

describe("presets", () => {
  it("has the six presets and five font pairs", () => {
    expect(Object.keys(PRESETS).sort()).toEqual(["forest", "midnight", "northbound", "ocean", "paper", "rose"]);
    expect(Object.keys(FONT_PAIRS).sort()).toEqual(["classic", "editorial", "friendly", "modern", "northbound"]);
  });
  it("every preset passes the contrast gate in light and dark", () => {
    for (const id of Object.keys(PRESETS)) {
      expect(checkTheme(resolveTheme(brand({ themeId: id }))), id).toEqual([]);
    }
  });
  it("the default brand is today's Northbound look", () => {
    const t = resolveTheme(DEFAULT_BRAND);
    expect(t.light.accent).toBe("#cb4a1c");
    expect(t.light.bg).toBe("#e7e7e0");
    expect(t.light.panel).toBe("#15231d");
    expect(t.dark.bg).toBe("#0e1512");
    expect(DEFAULT_BRAND.name).toBe("Northbound");
    expect(DEFAULT_BRAND.fontPair).toBe("northbound");
  });
});

describe("custom accent and overrides", () => {
  it("refuses a light accent that is unreadable on the light background", () => {
    const failed = checkTheme(resolveTheme(brand({ accent: "#f5e960" })));
    expect(failed.some((c) => c.startsWith("light_accent"))).toBe(true);
  });
  it("refuses an accent that disappears on the dark background", () => {
    const failed = checkTheme(resolveTheme(brand({ accent: "#1a1a1a" })));
    expect(failed.some((c) => c.startsWith("dark_accent"))).toBe(true);
  });
  it("accepts a good accent", () => {
    expect(checkTheme(resolveTheme(brand({ accent: "#0b6fa8" })))).toEqual([]);
  });
  it("drops an override that is not a plain hex", () => {
    const t = resolveTheme(brand({ themeOverrides: { light: { bg: "#fff;}body{display:none" as never } } }));
    expect(t.light.bg).toBe("#e7e7e0");
  });
});

describe("themeCss", () => {
  it("emits only validated colours for light and dark", () => {
    const css = themeCss(resolveTheme(DEFAULT_BRAND));
    expect(css).toContain(":root:root{");
    expect(css).toContain("prefers-color-scheme: dark");
    expect(css).toContain("--on-accent:#ffffff");
    for (const m of css.matchAll(/#[0-9a-zA-Z]+/g)) expect(m[0]).toMatch(/^#[0-9a-f]{6}$/);
    expect(css).not.toMatch(/[<>]|display:none/);
  });
  it("never writes a hostile value from a hand-made theme", () => {
    const theme = resolveTheme(DEFAULT_BRAND);
    const evil = { ...theme, light: { ...theme.light, bg: "red;}body{display:none" } };
    const css = themeCss(evil);
    expect(css).not.toContain("display:none");
    expect(css).not.toContain("red;");
  });
  it("derives the line colour from the text colour", () => {
    expect(themeCss(resolveTheme(DEFAULT_BRAND))).toContain("--line:rgba(23,36,30,0.16)");
  });
});

describe("parseBrandRow", () => {
  it("falls back to the defaults for garbage", () => {
    const b = parseBrandRow({ theme_id: "nope", theme_overrides: "junk", font_pair: "x", accent: "red", name: "  " });
    expect(b.themeId).toBe(DEFAULT_BRAND.themeId);
    expect(b.themeOverrides).toEqual({});
    expect(b.fontPair).toBe(DEFAULT_BRAND.fontPair);
    expect(b.accent).toBeNull();
    expect(b.name).toBe("Northbound");
    expect(parseBrandRow(null)).toEqual(DEFAULT_BRAND);
  });
  it("reads good values", () => {
    const b = parseBrandRow({
      logo_text: "Ka·de",
      name: "Kade",
      short_name: "Kade",
      theme_id: "forest",
      accent: "#2f7d4f",
      font_pair: "classic",
      theme_overrides: { dark: { bg: "#101010", junk: "#ffffff" } },
      logo_path: "1700000000000-logo.png",
    });
    expect(b.name).toBe("Kade");
    expect(b.logoText).toBe("Ka·de");
    expect(b.themeId).toBe("forest");
    expect(b.themeOverrides).toEqual({ dark: { bg: "#101010" } });
    expect(b.logoPath).toBe("1700000000000-logo.png");
  });
  it("ignores a bad logo path", () => {
    expect(parseBrandRow({ logo_path: "../x.png" }).logoPath).toBeNull();
  });
});

describe("names", () => {
  it("falls back from the sender name to the short name and keeps owner alerts ASCII", () => {
    expect(senderName(brand({ shortName: "Kade", senderName: "" }), { ascii: false })).toBe("Kade");
    expect(senderName(brand({ senderName: "කඩේ" }), { ascii: false })).toBe("කඩේ");
    expect(senderName(brand({ senderName: "කඩේ" }), { ascii: true })).toBe("Shop");
    expect(senderName(brand({ senderName: "Kade Shop" }), { ascii: true })).toBe("Kade Shop");
  });
  it("uses the logo text, or the short name when there is none", () => {
    expect(logoText(brand({ shortName: "Kade", logoText: "Ka·de" }))).toBe("Ka·de");
    expect(logoText(brand({ shortName: "Kade", logoText: "  " }))).toBe("Kade");
    expect(DEFAULT_BRAND.logoText).toBe("North·bound");
  });
});

describe("validateBrandForm", () => {
  const base = { name: "Kade", short_name: "Kade", logo_text: "Kade", sender_name: "", tagline_si: "", tagline_en: "", seo_title: "Kade", seo_description: "d", theme_id: "northbound", accent: "", font_pair: "northbound" };
  const form = (o: Record<string, string>) => {
    const fd = new FormData();
    for (const [k, v] of Object.entries({ ...base, ...o })) fd.set(k, v);
    return fd;
  };
  it("accepts a good form", () => {
    const r = validateBrandForm(form({}));
    expect(r.ok).toBe(true);
  });
  it("refuses a long name, a bad hex, an unknown theme or font", () => {
    for (const [patch, code] of [
      [{ name: "x".repeat(41) }, "name"],
      [{ accent: "red" }, "accent"],
      [{ theme_id: "nope" }, "theme_id"],
      [{ font_pair: "comic" }, "font_pair"],
      [{ short_name: "x".repeat(25) }, "short_name"],
      [{ logo_text: "x".repeat(31) }, "logo_text"],
    ] as const) {
      const r = validateBrandForm(form(patch));
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.errors).toContain(code);
    }
  });
  it("refuses control characters in the names (they could break a line in an email subject)", () => {
    for (const field of ["name", "short_name", "sender_name", "logo_text"]) {
      const r = validateBrandForm(form({ [field]: "KadeShop" }));
      expect(r.ok, field).toBe(false);
      if (!r.ok) expect(r.errors).toContain(field);
    }
  });
  it("refuses a theme that fails the contrast gate, with codes", () => {
    const r = validateBrandForm(form({ accent: "#f5e960" }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.some((c) => c.startsWith("light_accent"))).toBe(true);
  });
  it("refuses an override that is not a hex", () => {
    const r = validateBrandForm(form({ ov_light_bg: "javascript:1" }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors).toContain("ov_light_bg");
  });
  it("reads valid overrides", () => {
    const r = validateBrandForm(form({ ov_dark_bg: "#101010" }));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.theme_overrides).toEqual({ dark: { bg: "#101010" } });
  });
});

describe("images", () => {
  it("allows PNG/WebP/JPEG up to 1 MB and no SVG", () => {
    expect(isBrandImage("image/svg+xml", 1)).toBe(false);
    expect(isBrandImage("image/png", 1048577)).toBe(false);
    expect(isBrandImage("image/webp", 1048576)).toBe(true);
    expect(isHex("#abcdef")).toBe(true);
    expect(isHex("#abc")).toBe(false);
  });
  it("checks storage paths", () => {
    expect(isValidBrandPath("1700000000000-logo.png")).toBe(true);
    expect(isValidBrandPath("1700000000000-logoDark.webp")).toBe(true);
    expect(isValidBrandPath("../x.png")).toBe(false);
    expect(isValidBrandPath("1700000000000-logo.svg")).toBe(false);
  });
});
