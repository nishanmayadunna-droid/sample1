// Sinhala / English rules. Pure and client-safe: both languages are rendered
// into the page and CSS hides the inactive one (html[data-lang]), so the
// server never reads the language cookie and catalog pages stay static.

export type Lang = "si" | "en";

export const LANG_COOKIE = "nb_lang";

/** Admin-controlled: the language first-time visitors see, and the switcher. */
export type LangSettings = { defaultLang: Lang; bilingual: boolean };

export const DEFAULT_LANG_SETTINGS: LangSettings = { defaultLang: "si", bilingual: true };

export function isLang(value: unknown): value is Lang {
  return value === "si" || value === "en";
}

/** The visitor's language: their cookie while the switcher is on, else the default. */
export function resolveLang(cookieValue: string | undefined, settings: LangSettings): Lang {
  if (settings.bilingual && isLang(cookieValue)) return cookieValue;
  return settings.defaultLang;
}

/** The value of the language cookie in a `document.cookie` string. */
export function readLangCookie(cookieHeader: string): string | undefined {
  for (const part of cookieHeader.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === LANG_COOKIE) return rest.join("=");
  }
  return undefined;
}

/** One of two texts, for attributes and alerts; an empty side falls back to the other. */
export function tr(lang: Lang, si: string, en: string): string {
  const picked = lang === "si" ? si : en;
  return picked || (lang === "si" ? en : si);
}

/**
 * Source of the inline <head> script that sets html[lang] and html[data-lang]
 * before first paint. It repeats readLangCookie + resolveLang in ES5; the
 * tests run it against those functions to keep the two in step.
 */
export function langBootScript(settings: LangSettings): string {
  const config = JSON.stringify({ d: settings.defaultLang, b: settings.bilingual });
  return (
    "try{var c=" + config + ",l=c.d;" +
    "if(c.b){var m=document.cookie.split(';');" +
    "for(var i=0;i<m.length;i++){var p=m[i].replace(/^\\s+/,'').split('=');" +
    "if(p[0]==='" + LANG_COOKIE + "'){var v=p.slice(1).join('=');if(v==='si'||v==='en')l=v;}}}" +
    "var h=document.documentElement;h.lang=l;h.dataset.lang=l;}catch(e){}"
  );
}
