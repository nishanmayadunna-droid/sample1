"use client";

import { useEffect, useSyncExternalStore } from "react";
import { setCartLines, useCart } from "@/app/context/CartContext";
import { clampToStock } from "@/lib/cart-rules";
import type { ShellProduct } from "@/lib/products";
import L from "./L";

// The notice lives in a tiny module store so the effect below never calls
// setState (react-hooks/set-state-in-effect).
let visible = false;
let hideTimer: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();
function setVisible(next: boolean) {
  visible = next;
  listeners.forEach((l) => l());
}
function useVisible() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => visible,
    () => false,
  );
}

/**
 * Keeps the cart within the stock the shop has now: lowers or drops lines when
 * an admin cut the stock, and tells the shopper once. Render-less otherwise.
 */
export default function CartStockGuard({ products }: { products: ShellProduct[] }) {
  const { lines, hydrated } = useCart();
  const show = useVisible();

  useEffect(() => {
    if (!hydrated || products.length === 0) return;
    const result = clampToStock(lines, products);
    if (!result.changed) return;
    setCartLines(result.lines);
    setVisible(true);
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => setVisible(false), 6000);
  }, [lines, hydrated, products]);

  if (!show) return null;
  return (
    <div
      role="status"
      className="fixed inset-x-4 bottom-20 z-50 mx-auto max-w-md rounded-lg bg-panel px-4 py-3 text-sm text-panelink shadow-lg sm:bottom-6"
    >
      <L si="අපට ඇති තොගයට අනුව ඔබේ කරත්තයේ සමහර අයිතම අඩු කළා." en="Some items in your cart were reduced to what we have in stock." />
    </div>
  );
}
