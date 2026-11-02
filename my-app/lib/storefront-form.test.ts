import { describe, expect, it } from "vitest";
import {
  canShowPromise,
  MAX_VISIBLE_PROMISES,
  parseLanguageSettings,
  parsePromiseForm,
} from "./storefront-form";

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

describe("parsePromiseForm", () => {
  const ok = { icon: "box", textSi: " දින 7 ", textEn: " 7-day returns ", visible: "on" };

  it("trims texts and reads the checkbox", () => {
    expect(parsePromiseForm(ok, 0)).toEqual({
      ok: true,
      value: { icon: "box", text_si: "දින 7", text_en: "7-day returns", visible: true },
    });
  });

  it("rejects an unknown icon", () => {
    const r = parsePromiseForm({ ...ok, icon: "rocket" }, 0);
    expect(!r.ok && r.errors.icon).toBeTruthy();
  });

  it("needs at least one text", () => {
    const r = parsePromiseForm({ ...ok, textSi: "  ", textEn: "" }, 0);
    expect(!r.ok && r.errors.form).toBeTruthy();
  });

  it("limits each text to 60 characters", () => {
    const r = parsePromiseForm({ ...ok, textEn: "x".repeat(61) }, 0);
    expect(!r.ok && r.errors.textEn).toBeTruthy();
  });

  it("refuses a 4th visible promise", () => {
    const r = parsePromiseForm(ok, MAX_VISIBLE_PROMISES);
    expect(!r.ok && r.errors.form).toBeTruthy();
  });

  it("allows editing a visible promise when the other two are visible", () => {
    expect(parsePromiseForm(ok, MAX_VISIBLE_PROMISES - 1).ok).toBe(true);
  });

  it("allows a hidden promise when three are visible", () => {
    const hidden = { ...ok, visible: undefined };
    expect(parsePromiseForm(hidden, MAX_VISIBLE_PROMISES)).toMatchObject({
      ok: true,
      value: { visible: false },
    });
  });
});

describe("canShowPromise", () => {
  it("allows up to three visible", () => {
    expect([0, 2, 3].map(canShowPromise)).toEqual([true, true, false]);
  });
});
