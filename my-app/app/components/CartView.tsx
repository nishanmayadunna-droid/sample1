"use client";

import Link from "next/link";
import { useCart } from "@/app/context/CartContext";
import { formatPrice, getProduct } from "@/lib/products";
import ProductImage from "./ProductImage";

const SHIPPING_THRESHOLD = 7500; // Free shipping over $75.
const SHIPPING_FLAT = 800;

export default function CartView() {
  const { lines, setQuantity, removeItem, clear, subtotal, hydrated } =
    useCart();

  // Avoid a hydration mismatch: render nothing until the client cart is read.
  if (!hydrated) {
    return (
      <p className="py-16 text-center text-zinc-500 dark:text-zinc-400">
        Loading cart…
      </p>
    );
  }

  if (lines.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 py-20 text-center">
        <p className="text-lg text-zinc-600 dark:text-zinc-300">
          Your cart is empty.
        </p>
        <Link
          href="/products"
          className="rounded-full bg-foreground px-6 py-3 font-medium text-background transition-opacity hover:opacity-90"
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
      <ul className="flex flex-col divide-y divide-black/[.08] dark:divide-white/[.12]">
        {lines.map((line) => {
          const product = getProduct(line.id);
          if (!product) return null;
          return (
            <li key={`${line.id}::${line.size}`} className="flex gap-4 py-5">
              <Link
                href={`/products/${product.id}`}
                className="shrink-0"
                aria-label={product.name}
              >
                <ProductImage
                  product={product}
                  className="h-24 w-20 rounded-lg"
                />
              </Link>
              <div className="flex flex-1 flex-col gap-1">
                <div className="flex justify-between gap-4">
                  <Link
                    href={`/products/${product.id}`}
                    className="font-medium hover:underline"
                  >
                    {product.name}
                  </Link>
                  <span className="font-medium">
                    {formatPrice(product.price * line.quantity)}
                  </span>
                </div>
                <span className="text-sm text-zinc-500 dark:text-zinc-400">
                  Size {line.size} · {formatPrice(product.price)} each
                </span>
                <div className="mt-auto flex items-center gap-3 pt-2">
                  <div className="flex items-center rounded-md border border-black/[.15] dark:border-white/[.2]">
                    <button
                      type="button"
                      onClick={() =>
                        setQuantity(line.id, line.size, line.quantity - 1)
                      }
                      className="px-3 py-1 text-lg leading-none hover:bg-black/[.04] dark:hover:bg-white/[.06]"
                      aria-label="Decrease quantity"
                    >
                      −
                    </button>
                    <span className="min-w-8 text-center text-sm">
                      {line.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setQuantity(line.id, line.size, line.quantity + 1)
                      }
                      className="px-3 py-1 text-lg leading-none hover:bg-black/[.04] dark:hover:bg-white/[.06]"
                      aria-label="Increase quantity"
                    >
                      +
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeItem(line.id, line.size)}
                    className="text-sm text-zinc-500 underline underline-offset-4 hover:text-red-600 dark:text-zinc-400"
                  >
                    Remove
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <aside className="h-fit rounded-xl border border-black/[.08] bg-white p-6 dark:border-white/[.12] dark:bg-zinc-950">
        <h2 className="text-lg font-semibold">Order summary</h2>
        <dl className="mt-4 flex flex-col gap-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-zinc-500 dark:text-zinc-400">Subtotal</dt>
            <dd>{formatPrice(subtotal)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-zinc-500 dark:text-zinc-400">Shipping</dt>
            <dd>{shipping === 0 ? "Free" : formatPrice(shipping)}</dd>
          </div>
          <div className="mt-2 flex justify-between border-t border-black/[.08] pt-3 text-base font-semibold dark:border-white/[.12]">
            <dt>Total</dt>
            <dd>{formatPrice(total)}</dd>
          </div>
        </dl>
        {shipping > 0 && (
          <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
            Add {formatPrice(SHIPPING_THRESHOLD - subtotal)} more for free
            shipping.
          </p>
        )}
        <button
          type="button"
          onClick={() =>
            alert("This is a demo store — checkout isn't wired up yet.")
          }
          className="mt-6 h-12 w-full rounded-full bg-foreground font-medium text-background transition-opacity hover:opacity-90"
        >
          Checkout
        </button>
        <button
          type="button"
          onClick={clear}
          className="mt-2 h-10 w-full rounded-full text-sm text-zinc-500 hover:text-black dark:text-zinc-400 dark:hover:text-white"
        >
          Clear cart
        </button>
      </aside>
    </div>
  );
}
