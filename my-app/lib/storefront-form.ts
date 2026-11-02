// Storefront settings and promises: shared types and pure form rules.
// Safe to import from client components.
import { isLang, type Lang } from "./i18n";
import { formatPriceWhole, FREE_SHIPPING_THRESHOLD } from "./products";

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

/** At most this many admin promises are visible at once. */
export const MAX_VISIBLE_PROMISES = 3;

export type PromiseItem = { key: string; icon: PromiseIcon; si: string; en: string };

/**
 * What the promise strip and footer show: the free-shipping line first (from
 * the code constants until promotions take it over), then the admin's promises.
 */
export function promiseItems(promises: StorePromise[]): PromiseItem[] {
  const amount = formatPriceWhole(FREE_SHIPPING_THRESHOLD);
  return [
    {
      key: "free-shipping",
      icon: "truck",
      si: `${amount}ට වැඩි ඇණවුම්වලට නොමිලේ බෙදාහැරීම`,
      en: `Free shipping over ${amount}`,
    },
    ...promises.slice(0, MAX_VISIBLE_PROMISES).map((p) => ({
      key: p.id,
      icon: p.icon,
      si: p.textSi,
      en: p.textEn,
    })),
  ];
}
