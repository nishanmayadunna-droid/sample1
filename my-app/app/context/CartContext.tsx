"use client";

import { useMemo, useSyncExternalStore } from "react";
import { clampQuantity, MAX_CART_LINES, type CartLine } from "@/lib/cart-rules";

export type { CartLine } from "@/lib/cart-rules";

const STORAGE_KEY = "storefront:cart:v1";
// Which signed-in user the browser cart belongs to (absent for a guest cart).
const OWNER_KEY = "storefront:cart:owner";
// Set while this user's cart has local changes the server hasn't confirmed.
// Shared by all tabs and survives reloads, so no tab pulls over them.
const DIRTY_KEY = "storefront:cart:dirty";

/**
 * Where a cart change came from: "local" for the shopper's own edits in this
 * tab, "remote" for a cart applied from the server or another tab. Only local
 * changes are saved to the account, which keeps sync from looping.
 */
export type CartChangeSource = "local" | "remote";

// ---------------------------------------------------------------------------
// Module-level store, read via useSyncExternalStore. This keeps localStorage
// as the source of truth without syncing through setState-in-effect, and stays
// consistent across hydration and across browser tabs.
// ---------------------------------------------------------------------------

const EMPTY: CartLine[] = [];
const listeners = new Set<() => void>();
const changeListeners = new Set<
  (lines: CartLine[], source: CartChangeSource) => void
>();
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

function setCart(next: CartLine[], source: CartChangeSource = "local") {
  cart = next;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
    } catch {
      // Storage may be full or blocked; the in-memory cart still works.
    }
  }
  listeners.forEach((notify) => notify());
  changeListeners.forEach((listener) => listener(cart, source));
}

function readOwner(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(OWNER_KEY);
  } catch {
    return null;
  }
}

let owner: string | null = readOwner();

function readDirty(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(DIRTY_KEY) === "1";
  } catch {
    return false;
  }
}

let dirty = readDirty();

function subscribe(notify: () => void): () => void {
  listeners.add(notify);
  // Keep other tabs in sync.
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) {
      cart = readStorage();
      notify();
    } else if (event.key === OWNER_KEY) {
      owner = readOwner();
    } else if (event.key === DIRTY_KEY) {
      dirty = readDirty();
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

// Limits match lib/cart-rules.ts, which the account sync enforces server-side,
// so the browser never holds a cart the server would trim.
export function addItem(id: string, size: string, quantity = 1) {
  const key = lineKey(id, size);
  const index = cart.findIndex((l) => lineKey(l.id, l.size) === key);
  if (index === -1) {
    if (cart.length >= MAX_CART_LINES) return;
    setCart([...cart, { id, size, quantity: clampQuantity(quantity) }]);
    return;
  }
  const next = [...cart];
  next[index] = {
    ...next[index],
    quantity: clampQuantity(next[index].quantity + quantity),
  };
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
  const capped = clampQuantity(quantity);
  setCart(
    cart.map((l) =>
      lineKey(l.id, l.size) === key ? { ...l, quantity: capped } : l,
    ),
  );
}

export function clear() {
  setCart(EMPTY);
}

// ---------------------------------------------------------------------------
// Account sync hooks (used by app/components/CartSync.tsx).
// ---------------------------------------------------------------------------

/** Replaces the whole cart with lines from the server; reported as "remote". */
export function replaceCart(lines: CartLine[]) {
  setCart(lines.length === 0 ? EMPTY : lines, "remote");
}

export function getCartLines(): CartLine[] {
  return cart;
}

export function onCartChange(
  listener: (lines: CartLine[], source: CartChangeSource) => void,
): () => void {
  changeListeners.add(listener);
  return () => {
    changeListeners.delete(listener);
  };
}

export function getCartOwner(): string | null {
  return owner;
}

export function setCartOwner(next: string | null) {
  owner = next;
  if (typeof window === "undefined") return;
  try {
    if (next === null) window.localStorage.removeItem(OWNER_KEY);
    else window.localStorage.setItem(OWNER_KEY, next);
  } catch {
    // Storage blocked: the in-memory owner still works for this tab.
  }
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

  // Prices aren't known here — product data lives in Supabase, so CartView
  // computes the subtotal from the products the cart page passes it.
  return {
    lines,
    hydrated,
    totalItems,
    addItem,
    removeItem,
    setQuantity,
    clear,
  };
}

export function isCartDirty(): boolean {
  return dirty;
}

export function setCartDirty(next: boolean) {
  dirty = next;
  if (typeof window === "undefined") return;
  try {
    if (next) window.localStorage.setItem(DIRTY_KEY, "1");
    else window.localStorage.removeItem(DIRTY_KEY);
  } catch {
    // Storage blocked: the in-memory flag still protects this tab.
  }
}
