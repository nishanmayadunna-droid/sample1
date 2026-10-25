"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { loadAccountCart, saveAccountCart } from "@/app/cart/actions";
import {
  getCartLines,
  getCartOwner,
  onCartChange,
  replaceCart,
  setCartOwner,
} from "@/app/context/CartContext";
import { decideSync, mergeCartLines, type CartLine } from "@/lib/cart-rules";
import { createCartSaver } from "@/lib/cart-saver";
import { createSyncGate } from "@/lib/sync-gate";

// Every cart Server Action runs through this gate. The actions call auth(),
// which re-sets the session cookie, so one finishing after sign-out would sign
// the user back in; sign-out closes the gate and waits for them first.
const gate = createSyncGate();

// Module-level so sign-out can flush a pending save first.
export const cartSaver = createCartSaver((lines) =>
  gate.run(() => saveAccountCart(lines)),
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

/**
 * Keeps the browser cart and the signed-in account's cart in step. Renders
 * nothing. Decisions come from decideSync (lib/cart-rules.ts): merge a guest
 * cart on sign-in, pull on load/focus, clear on sign-out. Only touches the
 * cart store, never React state.
 */
export default function CartSync() {
  const { data: session, status } = useSession();
  const userId = session?.user?.id ?? null;

  useEffect(() => {
    let active = true;

    async function sync() {
      const action = decideSync({ status, userId, owner: getCartOwner() });

      if (action === "clear") {
        cartSaver.cancel();
        replaceCart([]);
        setCartOwner(null);
        return;
      }

      if (action === "merge" && userId) {
        const account = await loadSafely();
        // Owner stays unset on failure, so the merge is retried later.
        if (!active || account === null || getCartOwner() !== null) return;
        const merged = mergeCartLines(getCartLines(), account);
        replaceCart(merged);
        setCartOwner(userId);
        cartSaver.schedule(merged);
        await flushCartSync();
        return;
      }

      if (action === "pull" && userId) {
        // Never overwrite a change that hasn't reached the server; retry it.
        if (cartSaver.hasPending()) {
          await flushCartSync();
          return;
        }
        const account = await loadSafely();
        if (!active || account === null || cartSaver.hasPending()) return;
        replaceCart(account);
        setCartOwner(userId);
      }
    }

    const runSync = () => void gate.run(sync);
    runSync();
    const onFocus = runSync;
    window.addEventListener("focus", onFocus);

    const stopWatching = onCartChange((lines, source) => {
      if (source === "local" && userId && getCartOwner() === userId) {
        cartSaver.schedule(lines);
      }
    });

    return () => {
      active = false;
      window.removeEventListener("focus", onFocus);
      stopWatching();
    };
  }, [status, userId]);

  return null;
}
