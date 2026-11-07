"use client";

import { useActionState, useMemo, useState, useTransition } from "react";
import {
  FONT_PAIRS,
  FONT_VARS,
  OVERRIDE_KEYS,
  PRESETS,
  checkTheme,
  isHex,
  resolveTheme,
  logoText as brandLogoText,
  type Brand,
  type Mode,
  type OverrideKey,
} from "@/lib/brand";
import { saveBrandAction, type BrandFormState } from "./actions";
import ThemePreview from "./ThemePreview";

const initialState: BrandFormState = { errors: [], saved: false };
const input = "mt-2 w-full rounded-md border border-line bg-bg px-3 py-2 outline-none focus:border-ink";

const RULE_TEXT: Record<string, string> = {
  text_bg: "the main text is too hard to read on the background",
  muted_bg: "the secondary text is too faint on the background",
  panelink_panel: "the text on the dark panel (footer) is too hard to read",
  panelmuted_panel: "the secondary text on the dark panel is too faint",
  onaccent_accent: "text on the accent colour (buttons) is too hard to read",
  accent_bg: "the accent colour is too hard to see on the background",
  accent_surface: "the accent colour is too hard to see on cards",
};

const MESSAGES: Record<string, string> = {
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

function message(code: string): string {
  if (MESSAGES[code]) return MESSAGES[code];
  if (code.startsWith("ov_")) return `The advanced colour ${code.slice(3).replace("_", " ")} must look like #cb4a1c.`;
  const m = /^(light|dark)_(.+)$/.exec(code);
  if (m && RULE_TEXT[m[2]]) return `In ${m[1]} mode, ${RULE_TEXT[m[2]]}.`;
  return `Check ${code.replaceAll("_", " ")}.`;
}

const LABELS: Record<OverrideKey, string> = {
  bg: "Background",
  surface: "Cards",
  text: "Text",
  muted: "Secondary text",
  accent: "Accent",
  panel: "Dark panel",
  panelInk: "Panel text",
  panelMuted: "Panel secondary text",
};

export default function BrandForm({ brand }: { brand: Brand }) {
  const [state, submit, pending] = useActionState(saveBrandAction, initialState);
  const [, startTransition] = useTransition();
  const [name, setName] = useState(brand.name);
  const [shortName, setShortName] = useState(brand.shortName);
  const [logoText, setLogoText] = useState(brand.logoText);
  const [themeId, setThemeId] = useState(brand.themeId);
  const [accent, setAccent] = useState(brand.accent ?? "");
  const [fontPair, setFontPair] = useState(brand.fontPair);
  const [overrides, setOverrides] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const mode of ["light", "dark"] as const) {
      for (const key of OVERRIDE_KEYS) initial[`ov_${mode}_${key}`] = brand.themeOverrides[mode]?.[key] ?? "";
    }
    return initial;
  });

  // The live preview and the contrast check use exactly the rules the server applies on save.
  const { theme, failed } = useMemo(() => {
    const themeOverrides: Brand["themeOverrides"] = {};
    for (const mode of ["light", "dark"] as Mode[]) {
      const kept: Partial<Record<OverrideKey, string>> = {};
      for (const key of OVERRIDE_KEYS) {
        const value = overrides[`ov_${mode}_${key}`];
        if (isHex(value)) kept[key] = value.toLowerCase();
      }
      if (Object.keys(kept).length > 0) themeOverrides[mode] = kept;
    }
    const resolved = resolveTheme({ ...brand, themeId, accent: isHex(accent) ? accent : null, themeOverrides });
    return { theme: resolved, failed: checkTheme(resolved) };
  }, [brand, themeId, accent, overrides]);

  const fonts = FONT_VARS[fontPair] ?? FONT_VARS.northbound;
  const pair = FONT_PAIRS[fontPair] ?? FONT_PAIRS.northbound;
  const previewLogo = brandLogoText({ ...brand, logoText, shortName });
  const errors = [...new Set(state.errors)];

  return (
    <form
      // onSubmit rather than `action={submit}`: React 19 resets a form after every form action.
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        startTransition(() => submit(formData));
      }}
      className="max-w-3xl"
    >
      {(errors.length > 0 || failed.length > 0) && (
        <ul role="alert" className="mb-4 list-disc pl-5 text-sm text-blaze">
          {(errors.length > 0 ? errors : failed).map((code) => (
            <li key={code}>{message(code)}</li>
          ))}
        </ul>
      )}

      <h3 className="eyebrow text-muted">Identity</h3>
      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          Shop name
          <input name="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} className={input} />
        </label>
        <label className="block text-sm">
          Short name (header, emails, SMS)
          <input name="short_name" value={shortName} onChange={(e) => setShortName(e.target.value)} maxLength={24} className={input} />
        </label>
        <label className="block text-sm">
          Logo text (when there is no logo picture; a · gets the accent colour)
          <input name="logo_text" value={logoText} onChange={(e) => setLogoText(e.target.value)} maxLength={30} className={input} />
        </label>
        <label className="block text-sm">
          Name in SMS, email and push (empty = short name)
          <input name="sender_name" defaultValue={brand.senderName} maxLength={24} className={input} />
        </label>
        <label className="block text-sm">
          Tagline (Sinhala)
          <input name="tagline_si" defaultValue={brand.taglineSi} maxLength={120} className={input} />
        </label>
        <label className="block text-sm">
          Tagline (English)
          <input name="tagline_en" defaultValue={brand.taglineEn} maxLength={120} className={input} />
        </label>
        <label className="block text-sm sm:col-span-2">
          Browser and search title
          <input name="seo_title" defaultValue={brand.seoTitle} maxLength={70} className={input} />
        </label>
        <label className="block text-sm sm:col-span-2">
          Search description
          <textarea name="seo_description" rows={2} defaultValue={brand.seoDescription} maxLength={200} className={input} />
        </label>
      </div>

      <h3 className="eyebrow mt-8 text-muted">Colour theme</h3>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        {Object.entries(PRESETS).map(([id, preset]) => (
          <label key={id} className={`cursor-pointer rounded-md border p-3 text-sm ${themeId === id ? "border-ink" : "border-line"}`}>
            <input type="radio" name="theme_id" value={id} checked={themeId === id} onChange={() => setThemeId(id)} className="sr-only" />
            <span className="font-medium">{preset.label}</span>
            <span className="mt-2 flex gap-1" aria-hidden>
              {[preset.light.bg, preset.light.surface, preset.light.accent, preset.light.panel, preset.dark.bg].map((color, index) => (
                <span key={index} className="h-5 w-5 rounded-full border border-line" style={{ background: color }} />
              ))}
            </span>
          </label>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
        <label htmlFor="brand-accent-picker">Your own accent colour</label>
        <input id="brand-accent-picker" type="color" value={isHex(accent) ? accent : theme.light.accent} onChange={(e) => setAccent(e.target.value)} className="h-10 w-14 rounded border border-line bg-bg" />
        <input name="accent" value={accent} onChange={(e) => setAccent(e.target.value)} placeholder="#cb4a1c" aria-label="Accent colour as a hex value" className="w-32 rounded-md border border-line bg-bg px-3 py-2 font-mono outline-none focus:border-ink" />
        {accent !== "" && (
          <button type="button" onClick={() => setAccent("")} className="underline">
            Use the theme&apos;s accent
          </button>
        )}
      </div>
      <p className="mt-2 text-sm text-muted">Text on buttons is chosen automatically (white or near-black). A colour that is hard to see is not accepted.</p>

      <details className="mt-4 rounded-md border border-line p-4">
        <summary className="cursor-pointer text-sm">Advanced: change individual colours</summary>
        <p className="mt-2 text-sm text-muted">Leave a box empty to keep the theme&apos;s colour. Use the form #rrggbb.</p>
        <div className="mt-3 grid gap-6 sm:grid-cols-2">
          {(["light", "dark"] as const).map((mode) => (
            <fieldset key={mode}>
              <legend className="eyebrow text-muted">{mode === "light" ? "Light mode" : "Dark mode"}</legend>
              {OVERRIDE_KEYS.map((key) => (
                <label key={key} className="mt-2 flex items-center justify-between gap-3 text-sm">
                  {LABELS[key]}
                  <input
                    name={`ov_${mode}_${key}`}
                    value={overrides[`ov_${mode}_${key}`]}
                    onChange={(e) => setOverrides((prev) => ({ ...prev, [`ov_${mode}_${key}`]: e.target.value }))}
                    placeholder={theme[mode][key]}
                    className="w-28 rounded-md border border-line bg-bg px-2 py-1 font-mono text-xs outline-none focus:border-ink"
                  />
                </label>
              ))}
            </fieldset>
          ))}
        </div>
      </details>

      <h3 className="eyebrow mt-8 text-muted">Fonts</h3>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {Object.entries(FONT_PAIRS).map(([id, p]) => (
          <label key={id} className={`cursor-pointer rounded-md border p-3 text-sm ${fontPair === id ? "border-ink" : "border-line"}`}>
            <input type="radio" name="font_pair" value={id} checked={fontPair === id} onChange={() => setFontPair(id)} className="sr-only" />
            <span className="font-medium">{p.label}</span>
            <span className="mt-2 block text-2xl" style={{ fontFamily: FONT_VARS[id].display, textTransform: p.displayCase, letterSpacing: p.tracking }}>
              Field jacket
            </span>
            <span className="block" style={{ fontFamily: FONT_VARS[id].body }}>
              Honest materials, quiet design. අවංක රෙදි, සරල නිර්මාණ.
            </span>
          </label>
        ))}
      </div>

      <h3 className="eyebrow mt-8 text-muted">Preview</h3>
      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        <ThemePreview label="Light mode" theme={theme.light} logoText={previewLogo} displayFont={fonts.display} bodyFont={fonts.body} displayCase={pair.displayCase} />
        <ThemePreview label="Dark mode" theme={theme.dark} logoText={previewLogo} displayFont={fonts.display} bodyFont={fonts.body} displayCase={pair.displayCase} />
      </div>
      {failed.length === 0 && <p className="mt-2 text-sm text-muted">Every colour passes the readability check.</p>}

      <div className="mt-8 flex items-center gap-4">
        <button type="submit" disabled={pending || failed.length > 0} className="rounded-full bg-blaze px-6 py-3 font-medium text-onaccent disabled:opacity-60">
          {pending ? "Saving…" : "Save branding"}
        </button>
        {state.saved && <span role="status" className="text-sm text-muted">Saved.</span>}
        {failed.length > 0 && <span className="text-sm text-muted">Fix the colours above to save.</span>}
      </div>
    </form>
  );
}
