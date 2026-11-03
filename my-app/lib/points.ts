// Pure loyalty-points rules: how many points an order may use and earn, and the
// admin's settings. No I/O, so they are shared by the Server Actions, the
// checkout preview and the unit tests. Money is in cents, points are whole
// numbers, and every division rounds down so points never create free money.
import { parsePriceToCents } from "./product-form";

export type PointsSettings = {
  enabled: boolean;
  /** Cents of goods that earn one point. */
  earnPer: number;
  /** Cents one point is worth when spent. */
  pointValue: number;
  /** The most of an order's goods points may pay for, 1 to 100. */
  maxPercent: number;
};

export type LedgerKind = "earn" | "redeem" | "refund" | "adjust";

const usable = (value: number) => Number.isFinite(value) && value > 0;

/**
 * The points an order may use, and the discount they give. `goods` is the order
 * after promotions, before shipping.
 */
export function pointsToUse(
  requested: number,
  balance: number,
  goods: number,
  s: PointsSettings,
): { points: number; discount: number } {
  if (!s.enabled || !usable(requested) || !usable(balance) || !usable(goods) || !usable(s.pointValue)) {
    return { points: 0, discount: 0 };
  }
  const capCents = Math.floor((goods * s.maxPercent) / 100);
  const capPoints = Math.floor(capCents / s.pointValue);
  const points = Math.max(0, Math.min(Math.floor(requested), Math.floor(balance), capPoints));
  return { points, discount: points * s.pointValue };
}

/** The points an order earns once delivered; `goods` is after every discount, before shipping. */
export function pointsToEarn(goods: number, s: PointsSettings): number {
  if (!s.enabled || !usable(goods) || !usable(s.earnPer)) return 0;
  return Math.floor(goods / s.earnPer);
}

const MIN_EARN_PER = 100; // Rs 1

export function parsePointsSettings(
  fields: Record<string, string | undefined>,
):
  | { ok: true; value: PointsSettings }
  | { ok: false; errors: Partial<Record<"enabled" | "earnPer" | "pointValue" | "maxPercent", string>> } {
  const errors: Partial<Record<"enabled" | "earnPer" | "pointValue" | "maxPercent", string>> = {};

  const earnPer = parsePriceToCents(fields.earnPer);
  if (earnPer === null || earnPer < MIN_EARN_PER) {
    errors.earnPer = "Enter an amount of at least Rs 1 (under Rs 1,000,000).";
  }
  const pointValue = parsePriceToCents(fields.pointValue);
  if (pointValue === null) errors.pointValue = "Enter an amount like 1 or 0.50 (under Rs 1,000,000).";

  const rawPercent = (fields.maxPercent ?? "").trim();
  const maxPercent = /^\d{1,3}$/.test(rawPercent) ? Number(rawPercent) : Number.NaN;
  if (!(maxPercent >= 1 && maxPercent <= 100)) errors.maxPercent = "Enter a whole number from 1 to 100.";

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: { enabled: fields.enabled === "on", earnPer: earnPer!, pointValue: pointValue!, maxPercent },
  };
}

const LEDGER_LABELS: Record<LedgerKind, { si: string; en: string }> = {
  earn: { si: "ඇණවුමෙන් ලැබුණා", en: "Earned from an order" },
  redeem: { si: "ඇණවුමට භාවිතා කළා", en: "Used on an order" },
  refund: { si: "ආපසු ලැබුණා", en: "Returned" },
  adjust: { si: "සකස් කිරීම", en: "Adjustment" },
};

export function ledgerKindLabel(kind: LedgerKind): { si: string; en: string } {
  return LEDGER_LABELS[kind];
}
