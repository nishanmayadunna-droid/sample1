"use client";

import { useRef, useState } from "react";
import { formatPrice, type Product } from "@/lib/products";
import type { DeliveryChip } from "@/lib/product-page";
import { useCart } from "@/app/context/CartContext";
import { allSoldOut, isSoldOut, lowStockLeft, maxQuantity } from "@/lib/stock";
import { openCartDrawer } from "@/app/context/CartDrawerContext";
import L from "./L";

export default function ProductPurchase({
  product,
  price,
  chips,
}: {
  product: Product;
  /** What one unit costs under the running promotions, in cents. */
  price: number;
  chips: DeliveryChip[];
}) {
  const { addItem, lines } = useCart();
  const singleSize = product.sizes.length === 1;
  const [size, setSize] = useState<string | null>(
    singleSize ? product.sizes[0] : null,
  );
  const pillsRef = useRef<HTMLDivElement>(null);
  const soldOutEverywhere = allSoldOut(product);
  const left = size ? lowStockLeft(product, size) : null;
  // Everything in stock for this size is already in the cart.
  const inCart = size ? (lines.find((l) => l.id === product.id && l.size === size)?.quantity ?? 0) : 0;
  const atCap = size != null && inCart >= maxQuantity(product, size);
  const canAdd = size != null && !isSoldOut(product, size) && !atCap;

  function handleAdd() {
    if (!size || !canAdd) return;
    addItem(product.id, size);
    openCartDrawer();
  }

  // The phone bar has no room for the pills: with no size yet, take the
  // shopper to them instead of adding anything.
  function handleBarAdd() {
    if (soldOutEverywhere) return;
    if (size) return handleAdd();
    const pills = pillsRef.current;
    pills?.scrollIntoView({ behavior: "smooth", block: "center" });
    pills?.querySelector("button")?.focus({ preventScroll: true });
  }

  return (
    <div className="flex flex-col gap-6">
      {chips.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {chips.map((chip) => (
            <li
              key={chip.key}
              className="rounded-full border border-line px-3 py-1 text-xs"
            >
              {chip.key === "free-shipping" ? "🚚 " : ""}
              <L si={chip.si} en={chip.en} />
            </li>
          ))}
        </ul>
      )}

      {!singleSize && (
        <div>
          <span className="eyebrow mb-3 text-muted">
            <L si="ප්‍රමාණය තෝරන්න" en="Select size" />
            {size ? ` — ${size}` : ""}
          </span>
          <div ref={pillsRef} className="flex flex-wrap gap-2">
            {product.sizes.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSize(s)}
                disabled={isSoldOut(product, s)}
                aria-pressed={size === s}
                className={`min-w-12 rounded-md border px-3 py-2 font-mono text-sm transition-colors disabled:cursor-not-allowed disabled:text-muted disabled:line-through disabled:opacity-50 ${
                  size === s
                    ? "border-blaze bg-blaze text-white"
                    : "border-line hover:border-ink"
                }`}
              >
                {s}
                {isSoldOut(product, s) && (
                  <span className="sr-only">
                    <L si=" — අවසන්" en=" — sold out" />
                  </span>
                )}
              </button>
            ))}
          </div>
          {product.sizes.some((s) => isSoldOut(product, s)) && !soldOutEverywhere && (
            <p className="mt-2 font-mono text-xs text-muted">
              <L si="කැපූ ප්‍රමාණ අවසන්." en="Crossed-out sizes are sold out." />
            </p>
          )}
        </div>
      )}

      <div className="flex flex-col gap-2">
        {left != null && (
          <p className="font-mono text-xs text-blaze">
            <L si={`${left}ක් පමණක් ඉතිරියි`} en={`Only ${left} left`} />
          </p>
        )}
        <button
          type="button"
          onClick={handleAdd}
          disabled={!canAdd}
          className="rounded-full bg-blaze px-6 py-4 font-medium text-white transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0"
        >
          {soldOutEverywhere ? <L si="අවසන්" en="Sold out" /> : <L si="කරත්තයට එක් කරන්න" en="Add to cart" />}
        </button>
        {atCap && !soldOutEverywhere && (
          <span className="font-mono text-xs text-muted">
            <L si="ඇති සියල්ල ඔබේ කරත්තයේ ඇත." en="You have all we have of this size in your cart." />
          </span>
        )}
        {!size && !soldOutEverywhere && (
          <span className="font-mono text-xs text-muted">
            <L si="ඉදිරියට යාමට ප්‍රමාණයක් තෝරන්න." en="Choose a size to continue." />
          </span>
        )}
      </div>

      {/* Phones: the price and button stay in reach while the page scrolls. */}
      <div className="fixed inset-x-0 bottom-0 z-30 flex items-center gap-4 border-t border-line bg-bg px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:hidden">
        <span className="font-mono text-lg">{formatPrice(price)}</span>
        <button
          type="button"
          onClick={handleBarAdd}
          disabled={soldOutEverywhere || (size != null && !canAdd)}
          className="flex-1 rounded-full bg-blaze px-6 py-3 font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          {soldOutEverywhere ? (
            <L si="අවසන්" en="Sold out" />
          ) : size ? (
            <L si="කරත්තයට එක් කරන්න" en="Add to cart" />
          ) : (
            <L si="ප්‍රමාණය තෝරන්න" en="Choose a size" />
          )}
        </button>
      </div>
    </div>
  );
}
