// Push notifications with Firebase Cloud Messaging (Part 23): the credentials, the
// settings, device tokens, the send log (private tables, secret-key client) and
// the sender. It talks to FCM's HTTP v1 API with plain fetch (no Firebase Admin
// SDK) using a Google service-account JWT.
//
// Rules: nothing is sent unless the admin switched push on AND the three service
// account env vars are set; every message is claimed in the log BEFORE it is sent,
// so a repeat is a no-op; a send never throws into a customer's or admin's action;
// dead tokens (FCM says UNREGISTERED) are removed; device tokens, message text and
// the private key are never logged or shown.
import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { absoluteUrl } from "@/lib/site";
import { getStoreSettings } from "@/lib/storefront";
import { dedupeKey, type MessageData, type NotificationEvent } from "@/lib/notifications";
import type { Order } from "@/lib/orders-data";
import { ownerDedupe, type OwnerMessageData } from "@/lib/owner-alerts";
import {
  DEFAULT_PUSH_SETTINGS,
  GOOGLE_TOKEN_URL,
  PUSH_CUSTOMER_EVENTS,
  PUSH_OWNER_EVENTS,
  buildFcmMessage,
  classifyFcmError,
  customerPush,
  customerPushEvent,
  isPushPlatform,
  isValidFcmToken,
  maskUserId,
  normalizePrivateKey,
  ownerPush,
  serviceAccountJwt,
  withinPushCap,
  type PushMessage,
  type PushOwnerEvent,
  type PushPlatform,
  type PushSettings,
} from "@/lib/push";
import { getSenderName } from "@/lib/brand-data";

// Credentials -------------------------------------------------------------------------------

type Credentials = { projectId: string; clientEmail: string; privateKey: string };

/** The service account from the environment, or null when any part is missing. Server only. */
function credentials(): Credentials | null {
  const projectId = (process.env.FIREBASE_PROJECT_ID ?? "").trim();
  const clientEmail = (process.env.FIREBASE_CLIENT_EMAIL ?? "").trim();
  const rawKey = process.env.FIREBASE_PRIVATE_KEY ?? "";
  if (projectId === "" || clientEmail === "" || rawKey.trim() === "") return null;
  const privateKey = normalizePrivateKey(rawKey);
  return privateKey.includes("BEGIN") ? { projectId, clientEmail, privateKey } : null;
}

export function pushConfigured(): boolean {
  return credentials() !== null;
}

/**
 * True when the public web config the browser needs is present (these NEXT_PUBLIC_
 * values are baked in at build time, so they must be set before the build).
 */
export function firebaseWebConfigured(): boolean {
  return [
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
  ].every((value) => (value ?? "").trim() !== "");
}

// Settings ---------------------------------------------------------------------------------------

type SettingsRow = { enabled: boolean } & Record<`ev_owner_${PushOwnerEvent}`, boolean> &
  Record<`ev_customer_${(typeof PUSH_CUSTOMER_EVENTS)[number]}`, boolean>;

const SETTINGS_COLUMNS = [
  "enabled",
  ...PUSH_OWNER_EVENTS.map((e) => `ev_owner_${e}`),
  ...PUSH_CUSTOMER_EVENTS.map((e) => `ev_customer_${e}`),
].join(", ");

function defaults(): PushSettings {
  return { enabled: false, owner: { ...DEFAULT_PUSH_SETTINGS.owner }, customer: { ...DEFAULT_PUSH_SETTINGS.customer } };
}

/** Any error (including the migration not being applied yet) means "off". */
export async function getPushSettings(): Promise<PushSettings> {
  try {
    const { data, error } = await supabaseAdmin.from("push_settings").select(SETTINGS_COLUMNS).maybeSingle<SettingsRow>();
    if (error || !data) {
      if (error) console.error("push settings unreadable", error.code ?? "unknown");
      return defaults();
    }
    const out = defaults();
    out.enabled = data.enabled === true;
    for (const e of PUSH_OWNER_EVENTS) out.owner[e] = data[`ev_owner_${e}`] !== false;
    for (const e of PUSH_CUSTOMER_EVENTS) out.customer[e] = data[`ev_customer_${e}`] !== false;
    return out;
  } catch {
    console.error("push settings unreadable");
    return defaults();
  }
}

