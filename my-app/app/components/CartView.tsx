"use client";

import Link from "next/link";
import { useCart } from "@/app/context/CartContext";
import { MAX_LINE_QUANTITY } from "@/lib/cart-rules";
import { summarizeCart } from "@/lib/cart-summary";
import type { Promotion } from "@/lib/promotions";
import { formatPrice, type Category, type Product } from "@/lib/products";
import { CartProgress, CartTotals, LinePrice } from "./CartTotals";
import ProductImage from "./ProductImage";
import L from "./L";
import { useLang } from "@/app/context/LangContext";
import { tr } from "@/lib/i18n";
import { maxQuantity } from "@/lib/stock";

export default function CartView({
  products,
  promotions,
  shippingFee,
  categories,
}: {
  products: Product[];
  promotions: Promotion[];
  shippingFee: number;
  categories: Category[];
}) {
  const { lines, setQuantity, removeItem, clear, hydrated } = useCart();
  const lang = useLang();
  // Lines for products no longer in the catalog are skipped, not charged.
  const summary = summarizeCart(lines, products, promotions, shippingFee, categories);
  const { items } = summary;

  // Avoid a hydration mismatch: render nothing until the client cart is read.
  if (!hydrated) {
    return (
      <p className="py-16 font-mono text-sm text-muted">
        <L si="කරත්තය පූරණය වෙමින්…" en="Loading cart…" />
      </p>
    );
  }

  // A cart holding only products that are gone counts as empty.
  if (items.length === 0) {
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

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_20rem]">
      <ul className="flex flex-col border-t border-line">
        {items.map(({ line, product, unitPrice, compareAt, promotion }) => {
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
                  showCategory={false}
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
                    {formatPrice(unitPrice * line.quantity)}
                  </span>
                </div>
                <span className="font-mono text-[0.7rem] uppercase tracking-[0.14em] text-muted">
                  <L si="ප්‍රමාණය" en="Size" /> {line.size} · <L si="එකක්" en="each" />
                </span>
                <LinePrice unitPrice={unitPrice} compareAt={compareAt} promotion={promotion} />
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
                      disabled={line.quantity >= Math.min(MAX_LINE_QUANTITY, maxQuantity(product, line.size))}
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
        <CartTotals summary={summary} className="mt-5" />
        <div className="mt-4">
          <CartProgress summary={summary} />
        </div>
        <Link
          href="/checkout"
          className="mt-6 block w-full rounded-full bg-blaze py-4 text-center font-medium text-white transition-transform hover:-translate-y-0.5"
        >
          <L si="Checkout" en="Checkout" />
        </Link>
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
