// Pure rules for bonus-points events, tiers and expiry (Part 18). No I/O, so the
// Server Actions, the admin forms, the account page and the unit tests share
// them. Money is in cents, points are whole numbers, everything rounds down.
import { parsePriceToCents } from "./product-form";

export const MAX_BONUS_PERCENT = 500;
export const MAX_TIERS = 5;
export const MAX_EXPIRY_DAYS = 3650;

export type PointsBonus = {
  id: string;
  name: string;
  bonusPercent: number;
  startsAt: string;
  endsAt: string;
  active: boolean;
};

export type PointsTier = {
  id: string;
  name: string;
  /** Lifetime goods spend (cents) on delivered orders that reaches this tier. */
  minSpend: number;
  bonusPercent: number;
};

/** The best bonus running right now (bonuses never stack), or null. */
export function activeBonus(bonuses: PointsBonus[], now: Date): PointsBonus | null {
  const t = now.getTime();
  let best: PointsBonus | null = null;
  for (const bonus of bonuses) {
    if (!bonus.active) continue;
    if (!(Date.parse(bonus.startsAt) <= t && t < Date.parse(bonus.endsAt))) continue;
    if (!best || bonus.bonusPercent > best.bonusPercent) best = bonus;
  }
  return best;
}

/** The highest tier whose threshold the customer's spend has reached. */
export function tierFor(spend: number, tiers: PointsTier[]): PointsTier | null {
  let best: PointsTier | null = null;
  for (const tier of tiers) {
    if (spend >= tier.minSpend && (!best || tier.minSpend > best.minSpend)) best = tier;
  }
  return best;
}

/** The next tier up and how much more spend it needs, or null at the top. */
export function nextTier(spend: number, tiers: PointsTier[]): { tier: PointsTier; remaining: number } | null {
  let next: PointsTier | null = null;
  for (const tier of tiers) {
    if (tier.minSpend > spend && (!next || tier.minSpend < next.minSpend)) next = tier;
  }
  return next ? { tier: next, remaining: next.minSpend - spend } : null;
}

/** Tier bonus plus the best running bonus, capped; this is what an order earns on top of the base. */
export function earnBonusPercent(tier: PointsTier | null, bonus: PointsBonus | null): number {
  return Math.min((tier?.bonusPercent ?? 0) + (bonus?.bonusPercent ?? 0), MAX_BONUS_PERCENT);
}

export type LedgerPoint = { points: number; createdAt: string };

/**
 * The points that have expired, and those that will within `windowDays`.
 * Spending uses the oldest points first, so this works on lots: every positive
 * entry is a lot, all spending/expiry (negative entries) is taken off the
 * oldest lots first, and what is left of each lot expires `days` after it was
 * earned. It matches the `expire_points()` SQL function.
 */
export function expiryPicture(
  entries: LedgerPoint[],
  days: number,
  now: Date,
  windowDays = 30,
): { expiredNow: number; soon: number; nextAt: Date | null } {
  if (!(days > 0)) return { expiredNow: 0, soon: 0, nextAt: null };
  const lots = entries
    .filter((entry) => entry.points > 0)
    .map((entry) => ({ left: entry.points, at: Date.parse(entry.createdAt) }))
    .sort((a, b) => a.at - b.at);
  let consumed = entries.reduce((sum, entry) => sum + (entry.points < 0 ? -entry.points : 0), 0);
  for (const lot of lots) {
    const take = Math.min(lot.left, consumed);
    lot.left -= take;
    consumed -= take;
  }
  const dayMs = 24 * 3600_000;
  const t = now.getTime();
  let expiredNow = 0;
  let soon = 0;
  let nextAt: Date | null = null;
  for (const lot of lots) {
    if (lot.left <= 0) continue;
    const expiresAt = lot.at + days * dayMs;
    if (expiresAt <= t) expiredNow += lot.left;
    else if (expiresAt <= t + windowDays * dayMs) {
      soon += lot.left;
      if (!nextAt) nextAt = new Date(expiresAt);
    }
  }
  return { expiredNow, soon, nextAt };
}

type Errors = Record<string, string>;

function text(raw: string | undefined, max: number): string | null {
  const value = (raw ?? "").trim();
  return value.length >= 1 && value.length <= max && !/[\u0000-\u001F\u007F]/.test(value) ? value : null;
}

function percent(raw: string | undefined, min: number): number | null {
  const value = (raw ?? "").trim();
  if (!/^\d{1,3}$/.test(value)) return null;
  const n = Number(value);
  return n >= min && n <= MAX_BONUS_PERCENT ? n : null;
}

export function parseExpiryDays(raw: string | undefined): number | null {
  const value = (raw ?? "").trim();
  if (!/^\d{1,4}$/.test(value)) return null;
  const n = Number(value);
  return n <= MAX_EXPIRY_DAYS ? n : null;
}

export type BonusInput = { name: string; bonusPercent: number; startsAt: string; endsAt: string };

/** `startsAt` / `endsAt` arrive as ISO strings (the form converts Colombo times first). */
export function parseBonusForm(
  fields: Record<string, string | undefined>,
): { ok: true; value: BonusInput } | { ok: false; errors: Errors } {
  const errors: Errors = {};
  const name = text(fields.name, 60);
  if (name === null) errors.name = "Give it a name of up to 60 characters.";
  const bonusPercent = percent(fields.bonusPercent, 1);
  if (bonusPercent === null) errors.bonusPercent = `Enter a whole number from 1 to ${MAX_BONUS_PERCENT} (100 = double points).`;
  const starts = Date.parse(fields.startsAt ?? "");
  const ends = Date.parse(fields.endsAt ?? "");
  if (Number.isNaN(starts)) errors.startsAt = "Choose a start time.";
  if (Number.isNaN(ends)) errors.endsAt = "Choose an end time.";
  if (!errors.startsAt && !errors.endsAt && ends <= starts) errors.endsAt = "The end must be after the start.";
  if (Object.keys(errors).length > 0 || name === null || bonusPercent === null) return { ok: false, errors };
  return {
    ok: true,
    value: {
      name,
      bonusPercent,
      startsAt: new Date(starts).toISOString(),
      endsAt: new Date(ends).toISOString(),
    },
  };
}

export type TierInput = { name: string; minSpend: number; bonusPercent: number };

export function parseTierForm(
  fields: Record<string, string | undefined>,
  existing: PointsTier[],
): { ok: true; value: TierInput } | { ok: false; errors: Errors } {
  const errors: Errors = {};
  const name = text(fields.name, 30);
  if (name === null) errors.name = "Give it a name of up to 30 characters.";
  const raw = (fields.minSpend ?? "").trim();
  const minSpend = /^0+(\.0{1,2})?$/.test(raw) ? 0 : parsePriceToCents(raw);
  if (minSpend === null) errors.minSpend = "Enter an amount in rupees (0 for the starting tier).";
  const bonusPercent = (fields.bonusPercent ?? "").trim() === "0" ? 0 : percent(fields.bonusPercent, 1);
  if (bonusPercent === null) errors.bonusPercent = `Enter a whole number from 0 to ${MAX_BONUS_PERCENT}.`;
  if (existing.length >= MAX_TIERS) errors.form = `At most ${MAX_TIERS} tiers.`;
  if (minSpend !== null && existing.some((tier) => tier.minSpend === minSpend)) {
    errors.minSpend = "Another tier already starts at that amount.";
  }
  if (Object.keys(errors).length > 0 || name === null || minSpend === null || bonusPercent === null) {
    return { ok: false, errors };
  }
  return { ok: true, value: { name, minSpend, bonusPercent } };
}
