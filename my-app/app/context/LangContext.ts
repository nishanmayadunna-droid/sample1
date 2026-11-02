"use client";

// Despite the name this is not React Context: like the cart, it is a
// module-level store read through useSyncExternalStore. The language itself
// lives on <html data-lang>, set before paint by the boot script.
import { useSyncExternalStore } from "react";
import { DEFAULT_LANG_SETTINGS, isLang, LANG_COOKIE, type Lang } from "@/lib/i18n";

const listeners = new Set<() => void>();
let serverDefault: Lang = DEFAULT_LANG_SETTINGS.defaultLang;

/** The language the server rendered with; used as the hydration snapshot. */
export function initLangStore(lang: Lang) {
  serverDefault = lang;
}

function getSnapshot(): Lang {
  const value = document.documentElement.dataset.lang;
  return isLang(value) ? value : serverDefault;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useLang(): Lang {
  return useSyncExternalStore(subscribe, getSnapshot, () => serverDefault);
}

/** Switches the page language at once and remembers it for a year. */
export function setLang(lang: Lang) {
  document.cookie = `${LANG_COOKIE}=${lang}; Path=/; Max-Age=31536000; SameSite=Lax`;
  const html = document.documentElement;
  html.lang = lang;
  html.dataset.lang = lang;
  listeners.forEach((listener) => listener());
}
