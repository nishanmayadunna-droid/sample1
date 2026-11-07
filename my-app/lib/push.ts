// Pure rules for push notifications with Firebase Cloud Messaging (Part 23): the
// events, the admin settings, the message text, the FCM request body, how an FCM
// error is read, and the Google service-account sign-in token. No I/O and no
// environment access, so the sender, the Server Actions and the unit tests share them.
//
// FCM HTTP v1: https://firebase.google.com/docs/reference/fcm/rest/v1/projects.messages
import { createSign } from "node:crypto";
import { buildMessage, type MessageData, type NotificationEvent } from "./notifications";
import { buildOwnerMessage, ownerBrandName, OWNER_ALERT_EVENTS, type OwnerAlertEvent, type OwnerMessageData } from "./owner-alerts";
import type { Lang } from "./i18n";

export const PUSH_OWNER_EVENTS = OWNER_ALERT_EVENTS;
export type PushOwnerEvent = OwnerAlertEvent;

export const PUSH_CUSTOMER_EVENTS = ["placed", "shipped", "delivered", "cancelled", "slip_approved", "slip_rejected"] as const;
export type PushCustomerEvent = (typeof PUSH_CUSTOMER_EVENTS)[number];

export const PUSH_PLATFORMS = ["web", "android", "ios"] as const;
export type PushPlatform = (typeof PUSH_PLATFORMS)[number];

export const OWNER_EVENT_LABELS: Record<PushOwnerEvent, string> = {
  new_order: "A new order is placed",
  new_slip: "A customer uploads a payment slip",
  low_stock: "A size is running low",
  sms_failed: "A customer SMS fails to send",
};

export const CUSTOMER_EVENT_LABELS: Record<PushCustomerEvent, string> = {
  placed: "Order placed (or advance needed)",
  shipped: "Order shipped",
  delivered: "Order delivered",
  cancelled: "Order cancelled",
  slip_approved: "Payment slip approved",
  slip_rejected: "Payment slip rejected",
};

export type PushSettings = {
  enabled: boolean;
  owner: Record<PushOwnerEvent, boolean>;
  customer: Record<PushCustomerEvent, boolean>;
};

export const DEFAULT_PUSH_SETTINGS: PushSettings = {
  enabled: false,
  owner: { new_order: true, new_slip: true, low_stock: true, sms_failed: true },
  customer: { placed: true, shipped: true, delivered: true, cancelled: true, slip_approved: true, slip_rejected: true },
};

/** At most this many push messages sent or attempted in 24 hours (stops runaway use). */
export const PUSH_DAILY_CAP = 500;

export function withinPushCap(sentLast24h: number): boolean {
  return sentLast24h < PUSH_DAILY_CAP;
}

/** The admin form: unticked boxes are off. */
export function parsePushSettings(fields: Record<string, string | undefined>): PushSettings {
  const owner = { ...DEFAULT_PUSH_SETTINGS.owner };
  for (const e of PUSH_OWNER_EVENTS) owner[e] = fields[`owner_${e}`] === "on";
  const customer = { ...DEFAULT_PUSH_SETTINGS.customer };
  for (const e of PUSH_CUSTOMER_EVENTS) customer[e] = fields[`customer_${e}`] === "on";
  return { enabled: fields.enabled === "on", owner, customer };
}

/**
 * Which push event an order notification event is. An advance order gets the
 * advance_due SMS instead of "placed", so it shares the "placed" toggle.
 */
export function customerPushEvent(event: NotificationEvent): PushCustomerEvent | null {
  if (event === "advance_due") return "placed";
  return (PUSH_CUSTOMER_EVENTS as readonly string[]).includes(event) ? (event as PushCustomerEvent) : null;
}

// Tokens -------------------------------------------------------------------------------------

/** FCM registration tokens are long strings of letters, digits and : _ - . ; this only checks the shape. */
export function isValidFcmToken(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_:.\-]{20,4096}$/.test(value);
}

export function isPushPlatform(value: unknown): value is PushPlatform {
  return typeof value === "string" && (PUSH_PLATFORMS as readonly string[]).includes(value);
}

/** "u-1a2b3c4d": enough to tell users apart in the log, not an identifier anyone can use. */
export function maskUserId(id: string): string {
  return `u-${id.replace(/-/g, "").slice(0, 8)}`;
}

// Messages --------------------------------------------------------------------------------------

export type PushMessage = { title: string; body: string; path: string };

const MAX_BODY = 180;

