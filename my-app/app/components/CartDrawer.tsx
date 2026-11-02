"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCart } from "@/app/context/CartContext";
import { closeCartDrawer, useCartDrawer } from "@/app/context/CartDrawerContext";
import { useLang } from "@/app/context/LangContext";
import { MAX_LINE_QUANTITY } from "@/lib/cart-rules";
import { summarizeCart } from "@/lib/cart-summary";
import { tr } from "@/lib/i18n";
import {
  effectivePrice,
  formatPrice,
  FREE_SHIPPING_THRESHOLD,
  type ShellProduct,
} from "@/lib/products";
import L from "./L";
import ProductImage from "./ProductImage";

const FOCUSABLE = 'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])';

/** Slide-out cart, mounted once in the root layout. */
export default function CartDrawer({ products }: { products: ShellProduct[] }) {
  const open = useCartDrawer();
  const { lines, setQuantity, removeItem } = useCart();
  const lang = useLang();
  const router = useRouter();
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  // While open: focus the close button, lock page scroll, Esc closes.
  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    // The product list comes from the root layout, which an open tab never
    // re-fetches on its own; refresh it so prices and hidden products are current.
    router.refresh();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeCartDrawer();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKey);
    };
  }, [open, router]);

  if (!open) return null;

  // Task 5 passes the real promotions, fee and categories.
  const { items, itemCount, subtotal, nudges } = summarizeCart(lines, products, [], 35000, []);
  const toFreeShipping = nudges.find((n) => n.kind === "free_shipping")?.missing ?? 0;
  const progress = Math.min(100, Math.round((subtotal / FREE_SHIPPING_THRESHOLD) * 100));

  // Keep Tab inside the drawer.
  function trapTab(event: React.KeyboardEvent) {
    if (event.key !== "Tab" || !panelRef.current) return;
    const focusable = [...panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <div className="fixed inset-0 z-50">
      <div
        className="absolute inset-0 bg-black/40"
        aria-hidden="true"
        onClick={closeCartDrawer}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cart-drawer-title"
        onKeyDown={trapTab}
        className="drawer-in absolute inset-y-0 right-0 flex w-full flex-col bg-bg shadow-2xl sm:w-[420px]"
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 id="cart-drawer-title" className="display text-2xl">
            <L si="කරත්තය" en="Cart" /> ({itemCount})
          </h2>
          <button
            ref={closeRef}
            type="button"
            onClick={closeCartDrawer}
            aria-label={tr(lang, "වසන්න", "Close")}
            className="rounded-full px-2 py-1 text-xl leading-none text-muted hover:text-ink"
          >
            ✕
          </button>
        </div>

        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-start gap-4 px-5 py-10">
            <p className="display text-2xl">
              <L si="ඔබේ කරත්තය හිස්" en="Your cart is empty" />
            </p>
            <Link
              href="/products?view=deals"
              onClick={closeCartDrawer}
              className="rounded-full bg-blaze px-6 py-3 font-medium text-white"
            >
              <L si="⚡ Flash Deals බලන්න" en="⚡ See Flash Deals" />
            </Link>
          </div>
        ) : (
          <>
            <div className="border-b border-line px-5 py-4">
              <p className="text-sm">
                {toFreeShipping > 0 ? (
                  <L
                    si={`නොමිලේ බෙදාහැරීමට තව ${formatPrice(toFreeShipping)} ක් එක් කරන්න`}
                    en={`Add ${formatPrice(toFreeShipping)} more for free shipping`}
                  />
                ) : (
                  <span className="text-blaze">
                    <L si="✓ ඔබට නොමිලේ බෙදාහැරීම ලැබේ" en="✓ You've got free shipping" />
                  </span>
                )}
              </p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line">
                <div className="h-full bg-blaze" style={{ width: `${progress}%` }} />
              </div>
            </div>

            <ul className="flex-1 divide-y divide-line overflow-y-auto px-5">
              {items.map(({ line, product }) => (
                <li key={`${line.id}::${line.size}`} className="flex gap-3 py-4">
                  <Link
                    href={`/products/${product.id}`}
                    onClick={closeCartDrawer}
                    className="shrink-0 overflow-hidden rounded-md border border-line"
                    aria-label={product.name}
                  >
                    <ProductImage product={product} className="h-20 w-16" sizes="64px" />
                  </Link>
                  <div className="flex flex-1 flex-col gap-1">
                    <div className="flex justify-between gap-3">
                      <span className="text-sm font-medium">{product.name}</span>
                      <span className="font-mono text-sm">
                        {formatPrice(effectivePrice(product) * line.quantity)}
                      </span>
                    </div>
                    <span className="font-mono text-[0.7rem] uppercase tracking-[0.14em] text-muted">
                      <L si="ප්‍රමාණය" en="Size" /> {line.size}
                    </span>
                    <div className="mt-auto flex items-center gap-3 pt-1">
                      <div className="flex items-center rounded-md border border-line">
                        <button
                          type="button"
                          onClick={() => setQuantity(line.id, line.size, line.quantity - 1)}
                          aria-label={tr(lang, "ප්‍රමාණය අඩු කරන්න", "Decrease quantity")}
                          className="px-2.5 py-0.5 text-muted hover:text-ink"
                        >
                          −
                        </button>
                        <span className="min-w-6 text-center font-mono text-sm">
                          {line.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => setQuantity(line.id, line.size, line.quantity + 1)}
                          disabled={line.quantity >= MAX_LINE_QUANTITY}
                          aria-label={tr(lang, "ප්‍රමාණය වැඩි කරන්න", "Increase quantity")}
                          className="px-2.5 py-0.5 text-muted hover:text-ink disabled:opacity-40"
                        >
                          +
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeItem(line.id, line.size)}
                        className="font-mono text-[0.7rem] uppercase tracking-[0.14em] text-muted hover:text-blaze"
                      >
                        <L si="ඉවත් කරන්න" en="Remove" />
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            <div className="border-t border-line px-5 py-4">
              <div className="flex justify-between font-mono">
                <span className="text-muted">
                  <L si="උප එකතුව" en="Subtotal" />
                </span>
                <span>{formatPrice(subtotal)}</span>
              </div>
              <Link
                href="/cart"
                onClick={closeCartDrawer}
                className="mt-4 block rounded-full bg-blaze py-3.5 text-center font-medium text-white transition-transform hover:-translate-y-0.5"
              >
                <L si="කරත්තය බලන්න" en="View cart" />
              </Link>
              <button
                type="button"
                onClick={closeCartDrawer}
                className="mt-2 w-full py-2 font-mono text-[0.7rem] uppercase tracking-[0.14em] text-muted hover:text-ink"
              >
                <L si="තවත් බලන්න" en="Continue shopping" />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
