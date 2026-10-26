"use server";

import { auth } from "@/auth";
import { sanitizeCartLines, type CartLine } from "@/lib/cart-rules";
import { getCart, saveCart } from "@/lib/carts";

// The user id always comes from the session, never from the client.
async function currentUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}

/** The signed-in user's saved cart, or null when signed out. */
export async function loadAccountCart(): Promise<CartLine[] | null> {
  const userId = await currentUserId();
  if (!userId) return null;
  return getCart(userId);
}

/** Replaces the signed-in user's saved cart. No-op when signed out. */
export async function saveAccountCart(lines: unknown): Promise<void> {
  const userId = await currentUserId();
  if (!userId) return;
  await saveCart(userId, sanitizeCartLines(lines));
}
