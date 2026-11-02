"use client";

import { setLang, useLang } from "@/app/context/LangContext";
import { tr, type Lang } from "@/lib/i18n";

const OPTIONS: { lang: Lang; label: string }[] = [
  { lang: "si", label: "සිං" },
  { lang: "en", label: "EN" },
];

/** සිං | EN switcher. Hidden when the admin turned the second language off. */
export default function LangToggle({ show }: { show: boolean }) {
  const lang = useLang();
  if (!show) return null;

  return (
    <div
      role="group"
      aria-label={tr(lang, "භාෂාව", "Language")}
      className="flex overflow-hidden rounded-full border border-line font-mono text-[0.7rem]"
    >
      {OPTIONS.map((option) => (
        <button
          key={option.lang}
          type="button"
          aria-pressed={lang === option.lang}
          onClick={() => setLang(option.lang)}
          className={`px-2.5 py-1 transition-colors ${
            lang === option.lang ? "bg-ink text-bg" : "text-muted hover:text-ink"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
