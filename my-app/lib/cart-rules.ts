// Pure cart-sync decisions: no I/O, no React/Next/Supabase imports, so they're
// shared by the client sync, the server actions and the unit tests.

/** A single line in the cart: a product in a specific size, with a quantity. */
export type CartLine = {
  id: string;
  size: string;
  quantity: number;
};

export const MAX_CART_LINES = 50;
export const MAX_LINE_QUANTITY = 99;

const lineKey = (line: CartLine) => `${line.id}::${line.size}`;

function isCartLine(value: unknown): value is CartLine {
  if (typeof value !== "object" || value === null) return false;
  const { id, size, quantity } = value as Record<string, unknown>;
  return (
    typeof id === "string" &&
    id !== "" &&
    typeof size === "string" &&
    size !== "" &&
    Number.isInteger(quantity) &&
    (quantity as number) >= 1
  );
}

/** Clamps to 1..MAX_LINE_QUANTITY so an over-large line is kept, not lost. */
export function clampQuantity(quantity: number): number {
  return Math.min(Math.max(quantity, 1), MAX_LINE_QUANTITY);
}

/**
 * Turns untrusted input (localStorage, a Server Action payload, a jsonb column)
 * into valid lines: invalid lines dropped, quantities clamped to
 * MAX_LINE_QUANTITY, duplicates collapsed to the larger quantity at their first
 * position, capped at MAX_CART_LINES.
 */
export function sanitizeCartLines(raw: unknown): CartLine[] {
  if (!Array.isArray(raw)) return [];
  const byKey = new Map<string, CartLine>();
  for (const value of raw) {
    if (!isCartLine(value)) continue;
    const line = {
      id: value.id,
      size: value.size,
      quantity: clampQuantity(value.quantity),
    };
    const existing = byKey.get(lineKey(line));
    if (!existing) {
      if (byKey.size < MAX_CART_LINES) byKey.set(lineKey(line), line);
    } else if (line.quantity > existing.quantity) {
      existing.quantity = line.quantity;
    }
  }
  return [...byKey.values()];
}

/**
 * Merges a guest cart into the account cart on sign-in: account lines first,
 * then new local lines. A line in both keeps the larger quantity, so signing in
 * repeatedly never inflates quantities.
 */
export function mergeCartLines(local: CartLine[], account: CartLine[]): CartLine[] {
  return sanitizeCartLines([...account, ...local]);
}

export type SyncStatus = "authenticated" | "unauthenticated" | "loading";
export type SyncAction = "wait" | "merge" | "pull" | "clear" | "none";

/**
 * What the client sync should do, given the session and who owns the browser
 * cart. Only a guest cart (no owner) is merged; another user's leftover cart is
 * replaced by this account's cart so it never leaks into the wrong account.
 */
export function decideSync(input: {
  status: SyncStatus;
  userId: string | null;
  owner: string | null;
}): SyncAction {
  const { status, userId, owner } = input;
  if (status === "loading") return "wait";
  if (status === "authenticated") {
    if (!userId) return "wait";
    return owner === null ? "merge" : "pull";
  }
  return owner === null ? "none" : "clear";
}
