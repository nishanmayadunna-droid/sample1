"use client";

import { useEffect, useSyncExternalStore } from "react";
import { getCartLines, setCartLines, useCart } from "@/app/context/CartContext";
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
  const { hydrated } = useCart();
  const show = useVisible();

  // Runs on load, when the shop's product list is refreshed, and on window
  // focus (an account cart may have just been pulled). It deliberately does not
  // run on every cart edit: the layout's product list can be older than the
  // page the shopper added from, and acting on it would undo a fresh add.
  useEffect(() => {
    if (!hydrated || products.length === 0) return;
    function clamp() {
      const result = clampToStock(getCartLines(), products);
      if (!result.changed) return;
      setCartLines(result.lines);
      setVisible(true);
      clearTimeout(hideTimer);
      hideTimer = setTimeout(() => setVisible(false), 6000);
    }
    clamp();
    window.addEventListener("focus", clamp);
    return () => window.removeEventListener("focus", clamp);
  }, [hydrated, products]);

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