export async function savePushSettings(value: PushSettings): Promise<void> {
  const update: Record<string, boolean> = { enabled: value.enabled };
  for (const e of PUSH_OWNER_EVENTS) update[`ev_owner_${e}`] = value.owner[e];
  for (const e of PUSH_CUSTOMER_EVENTS) update[`ev_customer_${e}`] = value.customer[e];
  const { error } = await supabaseAdmin.from("push_settings").upsert({ id: true, ...update }, { onConflict: "id" });
  if (error) {
    console.error("push settings save failed", error.code ?? "unknown");
    throw new Error("push settings save failed");
  }
}

/** Push is on AND the keys are set: the only time a device is offered the button or sent anything. */
export async function pushAvailable(): Promise<{ available: boolean; settings: PushSettings }> {
  const settings = await getPushSettings();
  return { available: settings.enabled && pushConfigured(), settings };
}

// Device tokens -----------------------------------------------------------------------------------------

export type RegisterResult = "ok" | "invalid" | "too_many" | "error";

/** Saves a device token for this user. The user id must come from the session, never from the browser. */
export async function registerToken(userId: string, platform: PushPlatform, token: string): Promise<RegisterResult> {
  if (!isPushPlatform(platform) || !isValidFcmToken(token)) return "invalid";
  const { data, error } = await supabaseAdmin.rpc("register_push_token", {
    p_user_id: userId,
    p_platform: platform,
    p_token: token,
  });
  if (error) {
    console.error("register_push_token failed", error.code ?? "unknown");
    return "error";
  }
  return data === "ok" || data === "invalid" || data === "too_many" ? data : "error";
}

/** Removes one of THIS user's tokens. Someone else's token is never touched. */
export async function unregisterToken(userId: string, token: string): Promise<"ok" | "not_found" | "invalid" | "error"> {
  if (!isValidFcmToken(token)) return "invalid";
  const { data, error } = await supabaseAdmin.rpc("unregister_push_token", { p_user_id: userId, p_token: token });
  if (error) {
    console.error("unregister_push_token failed", error.code ?? "unknown");
    return "error";
  }
  return data === "ok" ? "ok" : "not_found";
}

/** How many devices a user has registered (a count only: tokens are never shown). */
export async function countTokens(userId: string): Promise<number> {
  const { count, error } = await supabaseAdmin
    .from("push_tokens")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  if (error || count === null) return 0;
  return count;
}

/** How many devices the shop's admins have registered. */
export async function countOwnerDevices(): Promise<number> {
  const { count, error } = await supabaseAdmin
    .from("push_tokens")
    .select("id, users!inner(role)", { count: "exact", head: true })
    .eq("users.role", "admin");
  if (error || count === null) return 0;
  return count;
}

type TokenRow = { id: string; platform: PushPlatform; token: string };

async function tokensForUser(userId: string): Promise<TokenRow[]> {
  const { data, error } = await supabaseAdmin
    .from("push_tokens")
    .select("id, platform, token")
    .eq("user_id", userId)
    .returns<TokenRow[]>();
  if (error) {
    console.error("push tokens query failed", error.code ?? "unknown");
    return [];
  }
  return data;
}

/** The devices of every admin account (the role is read now, so a demotion applies at once). */
async function ownerTokens(): Promise<TokenRow[]> {
  const { data, error } = await supabaseAdmin
    .from("push_tokens")
    .select("id, platform, token, users!inner(role)")
    .eq("users.role", "admin")
    .returns<TokenRow[]>();
  if (error) {
    console.error("push owner tokens query failed", error.code ?? "unknown");
    return [];
  }
  return data;
}

