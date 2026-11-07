// Plain-language messages for the codes lib/brand.ts returns, shared by the admin form.

const RULE_TEXT: Record<string, string> = {
  text_bg: "the main text is too hard to read on the background",
  muted_bg: "the secondary text is too faint on the background",
  panelink_panel: "the text on the dark panel (footer) is too hard to read",
  panelmuted_panel: "the secondary text on the dark panel is too faint",
  onaccent_accent: "text on the accent colour (buttons) is too hard to read",
  accent_bg: "the accent colour is too hard to see on the background",
  accent_surface: "the accent colour is too hard to see on cards",
};

const FIELD_TEXT: Record<string, string> = {
  name: "The shop name is required, 40 characters at most, with no line breaks.",
  short_name: "The short name is required, 24 characters at most, with no line breaks.",
  logo_text: "The logo text can be 30 characters at most, with no line breaks.",
  sender_name: "The sender name can be 24 characters at most, with no line breaks.",
  tagline: "Taglines can be 120 characters at most.",
  seo_title: "The browser title is required, 70 characters at most.",
  seo_description: "The description can be 200 characters at most.",
  theme_id: "Pick one of the colour themes.",
  font_pair: "Pick one of the font pairs.",
  accent: "The accent colour must look like #cb4a1c.",
  server: "Something went wrong, please try again.",
};

/** A message for one error code (a form field, an advanced colour, or a failed contrast rule). */
export function brandErrorMessage(code: string): string {
  if (Object.hasOwn(FIELD_TEXT, code)) return FIELD_TEXT[code];
  if (code.startsWith("ov_")) return `The advanced colour ${code.slice(3).replace("_", " ")} must look like #cb4a1c.`;
  const m = /^(light|dark)_(.+)$/.exec(code);
  if (m && Object.hasOwn(RULE_TEXT, m[2])) {
    const base = `In ${m[1]} mode, ${RULE_TEXT[m[2]]}.`;
    // One accent is used for both modes; a brand colour that works in one often fails in the other.
    return m[2].startsWith("accent") || m[2] === "onaccent_accent"
      ? `${base} Pick another accent, or set a different accent for ${m[1]} mode under Advanced, ${m[1] === "dark" ? "Dark" : "Light"} mode, Accent.`
      : base;
  }
  return `Check ${code.replaceAll("_", " ")}.`;
}
