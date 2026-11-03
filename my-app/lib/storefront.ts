// Server-side reads for the storefront shell: language settings and promises.
// Like lib/catalog.ts it uses a cookie-less client, so the root layout and
// every catalog page stay static (ISR).
import "server-only";
import { cache } from "react";
import { createClient } from "@supabase/supabase-js";
import { DEFAULT_LANG_SETTINGS, isLang, type LangSettings } from "./i18n";
import {
  isRunning,
  nextPromotionChange,
  PROMOTION_COLUMNS,
  toPromotion,
  type Promotion,
  type PromotionRow,
} from "./promotions";
import type { PromiseIcon, StorePromise } from "./storefront-form";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  { auth: { persistSession: false } },
);

type SettingsRow = { default_lang: string; bilingual: boolean; shipping_fee: number };

/** Shipping fee (cents) charged when no free-shipping promotion applies. */
export const DEFAULT_SHIPPING_FEE = 35000;

export type StoreSettings = LangSettings & { shippingFee: number };

const DEFAULT_STORE_SETTINGS: StoreSettings = {
  ...DEFAULT_LANG_SETTINGS,
  shippingFee: DEFAULT_SHIPPING_FEE,
};

type PromiseRow = {
  id: string;
  icon: PromiseIcon;
  text_si: string;
  text_en: string;
  sort_order: number;
  visible: boolean;
};

export const PROMISE_COLUMNS = "id, icon, text_si, text_en, sort_order, visible";

export function toStorePromise(row: PromiseRow): StorePromise {
  return {
    id: row.id,
    icon: row.icon,
    textSi: row.text_si,
    textEn: row.text_en,
    sortOrder: row.sort_order,
    visible: row.visible,
  };
}

export type { PromiseRow };

/** The admin's language and shipping settings; the defaults when they can't be read. */
export const getStoreSettings = cache(async (): Promise<StoreSettings> => {
  const { data, error } = await supabase
    .from("store_settings")
    .select("default_lang, bilingual, shipping_fee")
    .maybeSingle<SettingsRow>();
  if (error || !data) {
    if (error) console.error("store settings query failed", error);
    return DEFAULT_STORE_SETTINGS;
  }
  return {
    defaultLang: isLang(data.default_lang) ? data.default_lang : DEFAULT_LANG_SETTINGS.defaultLang,
    bilingual: data.bilingual,
    shippingFee: data.shipping_fee,
  };
});

/** Visible promises in display order; none when they can't be read. */
export const getVisiblePromises = cache(async (): Promise<StorePromise[]> => {
  const { data, error } = await supabase
    .from("store_promises")
    .select(PROMISE_COLUMNS)
    .eq("visible", true)
    .order("sort_order")
    .order("created_at")
    .returns<PromiseRow[]>();
  if (error) {
    console.error("store promises query failed", error);
    return [];
  }
  return data.map(toStorePromise);
});

/** Every active promotion (running, scheduled or ended), in display order; none on error. */
const getActivePromotions = cache(async (): Promise<Promotion[]> => {
  const { data, error } = await supabase
    .from("promotions")
    .select(PROMOTION_COLUMNS)
    .eq("active", true)
    .order("sort_order")
    .order("starts_at")
    .returns<PromotionRow[]>();
  if (error) {
    console.error("promotions query failed", error);
    return [];
  }
  return data.map(toPromotion);
});

/**
 * Promotions running right now, with their rules, in display order. Decided
 * here at render time — the client uses this list as is, never its own clock.
 */
export const getRunningPromotions = cache(async (): Promise<Promotion[]> => {
  const now = new Date();
  return (await getActivePromotions()).filter((p) => isRunning(p, now));
});

/** When the running set next changes, so open tabs know when to refresh. */
export const getNextPromotionChange = cache(async (): Promise<string | null> =>
  nextPromotionChange(await getActivePromotions(), new Date()),
);
