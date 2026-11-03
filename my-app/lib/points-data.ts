// Server-side access to loyalty points: the admin's settings and each customer's
// ledger. Uses the secret-key client: callers must have checked
// requireUser()/requireAdmin() first, and customer reads always pass the
// session user's id. Points only ever move inside the database functions
// (place_order, set_order_status, adjust_points).
import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { LedgerKind, PointsSettings } from "@/lib/points";

type SettingsRow = { enabled: boolean; earn_per: number; point_value: number; max_percent: number };

function fail(error: unknown): never {
  console.error("points query failed", error);
  throw new Error("points query failed");
}

/** The shop's points settings; points are off until an admin turns them on. */
export async function getPointsSettings(): Promise<PointsSettings> {
  const { data, error } = await supabaseAdmin
    .from("points_settings")
    .select("enabled, earn_per, point_value, max_percent")
    .maybeSingle<SettingsRow>();
  if (error) fail(error);
  return {
    enabled: data?.enabled ?? false,
    earnPer: data?.earn_per ?? 10000,
    pointValue: data?.point_value ?? 100,
    maxPercent: data?.max_percent ?? 50,
  };
}

export async function savePointsSettings(value: PointsSettings): Promise<void> {
  const { error } = await supabaseAdmin
    .from("points_settings")
    .update({
      enabled: value.enabled,
      earn_per: value.earnPer,
      point_value: value.pointValue,
      max_percent: value.maxPercent,
    })
    .eq("id", true);
  if (error) fail(error);
}

/** A customer's balance: the sum of their ledger. */
export async function getPointsBalance(userId: string): Promise<number> {
  const balances = await balancesForUsers([userId]);
  return balances.get(userId) ?? 0;
}

/** Balances for several customers in one query. A customer with no entries has 0. */
export async function balancesForUsers(userIds: string[]): Promise<Map<string, number>> {
  const balances = new Map<string, number>();
  if (userIds.length === 0) return balances;
  // PostgREST returns at most 1000 rows per request, so read the ledger in pages.
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabaseAdmin
      .from("points_ledger")
      .select("user_id, points")
      .in("user_id", userIds)
      .order("id")
      .range(from, from + PAGE - 1)
      .returns<{ user_id: string; points: number }[]>();
    if (error) fail(error);
    for (const row of data) balances.set(row.user_id, (balances.get(row.user_id) ?? 0) + row.points);
    if (data.length < PAGE) break;
  }
  return balances;
}

export type LedgerEntry = {
  id: string;
  kind: LedgerKind;
  points: number;
  note: string | null;
  orderNumber: string | null;
  createdAt: string;
};

/** The customer's most recent ledger entries, newest first. */
export async function listLedgerForUser(userId: string, limit = 50): Promise<LedgerEntry[]> {
  const { data, error } = await supabaseAdmin
    .from("points_ledger")
    .select("id, kind, points, note, created_at, orders(order_number)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit)
    .returns<
      {
        id: string;
        kind: LedgerKind;
        points: number;
        note: string | null;
        created_at: string;
        orders: { order_number: string } | null;
      }[]
    >();
  if (error) fail(error);
  return data.map((row) => ({
    id: row.id,
    kind: row.kind,
    points: row.points,
    note: row.note,
    orderNumber: row.orders?.order_number ?? null,
    createdAt: row.created_at,
  }));
}

/** An admin's manual adjustment; the database refuses a balance below zero. */
export async function adjustPoints(
  userId: string,
  points: number,
  note: string,
): Promise<
  { ok: true; balance: number } | { ok: false; error: "would_go_negative" | "not_found" | "bad_points" }
> {
  const { data, error } = await supabaseAdmin.rpc("adjust_points", {
    p_user_id: userId,
    p_points: points,
    p_note: note,
  });
  if (!error) return { ok: true, balance: data as number };
  if (error.message.includes("would_go_negative")) return { ok: false, error: "would_go_negative" };
  if (error.message.includes("user_not_found")) return { ok: false, error: "not_found" };
  if (error.message.includes("bad_points")) return { ok: false, error: "bad_points" };
  fail(error);
}
