"use client";

import { useMemo, useSyncExternalStore } from "react";
import { getProduct } from "@/lib/products";

const STORAGE_KEY = "storefront:cart:v1";

/** A single line in the cart: a product in a specific size, with a quantity. */
export type CartLine = {
  id: string;
  size: string;
  quantity: number;
};

// ---------------------------------------------------------------------------
// Module-level store, read via useSyncExternalStore. This keeps localStorage
// as the source of truth without syncing through setState-in-effect, and stays
// consistent across hydration and across browser tabs.
// ---------------------------------------------------------------------------

const EMPTY: CartLine[] = [];
const listeners = new Set<() => void>();
const lineKey = (id: string, size: string) => `${id}::${size}`;

function readStorage(): CartLine[] {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return Array.isArray(parsed) ? (parsed as CartLine[]) : EMPTY;
  } catch {
    return EMPTY;
  }
}

let cart: CartLine[] = readStorage();

function setCart(next: CartLine[]) {
  cart = next;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
    } catch {
      // Storage may be full or blocked; the in-memory cart still works.
    }
  }
  listeners.forEach((notify) => notify());
}

function subscribe(notify: () => void): () => void {
  listeners.add(notify);
  // Keep other tabs in sync.
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) {
      cart = readStorage();
      notify();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(notify);
    window.removeEventListener("storage", onStorage);
  };
}

const getSnapshot = () => cart;
const getServerSnapshot = () => EMPTY;

// A subscription that never changes, used only to flip `hydrated` to true after
// the first client render — no setState-in-effect required.
const noopSubscribe = () => () => {};

export function addItem(id: string, size: string, quantity = 1) {
  const key = lineKey(id, size);
  const index = cart.findIndex((l) => lineKey(l.id, l.size) === key);
  if (index === -1) {
    setCart([...cart, { id, size, quantity }]);
    return;
  }
  const next = [...cart];
  next[index] = { ...next[index], quantity: next[index].quantity + quantity };
  setCart(next);
}

export function removeItem(id: string, size: string) {
  const key = lineKey(id, size);
  setCart(cart.filter((l) => lineKey(l.id, l.size) !== key));
}

export function setQuantity(id: string, size: string, quantity: number) {
  const key = lineKey(id, size);
  if (quantity <= 0) {
    removeItem(id, size);
    return;
  }
  setCart(
    cart.map((l) => (lineKey(l.id, l.size) === key ? { ...l, quantity } : l)),
  );
}

export function clear() {
  setCart(EMPTY);
}

export function useCart() {
  const lines = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  // `true` on the client after hydration, `false` during SSR — lets consumers
  // avoid rendering cart-dependent UI before the persisted cart is available.
  const hydrated = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );

  const totalItems = useMemo(
    () => lines.reduce((n, l) => n + l.quantity, 0),
    [lines],
  );

  const subtotal = useMemo(
    () =>
      lines.reduce((sum, l) => {
        const product = getProduct(l.id);
        return sum + (product ? product.price * l.quantity : 0);
      }, 0),
    [lines],
  );

  return {
    lines,
    hydrated,
    totalItems,
    subtotal,
    addItem,
    removeItem,
    setQuantity,
    clear,
  };
}
