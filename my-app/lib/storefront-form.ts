// Storefront settings and promises: shared types and pure form rules.
// Safe to import from client components.
import { isLang, type Lang } from "./i18n";

export type PromiseIcon = "truck" | "box" | "return" | "shield" | "tag";

/** A line in the promise strip and footer, written in both languages. */
export type StorePromise = {
  id: string;
  icon: PromiseIcon;
  textSi: string;
  textEn: string;
  sortOrder: number;
  visible: boolean;
};

type Fields = Record<string, string | undefined>;

export type LanguageSettingsInput = { default_lang: Lang; bilingual: boolean };

/** The /admin/settings language form: default language + switcher checkbox. */
export function parseLanguageSettings(
  fields: Fields,
):
  | { ok: true; value: LanguageSettingsInput }
  | { ok: false; errors: { defaultLang?: string } } {
  if (!isLang(fields.defaultLang)) {
    return { ok: false, errors: { defaultLang: "Choose Sinhala or English." } };
  }
  return { ok: true, value: { default_lang: fields.defaultLang, bilingual: fields.bilingual === "on" } };
}
