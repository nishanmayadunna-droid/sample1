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
        <div className="flex flex-col gap-3">
          <span className="text-sm font-medium">
            Size{size ? `: ${size}` : ""}
          </span>
          <div className="flex flex-wrap gap-2">
            {product.sizes.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSize(s)}
                className={`min-w-12 rounded-md border px-3 py-2 text-sm transition-colors ${
                  size === s
                    ? "border-foreground bg-foreground text-background"
                    : "border-black/[.15] hover:border-foreground dark:border-white/[.2]"
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
          className="h-12 rounded-full bg-foreground px-6 font-medium text-background transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {added ? "Added to cart ✓" : "Add to cart"}
        </button>
        {!size && (
          <span className="text-sm text-zinc-500 dark:text-zinc-400">
            Select a size to continue.
          </span>
        )}
        {added && (
          <Link
            href="/cart"
            className="text-center text-sm font-medium underline underline-offset-4"
          >
            View cart
          </Link>
        )}
      </div>
    </div>
  );
}
