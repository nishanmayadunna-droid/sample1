"use client";

import { useState } from "react";
import Link from "next/link";
import type { Product } from "@/lib/products";
import { useCart } from "@/app/context/CartContext";

export default function ProductPurchase({ product }: { product: Product }) {
  const { addItem } = useCart();
  const singleSize = product.sizes.length === 1;
  const [size, setSize] = useState<string | null>(
    singleSize ? product.sizes[0] : null,
  );
  const [added, setAdded] = useState(false);

  function handleAdd() {
    if (!size) return;
    addItem(product.id, size);
    setAdded(true);
    window.setTimeout(() => setAdded(false), 2000);
  }

  return (
    <div className="flex flex-col gap-6">
      {!singleSize && (
        <div>
          <span className="eyebrow mb-3 text-muted">
            Select size{size ? ` — ${size}` : ""}
          </span>
          <div className="flex flex-wrap gap-2">
            {product.sizes.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSize(s)}
                className={`min-w-12 rounded-md border px-3 py-2 font-mono text-sm transition-colors ${
                  size === s
                    ? "border-blaze bg-blaze text-white"
                    : "border-line hover:border-ink"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={handleAdd}
          disabled={!size}
          className="rounded-full bg-blaze px-6 py-4 font-medium text-white transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0"
        >
          {added ? "Added to cart" : "Add to cart"}
        </button>
        {!size && (
          <span className="font-mono text-xs text-muted">
            Choose a size to continue.
          </span>
        )}
        {added && (
          <Link
            href="/cart"
            className="text-center font-mono text-xs uppercase tracking-[0.14em] underline underline-offset-4"
          >
            View cart →
          </Link>
        )}
      </div>
    </div>
  );
}
