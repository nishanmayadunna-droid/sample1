// Storefront settings and promises: shared types and pure form rules.
// Safe to import from client components.
import { isLang, type Lang } from "./i18n";
import { formatPriceWhole } from "./products";

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
 * What the promise strip and footer show: the free-shipping line first, when a
 * running promotion offers shop-wide free shipping over some amount (see
 * freeShippingThreshold in lib/promotions.ts), then the admin's promises.
 */
export function promiseItems(
  promises: StorePromise[],
  freeShippingThreshold: number | null,
): PromiseItem[] {
  const items: PromiseItem[] = promises.slice(0, MAX_VISIBLE_PROMISES).map((p) => ({
    key: p.id,
    icon: p.icon,
    si: p.textSi,
    en: p.textEn,
  }));
  if (freeShippingThreshold === null) return items;
  const amount = formatPriceWhole(freeShippingThreshold);
  const freeShipping: PromiseItem =
    freeShippingThreshold === 0
      ? { key: "free-shipping", icon: "truck", si: "නොමිලේ බෙදාහැරීම", en: "Free shipping" }
      : {
          key: "free-shipping",
          icon: "truck",
          si: `${amount}ට වැඩි ඇණවුම්වලට නොමිලේ බෙදාහැරීම`,
          en: `Free shipping over ${amount}`,
        };
  return [freeShipping, ...items];
}

export const PROMISE_ICONS: readonly PromiseIcon[] = ["truck", "box", "return", "shield", "tag"];
export const PROMISE_TEXT_MAX = 60;

export type PromiseInput = { icon: PromiseIcon; text_si: string; text_en: string; visible: boolean };
export type PromiseFieldName = "icon" | "textSi" | "textEn" | "form";

/** True when another promise may be made visible. */
export function canShowPromise(otherVisibleCount: number): boolean {
  return otherVisibleCount < MAX_VISIBLE_PROMISES;
}

/**
 * The /admin/promises form. `otherVisibleCount` counts visible promises other
 * than the one being edited, so re-saving a visible one is always allowed.
 */
export function parsePromiseForm(
  fields: Fields,
  otherVisibleCount: number,
):
  | { ok: true; value: PromiseInput }
  | { ok: false; errors: Partial<Record<PromiseFieldName, string>> } {
  const errors: Partial<Record<PromiseFieldName, string>> = {};
  const icon = PROMISE_ICONS.find((i) => i === fields.icon);
  if (!icon) errors.icon = "Choose an icon.";

  const textSi = (fields.textSi ?? "").trim();
  const textEn = (fields.textEn ?? "").trim();
  if (textSi.length > PROMISE_TEXT_MAX) errors.textSi = `At most ${PROMISE_TEXT_MAX} characters.`;
  if (textEn.length > PROMISE_TEXT_MAX) errors.textEn = `At most ${PROMISE_TEXT_MAX} characters.`;
  if (!textSi && !textEn) errors.form = "Write the promise in Sinhala, English or both.";

  const visible = fields.visible === "on";
  if (visible && !canShowPromise(otherVisibleCount)) {
    errors.form = `Only ${MAX_VISIBLE_PROMISES} promises can be shown at once. Hide one first, or save this one hidden.`;
  }

  if (!icon || Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value: { icon, text_si: textSi, text_en: textEn, visible } };
}
