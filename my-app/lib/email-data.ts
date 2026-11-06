// Email for the shop (Part 11): the provider call, the settings and send log
// (private tables, secret-key client), and the account flows that need email
// (password reset, email verification, order emails, newsletter confirmation).
//
// Rules: nothing is sent unless the admin switched email on AND the provider
// keys are set; every message is claimed in the log before it is sent, so a
// repeat is a no-op; sending never throws into a customer's action; and tokens,
// message bodies and full addresses are never logged.
import "server-only";
import { createHmac } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { absoluteUrl } from "@/lib/site";
import { isValidNewPassword } from "@/lib/auth-rules";
import { buildMessage, dedupeKey, type MessageData, type NotificationEvent } from "@/lib/notifications";
import type { Order } from "@/lib/orders-data";
import { findUserByEmail, findUserById, isEmailVerified, markEmailVerified, setPassword } from "@/lib/users";
import {
  DEFAULT_EMAIL_SETTINGS,
  RESET_TTL_SECONDS,
  VERIFY_TTL_SECONDS,
  generateToken,
  hashToken,
  isDeliverableEmail,
  isTokenShape,
  isValidFrom,
  maskEmail,
  newsletterConfirmEmail,
  orderEmail,
  resetEmail,
  tokenLink,
  verifyEmailMessage,
  withinEmailCap,
  type Email,
  type EmailKind,
  type EmailSettings,
} from "@/lib/email";

const RESEND_ENDPOINT = "https://api.resend.com/emails";

// Settings ---------------------------------------------------------------------------------

/** The provider keys, or null when either is missing or the sender address is unusable. */
function providerConfig(): { apiKey: string; from: string } | null {
  const apiKey = (process.env.RESEND_API_KEY ?? "").trim();
  const from = (process.env.EMAIL_FROM ?? "").trim();
  return apiKey !== "" && isValidFrom(from) ? { apiKey, from } : null;
}

export function emailConfigured(): boolean {
  return providerConfig() !== null;
}

/** Any error (including the migration not being applied yet) means "off". */
export async function getEmailSettings(): Promise<EmailSettings> {
  try {
    const { data, error } = await supabaseAdmin
      .from("email_settings")
      .select("enabled, order_emails")
      .maybeSingle<{ enabled: boolean; order_emails: boolean }>();
    if (error || !data) {
      if (error) console.error("email settings unreadable", error.code ?? "unknown");
      return { ...DEFAULT_EMAIL_SETTINGS };
    }
    return { enabled: data.enabled === true, orderEmails: data.order_emails !== false };
  } catch {
    console.error("email settings unreadable");
    return { ...DEFAULT_EMAIL_SETTINGS };
  }
}

export async function saveEmailSettings(value: EmailSettings): Promise<void> {
  const { error } = await supabaseAdmin
    .from("email_settings")
    .upsert({ id: true, enabled: value.enabled, order_emails: value.orderEmails }, { onConflict: "id" });
  if (error) {
    console.error("email settings save failed", error.code ?? "unknown");
    throw new Error("email settings save failed");
  }
}

/** True when email is on and the keys are set: the only time anything is sent. */
export async function emailAvailable(): Promise<boolean> {
  return emailConfigured() && (await getEmailSettings()).enabled;
}

// Sending ----------------------------------------------------------------------------------

/** Fail closed: a count that errors counts as over the cap. */
async function underEmailCap(): Promise<boolean> {
  const since = new Date(Date.now() - 24 * 3600_000).toISOString();
  const { count, error } = await supabaseAdmin
    .from("email_log")
    .select("id", { count: "exact", head: true })
    .in("status", ["sent", "failed"])
    .gte("created_at", since);
  if (error || count === null) return false;
  return withinEmailCap(count);
}

async function postToProvider(config: { apiKey: string; from: string }, to: string, email: Email): Promise<boolean> {
  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: config.from, to: [to], subject: email.subject, html: email.html, text: email.text }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) console.error("email send rejected", { httpStatus: res.status });
    return res.ok;
  } catch (e) {
    console.error("email send error", e instanceof Error ? e.name : "unknown");
    return false;
  }
}

export type SendOutcome = "sent" | "failed" | "skipped" | "duplicate";

/**
 * Logs and sends one email. The log row is claimed first (unique kind + dedupe),
 * so the same message is never sent twice. Never throws.
 */
