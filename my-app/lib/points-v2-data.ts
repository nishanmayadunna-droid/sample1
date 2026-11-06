// Server-side access to bonus events, tiers and expiry (Part 18). Uses the
// secret-key client: callers must have checked requireAdmin() (writes) or
// requireUser() (reads for that user) first. Points only ever move inside the
// database functions; the bonus here only changes the number the server hands
// to place_order as points_to_earn.
import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  activeBonus,
  earnBonusPercent,
  tierFor,
  type BonusInput,
  type LedgerPoint,
  type PointsBonus,
  type PointsTier,
  type TierInput,
} from "@/lib/points-v2";

function fail(error: unknown): never {
  console.error("points v2 query failed", error);
  throw new Error("points v2 query failed");
}

// Expiry ------------------------------------------------------------------------

/** Days after which unspent points expire; 0 (or an unreadable setting) means never. */
export async function getExpiryDays(): Promise<number> {
  const { data, error } = await supabaseAdmin
    .from("points_settings")
    .select("expiry_days")
    .maybeSingle<{ expiry_days: number }>();
  if (error) fail(error);
  return data?.expiry_days ?? 0;
}

export async function saveExpiryDays(days: number): Promise<void> {
  const { error } = await supabaseAdmin.from("points_settings").update({ expiry_days: days }).eq("id", true);
  if (error) fail(error);
}

/** Expires old unspent points now (what the schedule runs). Returns how many customers lost points. */
export async function expirePointsNow(): Promise<number> {
  const { data, error } = await supabaseAdmin.rpc("expire_points");
  if (error) fail(error);
  return typeof data === "number" ? data : 0;
}

/** Every ledger entry of one customer (points and date only), read in pages. */
export async function getLedgerForExpiry(userId: string): Promise<LedgerPoint[]> {
  const out: LedgerPoint[] = [];
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabaseAdmin
      .from("points_ledger")
      .select("points, created_at")
      .eq("user_id", userId)
      .order("id")
      .range(from, from + PAGE - 1)
      .returns<{ points: number; created_at: string }[]>();
    if (error) fail(error);
    for (const row of data) out.push({ points: row.points, createdAt: row.created_at });
    if (data.length < PAGE) break;
  }
  return out;
}

// Bonus events ----------------------------------------------------------------------

type BonusRow = {
  id: string;
  name: string;
  bonus_percent: number;
  starts_at: string;
  ends_at: string;
  active: boolean;
};

export async function listBonuses(): Promise<PointsBonus[]> {
  const { data, error } = await supabaseAdmin
    .from("points_bonuses")
    .select("id, name, bonus_percent, starts_at, ends_at, active")
    .order("starts_at", { ascending: false })
    .limit(100)
    .returns<BonusRow[]>();
  if (error) fail(error);
  return data.map((row) => ({
    id: row.id,
    name: row.name,
    bonusPercent: row.bonus_percent,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    active: row.active,
  }));
}

export async function addBonus(value: BonusInput): Promise<void> {
  const { error } = await supabaseAdmin.from("points_bonuses").insert({
    name: value.name,
    bonus_percent: value.bonusPercent,
    starts_at: value.startsAt,
    ends_at: value.endsAt,
  });
  if (error) fail(error);
}

export async function setBonusActive(id: string, active: boolean): Promise<void> {
  const { error } = await supabaseAdmin.from("points_bonuses").update({ active }).eq("id", id);
  if (error) fail(error);
}

export async function deleteBonus(id: string): Promise<void> {
  const { error } = await supabaseAdmin.from("points_bonuses").delete().eq("id", id);
  if (error) fail(error);
}

// Tiers --------------------------------------------------------------------------------

type TierRow = { id: string; name: string; min_spend: number; bonus_percent: number };

export async function listTiers(): Promise<PointsTier[]> {
  const { data, error } = await supabaseAdmin
    .from("points_tiers")
    .select("id, name, min_spend, bonus_percent")
    .order("min_spend", { ascending: true })
    .returns<TierRow[]>();
  if (error) fail(error);
  return data.map((row) => ({ id: row.id, name: row.name, minSpend: row.min_spend, bonusPercent: row.bonus_percent }));
}

export async function addTier(value: TierInput): Promise<"ok" | "duplicate"> {
  const { error } = await supabaseAdmin
    .from("points_tiers")
    .insert({ name: value.name, min_spend: value.minSpend, bonus_percent: value.bonusPercent });
  if (!error) return "ok";
  if (error.code === "23505") return "duplicate";
  fail(error);
}

export async function deleteTier(id: string): Promise<void> {
  const { error } = await supabaseAdmin.from("points_tiers").delete().eq("id", id);
  if (error) fail(error);
}

/** A customer's lifetime goods spend (cents, without shipping) on delivered orders. */
export async function getLifetimeSpend(userId: string): Promise<number> {
  let spend = 0;
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabaseAdmin
      .from("orders")
      .select("total, shipping")
      .eq("user_id", userId)
      .eq("status", "delivered")
      .order("id")
      .range(from, from + PAGE - 1)
      .returns<{ total: number; shipping: number }[]>();
    if (error) fail(error);
    for (const row of data) spend += Math.max(row.total - row.shipping, 0);
    if (data.length < PAGE) break;
  }
  return spend;
}

/** Tier and the running bonus for one customer, as the account page shows them. */
export async function getLoyaltyStanding(userId: string): Promise<{
  spend: number;
  tiers: PointsTier[];
  tier: PointsTier | null;
  bonus: PointsBonus | null;
}> {
  const [spend, tiers, bonuses] = await Promise.all([getLifetimeSpend(userId), listTiers(), listBonuses()]);
  return { spend, tiers, tier: tierFor(spend, tiers), bonus: activeBonus(bonuses, new Date()) };
}

/**
 * The extra percent an order placed now earns for this customer. Server only:
 * the browser never sends it. Unreadable tiers or bonuses mean 0, never an error.
 */
export async function getEarnBonusPercent(userId: string): Promise<number> {
  try {
    const { tier, bonus } = await getLoyaltyStanding(userId);
    return earnBonusPercent(tier, bonus);
  } catch (error) {
    console.error("earn bonus unreadable", error instanceof Error ? error.name : "unknown");
    return 0;
  }
}
