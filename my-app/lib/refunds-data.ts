// Server-side access to refunds. Uses the secret-key client: callers must have
// checked requireAdmin() (record) or loaded the order through the session user
// (read) first. Money only changes inside the record_refund SQL function.
import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { Refund, RefundMethod, RefundValue } from "@/lib/refunds";

type RefundRow = {
  id: string;
  amount: number;
  method: RefundMethod;
  reference: string | null;
  note: string | null;
  created_at: string;
};

function fail(error: unknown): never {
  console.error("refunds query failed", error);
  throw new Error("refunds query failed");
}

/** Refunds of one order, oldest first. */
export async function listRefundsForOrder(orderId: string): Promise<Refund[]> {
  const { data, error } = await supabaseAdmin
    .from("order_refunds")
    .select("id, amount, method, reference, note, created_at")
    .eq("order_id", orderId)
    .order("created_at", { ascending: true })
    .returns<RefundRow[]>();
  if (error) fail(error);
  return data.map((row) => ({
    id: row.id,
    amount: row.amount,
    method: row.method,
    reference: row.reference,
    note: row.note,
    createdAt: row.created_at,
  }));
}

/** Order ids (among cancelled advance-paid orders) that have been refunded in total `amount`. */
export async function refundedTotals(orderIds: string[]): Promise<Map<string, number>> {
  const totals = new Map<string, number>();
  if (orderIds.length === 0) return totals;
  const { data, error } = await supabaseAdmin
    .from("order_refunds")
    .select("order_id, amount")
    .in("order_id", orderIds)
    .returns<{ order_id: string; amount: number }[]>();
  if (error) fail(error);
  for (const row of data) totals.set(row.order_id, (totals.get(row.order_id) ?? 0) + row.amount);
  return totals;
}

/** Records one refund; the database function enforces the rules under the order lock. */
export async function recordRefund(
  orderId: string,
  value: RefundValue,
  key: string,
): Promise<"ok" | "not_found" | "bad_state" | "over_refund"> {
  const { error } = await supabaseAdmin.rpc("record_refund", {
    p_order_id: orderId,
    p_amount: value.amount,
    p_method: value.method,
    p_reference: value.reference,
    p_note: value.note,
    p_key: key,
  });
  if (!error) return "ok";
  if (error.message.includes("order_not_found")) return "not_found";
  if (error.message.includes("bad_state")) return "bad_state";
  if (error.message.includes("over_refund")) return "over_refund";
  fail(error);
}
