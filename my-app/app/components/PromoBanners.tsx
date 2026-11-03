"use client";

import { useEffect, useState } from "react";
import { useLang } from "@/app/context/LangContext";
import { tr } from "@/lib/i18n";
import type { Promotion } from "@/lib/promotions";
import PromoBanner from "./PromoBanner";

const ROTATE_MS = 6000;

/** The running promotions' banners: one on its own, several as a slider. */
export default function PromoBanners({ promotions }: { promotions: Promotion[] }) {
  const banners = promotions.filter((p) => p.banner.mode !== "none");
  const lang = useLang();
  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(false);
  // Rotation also holds while the pointer or keyboard focus is on the slider,
  // so a slide never disappears under someone reading or tabbing to it.
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const held = paused || hovered || focused;

  useEffect(() => {
    if (banners.length < 2 || held) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // setState lives inside the interval callback, not the effect body.
    const id = window.setInterval(() => setCurrent((i) => (i + 1) % banners.length), ROTATE_MS);
    return () => window.clearInterval(id);
  }, [banners.length, held]);

  if (banners.length === 0) return null;
  if (banners.length === 1) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 pt-6 sm:px-6">
        <PromoBanner promotion={banners[0]} preload />
      </div>
    );
  }

  return (
    <div
      className="mx-auto w-full max-w-6xl px-4 pt-6 sm:px-6"
      role="region"
      aria-roledescription="carousel"
      aria-label={tr(lang, "ප්‍රවර්ධන", "Promotions")}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocused(false);
      }}
    >
      {/* Every banner stays in the page; only the current one shows. */}
      {banners.map((promotion, i) => (
        <div
          key={promotion.id}
          className={i === current ? "promise-fade" : "hidden"}
          aria-hidden={i !== current}
        >
          <PromoBanner promotion={promotion} preload={i === 0} />
        </div>
      ))}
      <div className="mt-3 flex items-center justify-center gap-3">
        {banners.map((promotion, i) => (
          <button
            key={promotion.id}
            type="button"
            onClick={() => setCurrent(i)}
            aria-label={tr(lang, `${promotion.nameSi || promotion.nameEn} පෙන්වන්න`, `Show ${promotion.nameEn || promotion.nameSi}`)}
            aria-current={i === current}
            className={`h-2 rounded-full transition-all ${i === current ? "w-6 bg-blaze" : "w-2 bg-line"}`}
          />
        ))}
        <button
          type="button"
          onClick={() => setPaused((p) => !p)}
          aria-label={paused ? tr(lang, "නැවත පටන් ගන්න", "Play") : tr(lang, "නවත්වන්න", "Pause")}
          className="ml-2 font-mono text-xs text-muted hover:text-ink"
        >
          {paused ? "▶" : "❚❚"}
        </button>
      </div>
    </div>
  );
}
