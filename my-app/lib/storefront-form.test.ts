import { describe, expect, it } from "vitest";
import { parseLanguageSettings } from "./storefront-form";

describe("parseLanguageSettings", () => {
  it("reads the default language and the switcher", () => {
    expect(parseLanguageSettings({ defaultLang: "en", bilingual: "on" })).toEqual({
      ok: true,
      value: { default_lang: "en", bilingual: true },
    });
  });

  it("treats a missing checkbox as off", () => {
    expect(parseLanguageSettings({ defaultLang: "si" })).toEqual({
      ok: true,
      value: { default_lang: "si", bilingual: false },
    });
  });

  it("rejects an unknown language", () => {
    const result = parseLanguageSettings({ defaultLang: "fr", bilingual: "on" });
    expect(result.ok).toBe(false);
    expect(!result.ok && result.errors.defaultLang).toBeTruthy();
  });
});
