"use client";

import { useRef, useState } from "react";
import { useLang } from "@/app/context/LangContext";
import { tr } from "@/lib/i18n";
import type { Product } from "@/lib/products";
import ProductImage from "./ProductImage";

const SWIPE_PX = 40;

/** The product page's photos: one large photo, a thumbnail row and swipe on touch. */
export default function ProductGallery({ product }: { product: Product }) {
  const lang = useLang();
  const photos = product.gallery;
  const [index, setIndex] = useState(0);
  const thumbRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const swipeStart = useRef<number | null>(null);
  const current = Math.min(index, Math.max(photos.length - 1, 0));

  function go(next: number) {
    setIndex(next);
    thumbRefs.current[next]?.focus();
  }

  function onThumbKeyDown(event: React.KeyboardEvent) {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      go((current + 1) % photos.length);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      go((current - 1 + photos.length) % photos.length);
    }
  }

  function onPointerUp(event: React.PointerEvent) {
    const start = swipeStart.current;
    swipeStart.current = null;
    if (start === null || photos.length < 2) return;
    const dx = event.clientX - start;
    if (Math.abs(dx) < SWIPE_PX) return;
    setIndex(dx < 0 ? Math.min(current + 1, photos.length - 1) : Math.max(current - 1, 0));
  }

  return (
    <div>
      <div
        className="overflow-hidden rounded-2xl border border-line"
        onPointerDown={(event) => {
          swipeStart.current = event.clientX;
        }}
        onPointerUp={onPointerUp}
        onPointerCancel={() => {
          swipeStart.current = null;
        }}
        // Vertical scrolling stays native; only horizontal drags are read.
        style={{ touchAction: "pan-y" }}
      >
        <ProductImage
          product={{ ...product, imageUrl: photos[current] }}
          className="aspect-[4/5] w-full"
          sizes="(min-width: 768px) 50vw, 100vw"
          preload={current === 0}
        />
      </div>
      {photos.length > 1 && (
        <div
          className="mt-3 flex gap-2 overflow-x-auto pb-1"
          role="group"
          aria-label={tr(lang, "ඡායාරූප", "Photos")}
          onKeyDown={onThumbKeyDown}
        >
          {photos.map((url, i) => (
            <button
              key={url}
              ref={(el) => {
                thumbRefs.current[i] = el;
              }}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={tr(lang, `ඡායාරූපය ${i + 1} / ${photos.length}`, `Photo ${i + 1} of ${photos.length}`)}
              aria-current={i === current}
              tabIndex={i === current ? 0 : -1}
              className={`h-16 w-14 shrink-0 overflow-hidden rounded-lg border-2 ${
                i === current ? "border-blaze" : "border-line hover:border-ink"
              }`}
            >
              <ProductImage
                product={{ ...product, imageUrl: url }}
                showCategory={false}
                className="h-full w-full"
                sizes="56px"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
