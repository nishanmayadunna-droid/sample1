"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { loadAccountCart, saveAccountCart } from "@/app/cart/actions";
import {
  getCartLines,
  getCartOwner,
  isCartDirty,
  onCartChange,
  replaceCart,
  setCartDirty,
  setCartOwner,
} from "@/app/context/CartContext";
import { decideSync, mergeCartLines, type CartLine } from "@/lib/cart-rules";
import { createCartSaver } from "@/lib/cart-saver";
import { createSyncGate } from "@/lib/sync-gate";

// Cart Server Actions run through this gate so sign-out can wait for the ones
// in flight and block new ones. A request that reaches proxy.ts's auth()
// wrapper gets the session cookie re-set, so a cart action finishing after
// sign-out could sign the user back in. proxy.ts now skips Server Action
// requests; the gate is the second line of defence.
const gate = createSyncGate();

// Module-level so sign-out can flush a pending save first. A confirmed save of
// the latest cart clears the shared dirty flag.
export const cartSaver = createCartSaver(
  (lines) => gate.run(() => saveAccountCart(lines)),
  1000,
  () => setCartDirty(false),
);

export function flushCartSync(): Promise<void> {
  return cartSaver.flush();
}

/** Saves any pending cart, then waits for in-flight syncs and blocks new ones. */
export async function prepareCartForSignOut(): Promise<void> {
  await flushCartSync();
  await gate.close();
}

async function loadSafely(): Promise<CartLine[] | null> {
  try {
    return await loadAccountCart();
  } catch (error) {
    console.error("cart load failed", error);
    return null;
  }
}

/** Saves the browser cart now (it has changes the server hasn't confirmed). */
async function pushLocalCart() {
  cartSaver.schedule(getCartLines());
  await flushCartSync();
}

/**
 * Keeps the browser cart and the signed-in account's cart in step. Renders
 * nothing. Decisions come from decideSync (lib/cart-rules.ts): merge a guest
 * cart on sign-in, push unsaved changes, otherwise pull on load/focus, and
 * clear on sign-out. Only touches the cart store, never React state.
 */
export default function CartSync() {
  const { data: session, status } = useSession();
  const userId = session?.user?.id ?? null;

  useEffect(() => {
    let active = true;

    async function sync() {
      const action = decideSync({
        status,
        userId,
        owner: getCartOwner(),
        dirty: isCartDirty(),
      });

      if (action === "clear") {
        cartSaver.cancel();
        replaceCart([]);
        setCartOwner(null);
        setCartDirty(false);
        return;
      }

      if (action === "push") {
        await pushLocalCart();
        return;
      }

      if (action === "merge" && userId) {
        const account = await loadSafely();
        // Owner stays unset on failure, so the merge is retried later.
        if (!active || account === null || getCartOwner() !== null) return;
        const merged = mergeCartLines(getCartLines(), account);
        replaceCart(merged);
        setCartOwner(userId);
        setCartDirty(true);
        await pushLocalCart();
        return;
      }

      if (action === "pull" && userId) {
        const account = await loadSafely();
        if (!active || account === null) return;
        // A local change (in any tab) may have landed while loading.
        if (getCartOwner() === userId && isCartDirty()) return;
        replaceCart(account);
        setCartOwner(userId);
        setCartDirty(false);
      }
    }

    const runSync = () => void gate.run(sync);
    runSync();
    window.addEventListener("focus", runSync);

    const stopWatching = onCartChange((lines, source) => {
      if (source === "local" && userId && getCartOwner() === userId) {
        setCartDirty(true);
        cartSaver.schedule(lines);
      }
    });

    return () => {
      active = false;
      window.removeEventListener("focus", runSync);
      stopWatching();
    };
  }, [status, userId]);

  return null;
}