function clip(text: string, max: number): string {
  const chars = Array.from(text);
  return chars.length <= max ? text : `${chars.slice(0, max - 1).join("").trimEnd()}…`;
}

/** The SMS text starts with `<shop name>: `; a push shows its own title, so the name prefix is dropped. */
function withoutPrefix(text: string, brand: string): string {
  const prefix = `${brand}:`;
  return text.startsWith(prefix) ? text.slice(prefix.length).trimStart() : text;
}

/** The owner's push: the same wording as the owner SMS, with a link into the admin. */
export function ownerPush(data: OwnerMessageData, brandName: string): PushMessage {
  const body = clip(withoutPrefix(buildOwnerMessage(data, brandName), ownerBrandName(brandName)), MAX_BODY);
  switch (data.event) {
    case "new_order":
      return { title: `New order ${data.orderNumber}`, body, path: `/admin/orders/${data.orderNumber}` };
    case "new_slip":
      return { title: `Payment slip ${data.orderNumber}`, body, path: `/admin/orders/${data.orderNumber}` };
    case "sms_failed":
      return { title: "A customer SMS failed", body, path: "/admin/notifications" };
    case "low_stock":
      return { title: "Low stock", body, path: "/admin" };
  }
}

/** A customer's push: the same wording as their SMS in the shop's language, with a link to their order. */
export function customerPush(event: NotificationEvent, data: MessageData, lang: Lang, brandName: string): PushMessage {
  return {
    title: lang === "si" ? `ඇණවුම ${data.orderNumber}` : `Order ${data.orderNumber}`,
    body: clip(withoutPrefix(buildMessage(event, data, lang, brandName), brandName), MAX_BODY),
    path: `/orders/${data.orderNumber}`,
  };
}

// FCM request ----------------------------------------------------------------------------------------

export type FcmMessage = {
  message: {
    token: string;
    data: Record<string, string>;
    notification?: { title: string; body: string };
    webpush?: { headers: Record<string, string> };
  };
};

/**
 * The FCM HTTP v1 body. On the web the message is data-only and the service worker
 * shows it (so a click can open the link); a mobile app gets a normal notification
 * block. Every data value must be a string.
 */
export function buildFcmMessage(platform: PushPlatform, token: string, push: PushMessage, link: string): FcmMessage {
  const data = { title: push.title, body: push.body, link };
  if (platform === "web") {
    return { message: { token, data, webpush: { headers: { Urgency: "high", TTL: "86400" } } } };
  }
  return { message: { token, data: { link }, notification: { title: push.title, body: push.body } } };
}

export type FcmFailure = "unregistered" | "auth" | "failed";

/**
 * Reads an FCM error. "unregistered" means the token is dead and should be removed
 * (the app was uninstalled, the browser permission was withdrawn, or the token
 * belongs to another Firebase project); "auth" means our own credentials were refused.
 */
export function classifyFcmError(status: number, body: unknown): FcmFailure {
  const error = (body as { error?: { status?: string; details?: { errorCode?: string }[] } } | null)?.error;
  const codes = [error?.status, ...(error?.details ?? []).map((d) => d.errorCode)];
  if (codes.includes("UNREGISTERED") || codes.includes("SENDER_ID_MISMATCH") || status === 404) return "unregistered";
  if (status === 401 || codes.includes("UNAUTHENTICATED")) return "auth";
  return "failed";
}

// Google service account ---------------------------------------------------------------------------

/** The private key as an env var holds it: surrounding quotes and literal \n sequences become a real PEM. */
export function normalizePrivateKey(raw: string): string {
  const trimmed = raw.trim().replace(/^"([\s\S]*)"$/, "$1");
  return trimmed.replace(/\\n/g, "\n");
}

const b64url = (input: Buffer | string) =>
  Buffer.from(input).toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");

export const FCM_SCOPE = "https://www.googleapis.com/auth/firebase.messaging";
export const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

/** The signed JWT exchanged at Google's token URL for an access token (valid one hour). */
export function serviceAccountJwt(input: { clientEmail: string; privateKey: string; nowSeconds: number }): string {
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(
    JSON.stringify({
      iss: input.clientEmail,
      scope: FCM_SCOPE,
      aud: GOOGLE_TOKEN_URL,
      iat: input.nowSeconds,
      exp: input.nowSeconds + 3600,
    }),
  );
  const unsigned = `${header}.${claims}`;
  const signature = createSign("RSA-SHA256").update(unsigned).sign(input.privateKey);
  return `${unsigned}.${b64url(signature)}`;
}
