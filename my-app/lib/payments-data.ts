// Server-side access to payment settings, bank QR images, payment slips and
// trusted customers. Uses the secret-key client: callers must have checked
// requireUser()/requireAdmin() first, and slips and QR images are only ever
// handed out as short-lived signed URLs from private buckets.
import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { AdvanceForm, AdvanceMode, BankDetails } from "@/lib/advance";

export type PaymentSettings = AdvanceForm;

type SettingsRow = {
  advance_mode: AdvanceMode;
  advance_fixed: number;
  advance_percent: number;
  advance_min: number;
  advance_max: number;
  advance_expiry_hours: number;
  bank_name: string;
  bank_account_name: string;
  bank_account_number: string;
  bank_branch: string;
  bank_note: string;
};

const SETTINGS_COLUMNS =
  "advance_mode, advance_fixed, advance_percent, advance_min, advance_max, advance_expiry_hours, bank_name, bank_account_name, bank_account_number, bank_branch, bank_note";

const QR_BUCKET = "payment-qr";
const SLIP_BUCKET = "payment-slips";
const SIGNED_URL_SECONDS = 60;
// An admin may take a while to open a slip after the page loads.
const SLIP_VIEW_SECONDS = 300;
// Postgres unique_violation.
const UNIQUE_VIOLATION = "23505";
export const MAX_QR_CODES = 4;

function fail(error: unknown): never {
  console.error("payments query failed", error);
  throw new Error("payments query failed");
}

/** The shop's payment settings; the advance is off until an admin turns it on. */
export async function getPaymentSettings(): Promise<PaymentSettings> {
  const { data, error } = await supabaseAdmin
    .from("payment_settings")
    .select(SETTINGS_COLUMNS)
    .maybeSingle<SettingsRow>();
  if (error) fail(error);
  return {
    mode: data?.advance_mode ?? "off",
    fixed: data?.advance_fixed ?? 50000,
    percent: data?.advance_percent ?? 10,
    min: data?.advance_min ?? 50000,
    max: data?.advance_max ?? 500000,
    expiryHours: data?.advance_expiry_hours ?? 48,
    bankName: data?.bank_name ?? "",
    accountName: data?.bank_account_name ?? "",
    accountNumber: data?.bank_account_number ?? "",
    branch: data?.bank_branch ?? "",
    note: data?.bank_note ?? "",
  };
}

export async function savePaymentSettings(value: PaymentSettings): Promise<void> {
  const { error } = await supabaseAdmin
    .from("payment_settings")
    .update({
      advance_mode: value.mode,
      advance_fixed: value.fixed,
      advance_percent: value.percent,
      advance_min: value.min,
      advance_max: value.max,
      advance_expiry_hours: value.expiryHours,
      bank_name: value.bankName,
      bank_account_name: value.accountName,
      bank_account_number: value.accountNumber,
      bank_branch: value.branch,
      bank_note: value.note,
    })
    .eq("id", true);
  if (error) fail(error);
}

/** Enough to send money: a bank, an account name and a number. */
export function bankDetailsComplete(s: BankDetails): boolean {
  return s.bankName !== "" && s.accountName !== "" && s.accountNumber !== "";
}

// --- Bank QR images -----------------------------------------------------------

export type QrCode = { id: string; path: string; label: string; sortOrder: number };

export async function listQrCodes(): Promise<QrCode[]> {
  const { data, error } = await supabaseAdmin
    .from("bank_qr_codes")
    .select("id, path, label, sort_order")
    .order("sort_order")
    .returns<{ id: string; path: string; label: string; sort_order: number }[]>();
  if (error) fail(error);
  return data.map((row) => ({ id: row.id, path: row.path, label: row.label, sortOrder: row.sort_order }));
}

export async function addQrCode(path: string, label: string): Promise<"ok" | "full"> {
  const existing = await listQrCodes();
  if (existing.length >= MAX_QR_CODES) return "full";
  const used = new Set(existing.map((code) => code.sortOrder));
  const sortOrder = [0, 1, 2, 3].find((n) => !used.has(n));
  if (sortOrder === undefined) return "full";
  const { error } = await supabaseAdmin.from("bank_qr_codes").insert({ path, label, sort_order: sortOrder });
  // Two uploads racing for the same slot: the loser is told the list is full.
  if (error?.code === UNIQUE_VIOLATION) return "full";
  if (error) fail(error);
  return "ok";
}

/** Deletes the QR row, then best-effort its file. Returns the path, or null when no row matched. */
export async function removeQrCode(id: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from("bank_qr_codes")
    .delete()
    .eq("id", id)
    .select("path")
    .returns<{ path: string }[]>();
  if (error) fail(error);
  const path = data[0]?.path ?? null;
  if (path) {
    const { error: removeError } = await supabaseAdmin.storage.from(QR_BUCKET).remove([path]);
    if (removeError) console.error("qr file not removed", path, removeError);
  }
  return path;
}

export async function createQrUpload(path: string): Promise<{ path: string; token: string }> {
  const { data, error } = await supabaseAdmin.storage.from(QR_BUCKET).createSignedUploadUrl(path);
  if (error) fail(error);
  return { path: data.path, token: data.token };
}

/** QR images as short-lived URLs; an image whose URL can't be made is skipped. */
export async function qrSignedUrls(
  codes: QrCode[],
): Promise<{ id: string; label: string; url: string }[]> {
  const urls = await Promise.all(
    codes.map(async (code) => {
      const { data, error } = await supabaseAdmin.storage
        .from(QR_BUCKET)
        .createSignedUrl(code.path, SIGNED_URL_SECONDS);
      if (error || !data) {
        console.error("qr signed url failed", code.path, error);
        return null;
      }
      return { id: code.id, label: code.label, url: data.signedUrl };
    }),
  );
  return urls.filter((entry) => entry !== null);
}

