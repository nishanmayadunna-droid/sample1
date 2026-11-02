// Server-side reads for the storefront shell: language settings and promises.
// Like lib/catalog.ts it uses a cookie-less client, so the root layout and
// every catalog page stay static (ISR).
import "server-only";
import { cache } from "react";
import { createClient } from "@supabase/supabase-js";
import { DEFAULT_LANG_SETTINGS, isLang, type LangSettings } from "./i18n";
import type { PromiseIcon, StorePromise } from "./storefront-form";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  { auth: { persistSession: false } },
);

type SettingsRow = { default_lang: string; bilingual: boolean };

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

/** The admin's language settings; the defaults when they can't be read. */
export const getStoreSettings = cache(async (): Promise<LangSettings> => {
  const { data, error } = await supabase
    .from("store_settings")
    .select("default_lang, bilingual")
    .maybeSingle<SettingsRow>();
  if (error || !data) {
    if (error) console.error("store settings query failed", error);
    return DEFAULT_LANG_SETTINGS;
  }
  return {
    defaultLang: isLang(data.default_lang) ? data.default_lang : DEFAULT_LANG_SETTINGS.defaultLang,
    bilingual: data.bilingual,
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