export async function sendEmail(input: { kind: EmailKind; dedupe: string; to: string; email: Email }): Promise<SendOutcome> {
  try {
    if (!isDeliverableEmail(input.to)) return "skipped";
    const config = providerConfig();
    if (!config) return "skipped";
    const settings = await getEmailSettings();
    if (!settings.enabled) return "skipped";
    if (input.kind === "order" && !settings.orderEmails) return "skipped";

    const capOk = await underEmailCap();
    const { data: row, error } = await supabaseAdmin
      .from("email_log")
      .insert({
        kind: input.kind,
        dedupe: input.dedupe.slice(0, 200),
        recipient: maskEmail(input.to),
        subject: input.email.subject.slice(0, 200),
        status: capOk ? "failed" : "skipped",
      })
      .select("id")
      .single<{ id: string }>();
    if (error) {
      if (error.code === "23505") return "duplicate";
      console.error("email log failed", error.code ?? "unknown");
      return "skipped";
    }
    if (!capOk) return "skipped";

    if (!(await postToProvider(config, input.to, input.email))) return "failed";
    const { error: updateError } = await supabaseAdmin.from("email_log").update({ status: "sent" }).eq("id", row.id);
    if (updateError) console.error("email log update failed", updateError.code ?? "unknown");
    return "sent";
  } catch (e) {
    console.error("email error", e instanceof Error ? e.name : "unknown");
    return "failed";
  }
}

// Rate limits ---------------------------------------------------------------------------------

/** Per-address bucket for a request IP; the IP itself is never stored, only a keyed hash. */
function ipBucket(scope: string, ip: string): string {
  const secret = process.env.AUTH_SECRET ?? "";
  return `${scope}:${createHmac("sha256", secret).update(ip).digest("hex").slice(0, 32)}`;
}

/** True when this request is allowed. Fails closed: a database error counts as over the limit. */
export async function allowRequest(scope: string, ip: string, limit: number, windowSeconds: number): Promise<boolean> {
  try {
    const { data, error } = await supabaseAdmin.rpc("rate_limit_hit", {
      p_key: ipBucket(scope, ip),
      p_limit: limit,
      p_window_seconds: windowSeconds,
    });
    if (error) {
      console.error("rate limit failed", error.code ?? "unknown");
      return false;
    }
    return data === true;
  } catch {
    return false;
  }
}

// Order emails -----------------------------------------------------------------------------------

/**
 * Emails the customer about an order event (same events and wording as the SMS,
 * in English and Sinhala). Never throws; a no-op without an address or while off.
 */
export async function emailOrderEvent(
  order: Order,
  event: NotificationEvent,
  data: MessageData,
  slipId?: string,
): Promise<void> {
  try {
    if (!(await emailAvailable())) return;
    const user = await findUserById(order.userId);
    if (!user?.email) return;
    const message = orderEmail({
      orderNumber: order.orderNumber,
      en: buildMessage(event, data, "en"),
      si: buildMessage(event, data, "si"),
      link: absoluteUrl(`/orders/${order.orderNumber}`),
      event,
    });
    await sendEmail({
      kind: "order",
      dedupe: `${order.id}:${event}:${dedupeKey(event, slipId)}`,
      to: user.email,
      email: message,
    });
  } catch (e) {
    console.error("order email error", e instanceof Error ? e.name : "unknown");
  }
}

// Password reset ------------------------------------------------------------------------------------

/**
 * Starts a password reset. The answer never says whether the address has an account:
 * "ok" for every well-formed request. Only password accounts get an email.
 */
export async function requestPasswordReset(rawEmail: string, ip: string): Promise<"ok" | "invalid" | "busy"> {
  const email = rawEmail.trim().toLowerCase();
  if (!isDeliverableEmail(email)) return "invalid";
  if (!(await allowRequest("reset-ip", ip, 5, 3600))) return "busy";
  try {
    const user = await findUserByEmail(email);
    if (!user?.email || !user.passwordHash) return "ok";
    await sendTokenEmail("reset", user.id, user.email);
  } catch (e) {
    console.error("password reset request error", e instanceof Error ? e.name : "unknown");
  }
  return "ok";
}

