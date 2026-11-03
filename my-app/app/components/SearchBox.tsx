"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLang } from "@/app/context/LangContext";
import { tr } from "@/lib/i18n";
import { matchesQuery } from "@/lib/product-filters";
import { formatPrice, type Category, type ShellProduct } from "@/lib/products";
import { itemPricing, type Promotion } from "@/lib/promotions";
import L from "./L";
import ProductImage from "./ProductImage";

const MIN_CHARS = 2;
const MAX_RESULTS = 5;

/** Header search: instant matches in a dropdown; Enter opens the full results. */
export default function SearchBox({
  products,
  promotions,
  categories,
}: {
  products: ShellProduct[];
  promotions: Promotion[];
  categories: Category[];
}) {
  const router = useRouter();
  const lang = useLang();
  const id = useId();
  const listId = `${id}-results`;
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);

  const text = query.trim();
  const showList = open && text.length >= MIN_CHARS;
  const matches = showList
    ? products.filter((p) => matchesQuery(p, text)).slice(0, MAX_RESULTS)
    : [];

  function close() {
    setOpen(false);
    setActive(-1);
  }

  function go(href: string) {
    close();
    router.push(href);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" && matches.length > 0) {
      event.preventDefault();
      setOpen(true);
      setActive((i) => (i + 1) % matches.length);
    } else if (event.key === "ArrowUp" && matches.length > 0) {
      event.preventDefault();
      setActive((i) => (i <= 0 ? matches.length - 1 : i - 1));
    } else if (event.key === "Escape") {
      close();
    }
  }

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const picked = active >= 0 ? matches[active] : undefined;
    if (picked) go(`/products/${picked.id}`);
    else if (text) go(`/products?q=${encodeURIComponent(text)}`);
  }

  return (
    <form role="search" onSubmit={onSubmit} className="relative w-full">
      <input
        type="search"
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
        aria-label={tr(lang, "භාණ්ඩ සොයන්න", "Search products")}
        placeholder={tr(lang, "භාණ්ඩ සොයන්න…", "Search products…")}
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
          setActive(-1);
        }}
        onFocus={() => setOpen(true)}
        // Delay so a click on a result lands before the list closes.
        onBlur={() => window.setTimeout(close, 150)}
        onKeyDown={onKeyDown}
        className="h-11 w-full rounded-full border-2 border-ink bg-bg pl-5 pr-12 text-sm outline-none placeholder:text-muted focus:border-blaze"
      />
      <button
        type="submit"
        aria-label={tr(lang, "සොයන්න", "Search")}
        className="absolute right-1 top-1 flex h-9 w-9 items-center justify-center rounded-full bg-ink text-bg"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true" className="h-4 w-4">
          <path d="M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4" strokeLinecap="round" />
        </svg>
      </button>

      {showList && (
        <div className="absolute inset-x-0 top-full z-40 mt-2 overflow-hidden rounded-xl border border-line bg-bg shadow-lg">
          {products.length === 0 ? (
            <p className="px-4 py-3 text-sm text-muted">
              <L si="සෙවීම දැනට ලබාගත නොහැක" en="Search unavailable" />
            </p>
          ) : matches.length === 0 ? (
            <div className="px-4 py-3 text-sm text-muted">
              <L si="ගැළපෙන භාණ්ඩ නැහැ" en="No matches" />
              {" · "}
              <Link href="/products?view=deals" onClick={close} className="text-blaze underline">
                ⚡ Flash Deals
              </Link>
            </div>
          ) : (
            <ul id={listId} role="listbox" aria-label={tr(lang, "සෙවුම් ප්‍රතිඵල", "Search results")}>
              {matches.map((product, i) => (
                <li
                  key={product.id}
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={i === active}
                  // mousedown, not click: it fires before the input's blur.
                  onMouseDown={(event) => {
                    event.preventDefault();
                    go(`/products/${product.id}`);
                  }}
                  onMouseEnter={() => setActive(i)}
                  className={`flex cursor-pointer items-center gap-3 px-3 py-2 ${
                    i === active ? "bg-surface" : ""
                  }`}
                >
                  <ProductImage
                    showCategory={false}
                    product={product}
                    className="h-12 w-10 shrink-0 rounded"
                    sizes="40px"
                  />
                  <span className="flex-1 text-sm">{product.name}</span>
                  <SearchPrice pricing={itemPricing(product, promotions, categories)} />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </form>
  );
}

function SearchPrice({ pricing }: { pricing: ReturnType<typeof itemPricing> }) {
  return (
    <span className="text-right font-mono text-xs">
      {pricing.compareAt != null ? (
        <>
          <span className="block text-blaze">{formatPrice(pricing.price)}</span>
          <span className="block text-muted line-through">{formatPrice(pricing.compareAt)}</span>
        </>
      ) : (
        formatPrice(pricing.price)
      )}
    </span>
  );
}
