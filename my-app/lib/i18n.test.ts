import { describe, expect, it } from "vitest";
import {
  DEFAULT_LANG_SETTINGS,
  langBootScript,
  readLangCookie,
  resolveLang,
  tr,
  type LangSettings,
} from "./i18n";

describe("resolveLang", () => {
  const on: LangSettings = { defaultLang: "si", bilingual: true };

  it("uses a valid cookie", () => {
    expect(resolveLang("en", on)).toBe("en");
  });

  it("falls back to the default for missing, empty or unknown values", () => {
    for (const value of [undefined, "", "fr", "EN "]) {
      expect(resolveLang(value, on)).toBe("si");
    }
  });

  it("ignores the cookie when bilingual is off", () => {
    expect(resolveLang("si", { defaultLang: "en", bilingual: false })).toBe("en");
  });
});

describe("readLangCookie", () => {
  it("finds nb_lang among other cookies", () => {
    expect(readLangCookie("a=1; nb_lang=en; b=2")).toBe("en");
  });

  it("returns undefined when absent", () => {
    expect(readLangCookie("a=1")).toBeUndefined();
  });
});

describe("tr", () => {
  it("picks by language", () => {
    expect(tr("en", "ගෙදර", "Home")).toBe("Home");
  });

  it("falls back to the other side when empty", () => {
    expect(tr("si", "", "Home")).toBe("Home");
  });
});

describe("langBootScript", () => {
  function run(settings: LangSettings, cookie: string) {
    const el = { lang: "", dataset: {} as Record<string, string> };
    new Function("document", langBootScript(settings))({ cookie, documentElement: el });
    return el;
  }

  it("agrees with resolveLang", () => {
    const all: LangSettings[] = [
      { defaultLang: "si", bilingual: true },
      { defaultLang: "en", bilingual: false },
    ];
    for (const settings of all) {
      for (const cookie of ["", "nb_lang=en", "nb_lang=si", "nb_lang=fr"]) {
        const el = run(settings, cookie);
        const want = resolveLang(readLangCookie(cookie), settings);
        expect([el.lang, el.dataset.lang]).toEqual([want, want]);
      }
    }
  });

  it("does not throw when document access fails", () => {
    expect(() =>
      new Function("document", langBootScript(DEFAULT_LANG_SETTINGS))(null),
    ).not.toThrow();
  });
});
