// Server-side access to PayHere online payments: settings, payment attempts and
// the credentials. Uses the secret-key client. The merchant id and secret come
// only from the environment and are never returned to a page or logged.
import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  DEFAULT_PAYHERE_SETTINGS,
  type PayhereSettings,
} from "@/lib/payhere";

function fail(error: unknown): never {
  console.error("payhere query failed", error instanceof Error ? error.name : "unknown");
  throw new Error("payhere query failed");
}

/** The credentials, or null when either is not set. Server only. */
export function payhereCredentials(): { merchantId: string; secret: string } | null {
  const merchantId = (process.env.PAYHERE_MERCHANT_ID ?? "").trim();
  const secret = (process.env.PAYHERE_MERCHANT_SECRET ?? "").trim();
  return merchantId !== "" && secret !== "" ? { merchantId, secret } : null;
}

export function payhereConfigured(): boolean {
  return payhereCredentials() !== null;
}

type SettingsRow = {
  enabled: boolean;
  sandbox: boolean;
  discount_percent: number;
  gift_si: string;
  gift_en: string;
};

/** Any error (including the migration not being applied yet) means "off". */
export async function getPayhereSettings(): Promise<PayhereSettings> {
  try {
    const { data, error } = await supabaseAdmin
      .from("payhere_settings")
      .select("enabled, sandbox, discount_percent, gift_si, gift_en")
      .maybeSingle<SettingsRow>();
    if (error || !data) {
      if (error) console.error("payhere settings unreadable", error.code ?? "unknown");
      return { ...DEFAULT_PAYHERE_SETTINGS };
    }
    return {
      enabled: data.enabled === true,
      sandbox: data.sandbox !== false,
      discountPercent: data.discount_percent,
      giftSi: data.gift_si,
      giftEn: data.gift_en,
    };
  } catch {
    console.error("payhere settings unreadable");
    return { ...DEFAULT_PAYHERE_SETTINGS };
  }
}

export async function savePayhereSettings(value: PayhereSettings): Promise<void> {
  const { error } = await supabaseAdmin.from("payhere_settings").upsert(
    {
      id: true,
      enabled: value.enabled,
      sandbox: value.sandbox,
      discount_percent: value.discountPercent,
      gift_si: value.giftSi,
      gift_en: value.giftEn,
    },
    { onConflict: "id" },
  );
  if (error) fail(error);
}

/** Online payment is offered only when the admin switched it on AND the keys are set. */
export async function onlinePaymentAvailable(): Promise<{ available: boolean; settings: PayhereSettings }> {
  const settings = await getPayhereSettings();
  return { available: settings.enabled && payhereConfigured(), settings };
}

/** Records the start of one payment attempt (before the customer is sent to PayHere). */
export async function createPaymentAttempt(input: {
  orderId: string;
  ref: string;
  amount: number;
  discount: number;
  gift: string | null;
}): Promise<void> {
  const { error } = await supabaseAdmin.from("online_payments").insert({
    order_id: input.orderId,
    ref: input.ref,
    amount: input.amount,
    discount: input.discount,
    gift: input.gift,
  });
  if (error) fail(error);
}

/** Attempts begun for this order in the last ten minutes (a guard against hammering the button). */
export async function recentAttemptCount(orderId: string): Promise<number> {
  const since = new Date(Date.now() - 10 * 60_000).toISOString();
  const { count, error } = await supabaseAdmin
    .from("online_payments")
    .select("id", { count: "exact", head: true })
    .eq("order_id", orderId)
    .gte("created_at", since);
  if (error || count === null) fail(error);
  return count;
}

export type ConfirmResult = "unknown_ref" | "already" | "amount_mismatch" | "overpaid" | "paid" | "paid_no_order";

/** The notification said this attempt succeeded and its signature checked out. */
export async function confirmPayment(input: {
  ref: string;
  paymentId: string;
  amountCents: number;
  method: string;
}): Promise<ConfirmResult> {
  const { data, error } = await supabaseAdmin.rpc("confirm_online_payment", {
    p_ref: input.ref,
    p_payment_id: input.paymentId,
    p_amount: input.amountCents,
    p_method: input.method,
  });
  if (error) fail(error);
  return data as ConfirmResult;
}

export async function setPaymentStatus(
  ref: string,
  status: "failed" | "cancelled" | "chargedback",
): Promise<"ok" | "unknown_ref" | "ignored"> {
  const { data, error } = await supabaseAdmin.rpc("set_online_payment_status", { p_ref: ref, p_status: status });
  if (error) fail(error);
  return data as "ok" | "unknown_ref" | "ignored";
}

/** The order number an attempt belongs to (to refresh its pages), or null. */
export async function orderNumberForRef(ref: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from("online_payments")
    .select("orders(order_number)")
    .eq("ref", ref)
    .maybeSingle<{ orders: { order_number: string } | null }>();
  if (error) fail(error);
  return data?.orders?.order_number ?? null;
}

export type PaymentRow = {
  id: string;
  ref: string;
  orderNumber: string;
  orderStatus: string;
  orderPaymentStatus: string;
  amount: number;
  discount: number;
  status: "pending" | "paid" | "failed" | "cancelled" | "chargedback" | "overpaid";
  method: string | null;
  paymentId: string | null;
  createdAt: string;
  paidAt: string | null;
};

type RawPaymentRow = {
  id: string;
  ref: string;
  amount: number;
  discount: number;
  status: PaymentRow["status"];
  method: string | null;
  payhere_payment_id: string | null;
  created_at: string;
  paid_at: string | null;
  orders: { order_number: string; status: string; payment_status: string } | null;
};

const PAYMENT_COLUMNS =
  "id, ref, amount, discount, status, method, payhere_payment_id, created_at, paid_at, orders(order_number, status, payment_status)";

function toPaymentRow(row: RawPaymentRow): PaymentRow {
  return {
    id: row.id,
    ref: row.ref,
    orderNumber: row.orders?.order_number ?? "",
    orderStatus: row.orders?.status ?? "",
    orderPaymentStatus: row.orders?.payment_status ?? "",
    amount: row.amount,
    discount: row.discount,
    status: row.status,
    method: row.method,
    paymentId: row.payhere_payment_id,
    createdAt: row.created_at,
    paidAt: row.paid_at,
  };
}

/** Every attempt for one order, newest first. */
export async function listPaymentsForOrder(orderId: string): Promise<PaymentRow[]> {
  const { data, error } = await supabaseAdmin
    .from("online_payments")
    .select(PAYMENT_COLUMNS)
    .eq("order_id", orderId)
    .order("created_at", { ascending: false })
    .returns<RawPaymentRow[]>();
  if (error) fail(error);
  return data.map(toPaymentRow);
}

/** Recent attempts, newest first, with their order's state. */
export async function listPayments(limit = 100): Promise<PaymentRow[]> {
  const { data, error } = await supabaseAdmin
    .from("online_payments")
    .select(PAYMENT_COLUMNS)
    .order("created_at", { ascending: false })
    .limit(limit)
    .returns<RawPaymentRow[]>();
  if (error) fail(error);
  return data.map(toPaymentRow);
}