/** Makes a token (3 an hour per person), emails the link. Returns false when the person asked too often. */
async function sendTokenEmail(kind: "reset" | "verify", userId: string, to: string): Promise<boolean> {
  const token = generateToken();
  const { data, error } = await supabaseAdmin.rpc("create_auth_token", {
    p_user_id: userId,
    p_kind: kind,
    p_hash: hashToken(token),
    p_ttl_seconds: kind === "reset" ? RESET_TTL_SECONDS : VERIFY_TTL_SECONDS,
  });
  if (error) {
    console.error("create_auth_token failed", error.code ?? "unknown");
    return false;
  }
  if (data !== "ok") return false;
  const link = tokenLink(absoluteUrl(""), kind, token);
  await sendEmail({
    kind,
    dedupe: hashToken(token).slice(0, 32),
    to,
    email: kind === "reset" ? resetEmail(link) : verifyEmailMessage(link),
  });
  return true;
}

/** Sets a new password from an emailed link. The token works once. */
export async function completePasswordReset(
  token: string,
  password: string,
): Promise<"ok" | "invalid_token" | "invalid_password" | "error"> {
  if (!isTokenShape(token)) return "invalid_token";
  if (!isValidNewPassword(password)) return "invalid_password";
  try {
    const { data, error } = await supabaseAdmin.rpc("consume_auth_token", { p_hash: hashToken(token), p_kind: "reset" });
    if (error) {
      console.error("consume_auth_token failed", error.code ?? "unknown");
      return "error";
    }
    if (typeof data !== "string") return "invalid_token";
    await setPassword(data, password);
    return "ok";
  } catch (e) {
    console.error("password reset error", e instanceof Error ? e.name : "unknown");
    return "error";
  }
}

// Email verification -----------------------------------------------------------------------------------

/** Emails the signed-in account a verification link. */
export async function sendVerification(userId: string): Promise<"sent" | "already" | "too_many" | "unavailable"> {
  try {
    const user = await findUserById(userId);
    if (!user?.email) return "unavailable";
    if (isEmailVerified(user)) return "already";
    if (!(await emailAvailable())) return "unavailable";
    return (await sendTokenEmail("verify", user.id, user.email)) ? "sent" : "too_many";
  } catch (e) {
    console.error("verification email error", e instanceof Error ? e.name : "unknown");
    return "unavailable";
  }
}

export async function confirmEmailToken(token: string): Promise<"ok" | "invalid" | "error"> {
  if (!isTokenShape(token)) return "invalid";
  try {
    const { data, error } = await supabaseAdmin.rpc("consume_auth_token", { p_hash: hashToken(token), p_kind: "verify" });
    if (error) {
      console.error("consume_auth_token failed", error.code ?? "unknown");
      return "error";
    }
    if (typeof data !== "string") return "invalid";
    await markEmailVerified(data);
    return "ok";
  } catch (e) {
    console.error("email verification error", e instanceof Error ? e.name : "unknown");
    return "error";
  }
}

// Newsletter confirmation --------------------------------------------------------------------------------

/** Sends the double opt-in email for an address; the caller already stored the token's hash. */
export async function sendNewsletterConfirmation(email: string, token: string): Promise<void> {
  const link = tokenLink(absoluteUrl(""), "newsletter", token);
  await sendEmail({
    kind: "newsletter_confirm",
    dedupe: hashToken(token).slice(0, 32),
    to: email,
    email: newsletterConfirmEmail(link),
  });
}

// Admin ------------------------------------------------------------------------------------------------------

export type EmailLogRow = {
  id: string;
  kind: EmailKind;
  recipient: string;
  subject: string;
  status: "sent" | "failed" | "skipped";
  createdAt: string;
};

export async function listEmailLog(limit = 100): Promise<EmailLogRow[]> {
  const { data, error } = await supabaseAdmin
    .from("email_log")
    .select("id, kind, recipient, subject, status, created_at")
    .order("created_at", { ascending: false })
    .limit(limit)
    .returns<{ id: string; kind: EmailKind; recipient: string; subject: string; status: EmailLogRow["status"]; created_at: string }[]>();
  if (error) {
    console.error("email log query failed", error.code ?? "unknown");
    throw new Error("email log query failed");
  }
  return data.map((r) => ({
    id: r.id,
    kind: r.kind,
    recipient: r.recipient,
    subject: r.subject,
    status: r.status,
    createdAt: r.created_at,
  }));
}