async function removeTokens(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const { error } = await supabaseAdmin.from("push_tokens").delete().in("id", ids);
  if (error) console.error("push token cleanup failed", error.code ?? "unknown");
}

// Sending ---------------------------------------------------------------------------------------------------

let cachedToken: { value: string; expiresAt: number } | null = null;

/** A Google access token for FCM (cached for most of its hour). Null when Google refuses the credentials. */
async function accessToken(creds: Credentials): Promise<string | null> {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now + 60_000) return cachedToken.value;
  try {
    const assertion = serviceAccountJwt({
      clientEmail: creds.clientEmail,
      privateKey: creds.privateKey,
      nowSeconds: Math.floor(now / 1000),
    });
    const res = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
      signal: AbortSignal.timeout(8000),
    });
    const body = (await res.json().catch(() => null)) as { access_token?: string; expires_in?: number } | null;
    if (!res.ok || !body?.access_token) {
      console.error("push access token refused", { httpStatus: res.status });
      return null;
    }
    cachedToken = { value: body.access_token, expiresAt: now + (body.expires_in ?? 3600) * 1000 };
    return body.access_token;
  } catch (e) {
    console.error("push access token error", e instanceof Error ? e.name : "unknown");
    return null;
  }
}

/** Sends one message to one device. "gone" = FCM says the token is dead. */
async function postToFcm(
  creds: Credentials,
  bearer: string,
  row: TokenRow,
  push: PushMessage,
  link: string,
): Promise<"sent" | "gone" | "failed"> {
  try {
    const res = await fetch(`https://fcm.googleapis.com/v1/projects/${encodeURIComponent(creds.projectId)}/messages:send`, {
      method: "POST",
      headers: { Authorization: `Bearer ${bearer}`, "Content-Type": "application/json" },
      body: JSON.stringify(buildFcmMessage(row.platform, row.token, push, link)),
      signal: AbortSignal.timeout(8000),
    });
    if (res.ok) return "sent";
    const body = await res.json().catch(() => null);
    const kind = classifyFcmError(res.status, body);
    if (kind === "auth") cachedToken = null;
    if (kind !== "unregistered") console.error("push send rejected", { httpStatus: res.status, kind });
    return kind === "unregistered" ? "gone" : "failed";
  } catch (e) {
    console.error("push send error", e instanceof Error ? e.name : "unknown");
    return "failed";
  }
}

/** Fail closed: a count that errors counts as over the cap. */
async function underPushCap(): Promise<boolean> {
  const since = new Date(Date.now() - 24 * 3600_000).toISOString();
  const { count, error } = await supabaseAdmin
    .from("push_log")
    .select("id", { count: "exact", head: true })
    .in("status", ["sent", "failed"])
    .gte("created_at", since);
  if (error || count === null) return false;
  return withinPushCap(count);
}

/**
 * Claims the log row, then sends to every device in `rows`. "sent" when at least
 * one device accepted it. Never throws; devices without a token are not logged.
 */
