"use client";

import Link from "next/link";
import { useCart } from "@/app/context/CartContext";
import { effectivePrice, formatPrice, getProduct } from "@/lib/products";
import ProductImage from "./ProductImage";

const SHIPPING_THRESHOLD = 7500; // Free shipping over $75.
const SHIPPING_FLAT = 800;

export default function CartView() {
  const { lines, setQuantity, removeItem, clear, subtotal, hydrated } =
    useCart();

  // Avoid a hydration mismatch: render nothing until the client cart is read.
  if (!hydrated) {
    return (
      <p className="py-16 font-mono text-sm text-muted">Loading cart…</p>
    );
  }

  if (lines.length === 0) {
    return (
      <div className="flex flex-col items-start gap-5 py-16">
        <p className="display text-3xl">Your cart is empty</p>
        <p className="max-w-sm text-muted">
          Nothing packed yet. Start with the field favourites.
        </p>
        <Link
          href="/products"
          className="rounded-full bg-blaze px-6 py-3 font-medium text-white transition-transform hover:-translate-y-0.5"
        >
          Browse the shop
        </Link>
      </div>
    );
  }

  const shipping = subtotal >= SHIPPING_THRESHOLD ? 0 : SHIPPING_FLAT;
  const total = subtotal + shipping;

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_20rem]">
      <ul className="flex flex-col border-t border-line">
        {lines.map((line) => {
          const product = getProduct(line.id);
          if (!product) return null;
          return (
            <li
              key={`${line.id}::${line.size}`}
              className="flex gap-4 border-b border-line py-5"
            >
              <Link
                href={`/products/${product.id}`}
                className="shrink-0 overflow-hidden rounded-lg border border-line"
                aria-label={product.name}
              >
                <ProductImage product={product} className="h-28 w-24" />
              </Link>
              <div className="flex flex-1 flex-col gap-1">
                <div className="flex justify-between gap-4">
                  <Link
                    href={`/products/${product.id}`}
                    className="font-medium hover:underline"
                  >
                    {product.name}
                  </Link>
                  <span className="font-mono text-sm">
                    {formatPrice(effectivePrice(product) * line.quantity)}
                  </span>
                </div>
                <span className="font-mono text-[0.7rem] uppercase tracking-[0.14em] text-muted">
                  Size {line.size} · {formatPrice(effectivePrice(product))} ea
                  {product.salePrice != null && (
                    <span className="ml-1 text-blaze">· sale</span>
                  )}
                </span>
                <div className="mt-auto flex items-center gap-3 pt-3">
                  <div className="flex items-center rounded-md border border-line">
                    <button
                      type="button"
                      onClick={() =>
                        setQuantity(line.id, line.size, line.quantity - 1)
                      }
                      className="px-3 py-1 text-lg leading-none text-muted hover:text-ink"
                      aria-label="Decrease quantity"
                    >
                      −
                    </button>
                    <span className="min-w-8 text-center font-mono text-sm">
                      {line.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setQuantity(line.id, line.size, line.quantity + 1)
                      }
                      className="px-3 py-1 text-lg leading-none text-muted hover:text-ink"
                      aria-label="Increase quantity"
                    >
                      +
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeItem(line.id, line.size)}
                    className="font-mono text-[0.7rem] uppercase tracking-[0.14em] text-muted underline-offset-4 hover:text-blaze hover:underline"
                  >
                    Remove
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <aside className="h-fit border border-line bg-surface p-6">
        <h2 className="eyebrow text-muted">Order summary</h2>
        <dl className="mt-5 flex flex-col gap-2.5 font-mono text-sm">
          <div className="flex justify-between">
            <dt className="text-muted">Subtotal</dt>
            <dd>{formatPrice(subtotal)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted">Shipping</dt>
            <dd>{shipping === 0 ? "Free" : formatPrice(shipping)}</dd>
          </div>
          <div className="mt-2 flex justify-between border-t border-line pt-3 text-base">
            <dt>Total</dt>
            <dd>{formatPrice(total)}</dd>
          </div>
        </dl>
        {shipping > 0 && (
          <p className="mt-3 font-mono text-[0.7rem] text-muted">
            Add {formatPrice(SHIPPING_THRESHOLD - subtotal)} more for free
            shipping.
          </p>
        )}
        <button
          type="button"
          onClick={() =>
            alert("This is a demo store — checkout isn't wired up yet.")
          }
          className="mt-6 w-full rounded-full bg-blaze py-4 font-medium text-white transition-transform hover:-translate-y-0.5"
        >
          Checkout
        </button>
        <button
          type="button"
          onClick={clear}
          className="mt-2 w-full py-2 font-mono text-[0.7rem] uppercase tracking-[0.14em] text-muted hover:text-ink"
        >
          Clear cart
        </button>
      </aside>
    </div>
  );
}
