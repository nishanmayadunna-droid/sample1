"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useLang } from "@/app/context/LangContext";
import { productsInCategory } from "@/lib/category-form";
import { shelfProducts } from "@/lib/home-sections";
import { tr } from "@/lib/i18n";
import type { Category, PricedProduct } from "@/lib/products";
import L from "./L";
import ProductGrid from "./ProductGrid";

/**
 * Category pills over the shop's grid. Switching is instant: the page passes
 * every priced product and the shelf filters on the client.
 */
export default function CategoryShelf({
  products,
  categories,
}: {
  products: PricedProduct[];
  categories: Category[];
}) {
  const lang = useLang();
  // Only categories that have products get a tab.
  const tabs: (Category | null)[] = [
    null,
    ...categories.filter((c) => productsInCategory(products, c, categories).length > 0),
  ];
  const [index, setIndex] = useState(0);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const active = tabs[index] ?? null;
  const { items, more } = shelfProducts(products, active, categories);

  function onKeyDown(event: React.KeyboardEvent) {
    const next =
      event.key === "ArrowRight"
        ? (index + 1) % tabs.length
        : event.key === "ArrowLeft"
          ? (index - 1 + tabs.length) % tabs.length
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? tabs.length - 1
              : null;
    if (next === null) return;
    event.preventDefault();
    setIndex(next);
    tabRefs.current[next]?.focus();
  }

  return (
    <section className="mx-auto w-full max-w-6xl px-4 pt-14 sm:px-6">
      <h2 className="display text-[clamp(1.5rem,4vw,2.25rem)]">
        <L si="ඔබට ගැළපෙන දේ" en="Explore the shop" />
      </h2>
      <div
        role="tablist"
        aria-label={tr(lang, "වර්ග", "Categories")}
        onKeyDown={onKeyDown}
        className="-mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:-mx-6 sm:px-6"
      >
        {tabs.map((tab, i) => (
          <button
            key={tab?.slug ?? "all"}
            ref={(el) => {
              tabRefs.current[i] = el;
            }}
            type="button"
            role="tab"
            id={`shelf-tab-${i}`}
            aria-selected={i === index}
            aria-controls="shelf-panel"
            tabIndex={i === index ? 0 : -1}
            onClick={() => setIndex(i)}
            className={`shrink-0 rounded-full border px-4 py-2 text-sm transition-colors ${
              i === index ? "border-ink bg-ink text-bg" : "border-line hover:border-ink"
            }`}
          >
            {tab ? tab.name : <L si="සියල්ල" en="All" />}
          </button>
        ))}
      </div>
      <div id="shelf-panel" role="tabpanel" aria-labelledby={`shelf-tab-${index}`} className="mt-6">
        {items.length === 0 ? (
          <p className="text-muted">
            <L si="තවම භාණ්ඩ නැහැ" en="No products yet" />
          </p>
        ) : (
          <ProductGrid products={items} />
        )}
        {more && (
          <Link
            href={active ? `/products?category=${encodeURIComponent(active.slug)}` : "/products"}
            className="mt-8 inline-block rounded-full border border-ink px-6 py-3 text-sm font-medium hover:bg-ink hover:text-bg"
          >
            {active ? (
              <L si={`${active.name} ඔක්කොම බලන්න →`} en={`See all in ${active.name} →`} />
            ) : (
              <L si="සියලු භාණ්ඩ බලන්න →" en="See all products →" />
            )}
          </Link>
        )}
      </div>
    </section>
  );
}
