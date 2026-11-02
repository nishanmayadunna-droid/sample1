"use client";

import Link from "next/link";
import { useCart } from "@/app/context/CartContext";
import { MAX_LINE_QUANTITY } from "@/lib/cart-rules";
import {
  effectivePrice,
  formatPrice,
  FREE_SHIPPING_THRESHOLD,
  SHIPPING_FLAT,
  type Product,
} from "@/lib/products";
import ProductImage from "./ProductImage";
import L from "./L";
import { useLang } from "@/app/context/LangContext";
import { tr } from "@/lib/i18n";

export default function CartView({ products }: { products: Product[] }) {
  const { lines, setQuantity, removeItem, clear, hydrated } = useCart();
  const lang = useLang();
  const getProduct = (id: string) => products.find((p) => p.id === id);
  // Lines for products no longer in the catalog are skipped, not charged.
  const subtotal = lines.reduce((sum, l) => {
    const product = getProduct(l.id);
    return sum + (product ? effectivePrice(product) * l.quantity : 0);
  }, 0);

  // Avoid a hydration mismatch: render nothing until the client cart is read.
  if (!hydrated) {
    return (
      <p className="py-16 font-mono text-sm text-muted">
        <L si="කරත්තය පූරණය වෙමින්…" en="Loading cart…" />
      </p>
    );
  }

  if (lines.length === 0) {
    return (
      <div className="flex flex-col items-start gap-5 py-16">
        <p className="display text-3xl">
          <L si="ඔබේ කරත්තය හිස්" en="Your cart is empty" />
        </p>
        <p className="max-w-sm text-muted">
          <L
            si="තවම කිසිවක් එක් කර නැහැ. ජනප්‍රිය භාණ්ඩවලින් පටන් ගන්න."
            en="Nothing packed yet. Start with the field favourites."
          />
        </p>
        <Link
          href="/products"
          className="rounded-full bg-blaze px-6 py-3 font-medium text-white transition-transform hover:-translate-y-0.5"
        >
          <L si="සාප්පුව බලන්න" en="Browse the shop" />
        </Link>
      </div>
    );
  }

  const shipping = subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FLAT;
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
                <ProductImage
                  product={product}
                  className="h-28 w-24"
                  sizes="96px"
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
                  <span className="font-mono text-sm">
                    {formatPrice(effectivePrice(product) * line.quantity)}
                  </span>
                </div>
                <span className="font-mono text-[0.7rem] uppercase tracking-[0.14em] text-muted">
                  <L si="ප්‍රමාණය" en="Size" /> {line.size} · {formatPrice(effectivePrice(product))}{" "}
                  <L si="එකක්" en="ea" />
                  {product.salePrice != null && (
                    <span className="ml-1 text-blaze">
                      · <L si="අඩු මිල" en="sale" />
                    </span>
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
                      aria-label={tr(lang, "ප්‍රමාණය අඩු කරන්න", "Decrease quantity")}
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
                      disabled={line.quantity >= MAX_LINE_QUANTITY}
                      className="px-3 py-1 text-lg leading-none text-muted hover:text-ink disabled:opacity-40"
                      aria-label={tr(lang, "ප්‍රමාණය වැඩි කරන්න", "Increase quantity")}
                    >
                      +
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeItem(line.id, line.size)}
                    className="font-mono text-[0.7rem] uppercase tracking-[0.14em] text-muted underline-offset-4 hover:text-blaze hover:underline"
                  >
                    <L si="ඉවත් කරන්න" en="Remove" />
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <aside className="h-fit border border-line bg-surface p-6">
        <h2 className="eyebrow text-muted">
          <L si="ඇණවුම් සාරාංශය" en="Order summary" />
        </h2>
        <dl className="mt-5 flex flex-col gap-2.5 font-mono text-sm">
          <div className="flex justify-between">
            <dt className="text-muted">
              <L si="උප එකතුව" en="Subtotal" />
            </dt>
            <dd>{formatPrice(subtotal)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted">
              <L si="බෙදාහැරීම" en="Shipping" />
            </dt>
            <dd>{shipping === 0 ? <L si="නොමිලේ" en="Free" /> : formatPrice(shipping)}</dd>
          </div>
          <div className="mt-2 flex justify-between border-t border-line pt-3 text-base">
            <dt>
              <L si="මුළු එකතුව" en="Total" />
            </dt>
            <dd>{formatPrice(total)}</dd>
          </div>
        </dl>
        {shipping > 0 && (
          <p className="mt-3 font-mono text-[0.7rem] text-muted">
            <L
              si={`නොමිලේ බෙදාහැරීමට තව ${formatPrice(FREE_SHIPPING_THRESHOLD - subtotal)} ක් එක් කරන්න.`}
              en={`Add ${formatPrice(FREE_SHIPPING_THRESHOLD - subtotal)} more for free shipping.`}
            />
          </p>
        )}
        <button
          type="button"
          onClick={() =>
            alert(
              tr(
                lang,
                "මෙය demo සාප්පුවකි — checkout තවම සක්‍රිය නැත.",
                "This is a demo store — checkout isn't wired up yet.",
              ),
            )
          }
          className="mt-6 w-full rounded-full bg-blaze py-4 font-medium text-white transition-transform hover:-translate-y-0.5"
        >
          <L si="Checkout" en="Checkout" />
        </button>
        <button
          type="button"
          onClick={clear}
          className="mt-2 w-full py-2 font-mono text-[0.7rem] uppercase tracking-[0.14em] text-muted hover:text-ink"
        >
          <L si="කරත්තය හිස් කරන්න" en="Clear cart" />
        </button>
      </aside>
    </div>
  );
}
