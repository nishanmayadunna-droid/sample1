// Pure per-size stock rules. No I/O, so they are shared by the server, the
// browser and the unit tests. A size with no entry (or a null map) is not
// tracked and is always available.

export const LOW_STOCK = 5;
const MAX_STOCK = 9999;

export type StockMap = Record<string, number> | null;

type HasStock = { stock: StockMap };

export function sizeStock(p: HasStock, size: string): { tracked: boolean; quantity: number } {
  const quantity = p.stock?.[size];
  return typeof quantity === "number"
    ? { tracked: true, quantity }
    : { tracked: false, quantity: Infinity };
}

export function isSoldOut(p: HasStock, size: string): boolean {
  const { tracked, quantity } = sizeStock(p, size);
  return tracked && quantity <= 0;
}

/** True only when the product has sizes and every one is tracked at zero. */
export function allSoldOut(p: HasStock & { sizes: string[] }): boolean {
  return p.sizes.length > 0 && p.sizes.every((size) => isSoldOut(p, size));
}

/** How many are left, when that is a small real number (1 to LOW_STOCK - 1). */
export function lowStockLeft(p: HasStock, size: string): number | null {
  const { tracked, quantity } = sizeStock(p, size);
  return tracked && quantity >= 1 && quantity < LOW_STOCK ? quantity : null;
}

export function maxQuantity(p: HasStock, size: string): number {
  return sizeStock(p, size).quantity;
}

/** Parses the admin form's JSON stock field; blank or empty means "not tracked". */
export function parseStockField(
  raw: string | undefined,
  sizes: string[],
): { ok: true; value: Record<string, number> | null } | { ok: false } {
  if (raw === undefined || raw.trim() === "") return { ok: true, value: null };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false };
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return { ok: false };
  const value: Record<string, number> = {};
  for (const [size, quantity] of Object.entries(parsed)) {
    if (!sizes.includes(size)) return { ok: false };
    if (!Number.isInteger(quantity) || (quantity as number) < 0 || (quantity as number) > MAX_STOCK) {
      return { ok: false };
    }
    value[size] = quantity as number;
  }
  return { ok: true, value: Object.keys(value).length === 0 ? null : value };
}

function sameStock(a: StockMap, b: StockMap): boolean {
  const left = a ?? {};
  const right = b ?? {};
  const keys = Object.keys(left);
  return keys.length === Object.keys(right).length && keys.every((key) => left[key] === right[key]);
}

/**
 * What an admin product save should do with stock. Orders change stock behind
 * the admin's back, so the form sends the stock it was opened with (`original`):
 * untouched stock is not written at all ("keep"), an edit is written only when
 * the stored stock still equals what the admin saw ("write"), else "conflict".
 */
export function planStockSave(
  original: StockMap,
  submitted: StockMap,
  current: StockMap,
): "keep" | "write" | "conflict" {
  if (sameStock(original, submitted)) return "keep";
  return sameStock(original, current) ? "write" : "conflict";
}