export async function objectExists(
  bucket: typeof QR_BUCKET | typeof SLIP_BUCKET,
  path: string,
): Promise<boolean> {
  const slash = path.lastIndexOf("/");
  const folder = slash === -1 ? "" : path.slice(0, slash);
  const name = slash === -1 ? path : path.slice(slash + 1);
  const { data, error } = await supabaseAdmin.storage.from(bucket).list(folder, { search: name, limit: 100 });
  if (error) fail(error);
  return data.some((file) => file.name === name);
}

// --- Slips ----------------------------------------------------------------------

export type Slip = {
  id: string;
  orderId: string;
  path: string;
  status: "pending" | "approved" | "rejected";
  rejectReason: string | null;
  createdAt: string;
  /** When an admin last reviewed it (approved, rejected or waived); null while pending. */
  reviewedAt: string | null;
};

export async function listSlipsForOrder(orderId: string): Promise<Slip[]> {
  const { data, error } = await supabaseAdmin
    .from("payment_slips")
    .select("id, order_id, path, status, reject_reason, created_at, reviewed_at")
    .eq("order_id", orderId)
    .order("created_at")
    .returns<
      {
        id: string;
        order_id: string;
        path: string;
        status: Slip["status"];
        reject_reason: string | null;
        created_at: string;
        reviewed_at: string | null;
      }[]
    >();
  if (error) fail(error);
  return data.map((row) => ({
    id: row.id,
    orderId: row.order_id,
    path: row.path,
    status: row.status,
    rejectReason: row.reject_reason,
    createdAt: row.created_at,
    reviewedAt: row.reviewed_at,
  }));
}

export async function createSlipUpload(path: string): Promise<{ path: string; token: string }> {
  const { data, error } = await supabaseAdmin.storage.from(SLIP_BUCKET).createSignedUploadUrl(path);
  if (error) fail(error);
  return { path: data.path, token: data.token };
}

/** Records an uploaded slip; the database function checks the order's owner and state. */
export async function attachSlip(
  orderId: string,
  userId: string,
  path: string,
): Promise<"ok" | "bad_state" | "too_many" | "not_found"> {
  const { error } = await supabaseAdmin.rpc("add_payment_slip", {
    p_order_id: orderId,
    p_user_id: userId,
    p_path: path,
  });
  if (!error) return "ok";
  if (error.message.includes("bad_state")) return "bad_state";
  if (error.message.includes("too_many_slips")) return "too_many";
  if (error.message.includes("order_not_found")) return "not_found";
  fail(error);
}

/** Approves or rejects a pending slip; approving also makes the customer trusted. */
export async function reviewSlip(
  slipId: string,
  approve: boolean,
  reason: string,
): Promise<"ok" | "not_found" | "not_pending" | "bad_state"> {
  const { error } = await supabaseAdmin.rpc("review_payment_slip", {
    p_slip_id: slipId,
    p_approve: approve,
    p_reason: reason,
  });
  if (!error) return "ok";
  if (error.message.includes("slip_not_found")) return "not_found";
  if (error.message.includes("slip_not_pending")) return "not_pending";
  if (error.message.includes("bad_state")) return "bad_state";
  fail(error);
}

/** A 5-minute link to view a slip; null when it can't be made. */
export async function slipSignedUrl(path: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin.storage
    .from(SLIP_BUCKET)
    .createSignedUrl(path, SLIP_VIEW_SECONDS);
  if (error || !data) {
    console.error("slip signed url failed", path, error);
    return null;
  }
  return data.signedUrl;
}

// --- Trusted customers --------------------------------------------------------------

export async function isUserTrusted(userId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from("users")
    .select("cod_trusted")
    .eq("id", userId)
    .maybeSingle<{ cod_trusted: boolean }>();
  if (error) fail(error);
  return data?.cod_trusted ?? false;
}

export type AdminCustomer = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  trusted: boolean;
  trustedSource: "advance" | "admin" | null;
  orderCount: number;
  createdAt: string;
};

export async function listCustomersForAdmin(): Promise<AdminCustomer[]> {
  const { data, error } = await supabaseAdmin
    .from("users")
    .select("id, name, email, phone, cod_trusted, cod_trusted_source, created_at")
    .order("created_at", { ascending: false })
    .limit(200)
    .returns<
      {
        id: string;
        name: string | null;
        email: string | null;
        phone: string | null;
        cod_trusted: boolean;
        cod_trusted_source: "advance" | "admin" | null;
        created_at: string;
      }[]
    >();
  if (error) fail(error);

  const counts = new Map<string, number>();
  if (data.length > 0) {
    const { data: orders, error: ordersError } = await supabaseAdmin
      .from("orders")
      .select("user_id")
      .in(
        "user_id",
        data.map((user) => user.id),
      )
      .returns<{ user_id: string }[]>();
    if (ordersError) fail(ordersError);
    for (const order of orders) counts.set(order.user_id, (counts.get(order.user_id) ?? 0) + 1);
  }

  return data.map((user) => ({
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    trusted: user.cod_trusted,
    trustedSource: user.cod_trusted_source,
    orderCount: counts.get(user.id) ?? 0,
    createdAt: user.created_at,
  }));
}

/** Trusts or untrusts a customer by hand. False when no such user. */
export async function setUserTrusted(userId: string, trusted: boolean): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from("users")
    .update({ cod_trusted: trusted, cod_trusted_source: trusted ? "admin" : null })
    .eq("id", userId)
    .select("id")
    .returns<{ id: string }[]>();
  if (error) fail(error);
  return data.length > 0;
}