async function deliver(input: {
  kind: "owner" | "customer";
  dedupe: string;
  event: string;
  recipient: string;
  rows: TokenRow[];
  push: PushMessage;
}): Promise<"sent" | "failed" | "skipped" | "duplicate"> {
  try {
    const creds = credentials();
    if (!creds || input.rows.length === 0) return "skipped";

    const capOk = await underPushCap();
    const { data: log, error } = await supabaseAdmin
      .from("push_log")
      .insert({
        kind: input.kind,
        dedupe: input.dedupe.slice(0, 200),
        event: input.event.slice(0, 40),
        recipient: input.recipient.slice(0, 40),
        status: capOk ? "failed" : "skipped",
      })
      .select("id")
      .single<{ id: string }>();
    if (error) {
      if (error.code === "23505") return "duplicate";
      console.error("push log failed", error.code ?? "unknown");
      return "skipped";
    }
    if (!capOk) return "skipped";

    const bearer = await accessToken(creds);
    if (!bearer) return "failed";

    const link = absoluteUrl(input.push.path);
    const results = await Promise.all(input.rows.map((row) => postToFcm(creds, bearer, row, input.push, link)));
    await removeTokens(input.rows.filter((_, i) => results[i] === "gone").map((row) => row.id));

    if (!results.includes("sent")) return "failed";
    const { error: updateError } = await supabaseAdmin.from("push_log").update({ status: "sent" }).eq("id", log.id);
    if (updateError) console.error("push log update failed", updateError.code ?? "unknown");
    return "sent";
  } catch (e) {
    console.error("push error", e instanceof Error ? e.name : "unknown");
    return "failed";
  }
}

// The two entry points the rest of the app calls ----------------------------------------------------------

/** Is push on, with keys, and is this owner event switched on? (Used to skip work early.) */
export async function pushOwnerEventOn(event: PushOwnerEvent): Promise<boolean> {
  try {
    const { available, settings } = await pushAvailable();
    return available && settings.owner[event];
  } catch {
    return false;
  }
}

/** Pushes an owner alert to every admin device. Never throws; independent of the SMS and email switches. */
export async function pushOwnerAlert(data: OwnerMessageData, subject: string, day?: string): Promise<void> {
  try {
    if (!(await pushOwnerEventOn(data.event))) return;
    const rows = await ownerTokens();
    await deliver({
      kind: "owner",
      dedupe: `${data.event}:${ownerDedupe(data.event, subject, day)}`,
      event: data.event,
      recipient: "admins",
      rows,
      push: ownerPush(data, await getSenderName({ ascii: true })),
    });
  } catch (e) {
    console.error("owner push error", e instanceof Error ? e.name : "unknown");
  }
}

/**
 * Pushes a customer's own order event to that customer's devices, in addition to
 * the SMS and email, never instead of them. Never throws; independent of both.
 */
export async function pushOrderEvent(
  order: Order,
  event: NotificationEvent,
  data: MessageData,
  slipId?: string,
): Promise<void> {
  try {
    const pushEvent = customerPushEvent(event);
    if (!pushEvent) return;
    const { available, settings } = await pushAvailable();
    if (!available || !settings.customer[pushEvent]) return;
    const rows = await tokensForUser(order.userId);
    if (rows.length === 0) return;
    const store = await getStoreSettings();
    await deliver({
      kind: "customer",
      dedupe: `${order.id}:${event}:${dedupeKey(event, slipId)}`,
      event,
      recipient: maskUserId(order.userId),
      rows,
      push: customerPush(event, data, store.defaultLang, await getSenderName()),
    });
  } catch (e) {
    console.error("order push error", e instanceof Error ? e.name : "unknown");
  }
}

// Admin ------------------------------------------------------------------------------------------------------------

export type PushLogRow = {
  id: string;
  kind: "owner" | "customer";
  event: string;
  recipient: string;
  status: "sent" | "failed" | "skipped";
  createdAt: string;
};

export async function listPushLog(limit = 100): Promise<PushLogRow[]> {
  const { data, error } = await supabaseAdmin
    .from("push_log")
    .select("id, kind, event, recipient, status, created_at")
    .order("created_at", { ascending: false })
    .limit(limit)
    .returns<{ id: string; kind: "owner" | "customer"; event: string; recipient: string; status: PushLogRow["status"]; created_at: string }[]>();
  if (error) {
    console.error("push log query failed", error.code ?? "unknown");
    throw new Error("push log query failed");
  }
  return data.map((r) => ({
    id: r.id,
    kind: r.kind,
    event: r.event,
    recipient: r.recipient,
    status: r.status,
    createdAt: r.created_at,
  }));
}
