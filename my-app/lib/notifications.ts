import type { Lang } from "@/lib/i18n";
import { formatPrice } from "@/lib/products";
import { normalizePhone } from "./orders";

export const NOTIFICATION_EVENTS = [
  "placed",
  "advance_due",
  "slip_approved",
  "slip_rejected",
  "shipped",
  "delivered",
  "cancelled",
] as const;
export type NotificationEvent = (typeof NOTIFICATION_EVENTS)[number];

export type NotificationSettings = { enabled: boolean; events: Record<NotificationEvent, boolean> };

function allEvents(value: boolean): Record<NotificationEvent, boolean> {
  return Object.fromEntries(NOTIFICATION_EVENTS.map((e) => [e, value])) as Record<
    NotificationEvent,
    boolean
  >;
}

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  enabled: false,
  events: allEvents(true),
};

export type MessageData = {
  orderNumber: string;
  total: number;
  advanceAmount?: number;
  payBefore?: Date | null;
  courierName?: string | null;
  trackingNumber?: string | null;
  trackingUrl?: string | null;
  pointsEarned?: number;
  systemCancelled?: boolean;
  rejectReason?: string;
};

const MAX_SEGMENTS = 2;

const dateFormatter = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Colombo" });

function colomboDate(d: Date): string {
  return dateFormatter.format(d);
}

type Options = { withUrl: boolean; reason?: string; brand: string };

function compose(event: NotificationEvent, d: MessageData, lang: Lang, o: Options): string {
  const si = lang === "si";
  const n = d.orderNumber;
  switch (event) {
    case "placed":
      return si
        ? `${o.brand}: ඔබේ ඇණවුම ${n} ලැබුණා. මුළු මුදල ${formatPrice(d.total)}. ස්තූතියි!`
        : `${o.brand}: order ${n} received. Total ${formatPrice(d.total)}. Thank you!`;
    case "advance_due": {
      const amount = formatPrice(d.advanceAmount ?? 0);
      const date = d.payBefore ? colomboDate(d.payBefore) : null;
      return si
        ? `${o.brand}: ඇණවුම ${n} ලැබුණා. අත්තිකාරම ${amount} ${date ? `${date} දිනට පෙර ` : ""}ගෙවා, ඇණවුම් පිටුවේ slip එක upload කරන්න.`
        : `${o.brand}: order ${n} placed. Please pay the ${amount} advance${date ? ` before ${date}` : ""} and upload the slip on your order page.`;
    }
    case "slip_approved":
      return si
        ? `${o.brand}: ${n} සඳහා අත්තිකාරම තහවුරු විය. ස්තූතියි!`
        : `${o.brand}: advance for ${n} confirmed. Thank you!`;
    case "slip_rejected": {
      const reason = o.reason ?? d.rejectReason ?? "";
      return si
        ? `${o.brand}: ${n} සඳහා slip එක පිළිගත නොහැකි විය: ${reason}. නැවත upload කරන්න.`
        : `${o.brand}: your slip for ${n} was not accepted: ${reason}. Please upload a new one.`;
    }
    case "shipped": {
      const courier = d.courierName?.trim() ?? "";
      const no = d.trackingNumber?.trim() ?? "";
      const url = o.withUrl && no && d.trackingUrl ? ` ${d.trackingUrl}` : "";
      if (si) {
        const via = courier ? ` ${courier} මගින්` : "";
        return `${o.brand}: ${n}${via} යවා ඇත.${no ? ` Tracking ${no}.` : ""}${url}`;
      }
      const via = courier ? ` via ${courier}` : "";
      const track = no ? `, tracking ${no}` : "";
      return `${o.brand}: order ${n} is on its way${via}${track}.${url}`;
    }
    case "delivered": {
      const p = d.pointsEarned ?? 0;
      if (si) {
        return `${o.brand}: ඔබේ ඇණවුම ${n} භාර දෙන ලදී.${p > 0 ? ` ඔබට points ${p} ලැබුණා.` : ""} ස්තූතියි!`;
      }
      return `${o.brand}: order ${n} delivered.${p > 0 ? ` You earned ${p} points.` : ""} Thank you!`;
    }
    case "cancelled":
      return si
        ? `${o.brand}: ඇණවුම ${n} අවලංගු කරන ලදී.${d.systemCancelled ? " අත්තිකාරම නියමිත වේලාවට ලැබුණේ නැත." : ""}`
        : `${o.brand}: order ${n} was cancelled.${d.systemCancelled ? " Your advance did not arrive in time." : ""}`;
  }
}

/** SMS text for an event. Over 2 segments: drop the tracking URL, then trim the reject reason. */
export function buildMessage(event: NotificationEvent, data: MessageData, lang: Lang, brand: string): string {
  let text = compose(event, data, lang, { withUrl: true, brand });
  if (segmentCount(text) <= MAX_SEGMENTS) return text;

  text = compose(event, data, lang, { withUrl: false, brand });
  if (segmentCount(text) <= MAX_SEGMENTS) return text;

  if (event === "slip_rejected" && data.rejectReason) {
    const full = Array.from(data.rejectReason);
    for (let len = full.length - 1; len >= 0; len--) {
      const reason = full.slice(0, len).join("").trimEnd() + (lang === "en" ? "..." : "…");
      text = compose(event, data, lang, { withUrl: false, reason, brand });
      if (segmentCount(text) <= MAX_SEGMENTS) return text;
    }
  }
  return text;
}

// GSM 03.38 basic set; the extension characters cost two septets.
const GSM_BASIC = new Set(
  Array.from(
    "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà",
  ),
);
const GSM_EXTENDED = new Set(Array.from("^{}\\[~]|€\f"));

/** Number of SMS parts: GSM-7 160/153, otherwise Unicode 70/67. */
export function segmentCount(text: string): number {
  const chars = Array.from(text);
  if (chars.length === 0) return 0;
  let septets = 0;
  let gsm = true;
  for (const ch of chars) {
    if (GSM_BASIC.has(ch)) septets += 1;
    else if (GSM_EXTENDED.has(ch)) septets += 2;
    else {
      gsm = false;
      break;
    }
  }
  if (gsm) return septets <= 160 ? 1 : Math.ceil(septets / 153);
  // Unicode counts UTF-16 code units.
  const units = text.length;
  return units <= 70 ? 1 : Math.ceil(units / 67);
}

export function shouldSend(input: {
  settings: NotificationSettings;
  event: NotificationEvent;
  tokenSet: boolean;
  phone: string;
  senderId: string;
}): "send" | "skip" {
  const { settings, event, tokenSet, phone, senderId } = input;
  if (!settings.enabled || !settings.events[event]) return "skip";
  if (!tokenSet || senderId.trim() === "") return "skip";
  if (normalizePhone(phone) === null) return "skip";
  return "send";
}

export function parseNotificationSettings(
  fields: Record<string, string | undefined>,
): NotificationSettings {
  const events = allEvents(false);
  for (const e of NOTIFICATION_EVENTS) events[e] = fields[`event_${e}`] === "on";
  return { enabled: fields.enabled === "on", events };
}

/** Slip events are keyed by the slip so each slip notifies once; others once per order. */
export function dedupeKey(event: NotificationEvent, slipId?: string): string {
  return (event === "slip_approved" || event === "slip_rejected") && slipId ? slipId : "";
}

/** The SMS event for an order moving to this status; confirmed and pending send nothing. */
export function eventForStatus(status: string): NotificationEvent | null {
  if (status === "shipped" || status === "delivered" || status === "cancelled") return status;
  return null;
}

/** Auto-cancel notices are only sent for orders cancelled within this window. */
export const CANCEL_NOTICE_WINDOW_HOURS = 24;

export function cancelNoticeCutoff(now: Date): string {
  return new Date(now.getTime() - CANCEL_NOTICE_WINDOW_HOURS * 3600_000).toISOString();
}

/** At most this many SMS per phone number, and per shop, in 24 hours (stops abuse and runaway cost). */
export const PHONE_DAILY_CAP = 6;
export const SHOP_DAILY_CAP = 300;

export function withinSendCaps(counts: { phone: number; shop: number }): boolean {
  return counts.phone < PHONE_DAILY_CAP && counts.shop < SHOP_DAILY_CAP;
}

/** True when the order has moved on so that a stored message would now be wrong. */
export function isStaleForStatus(event: NotificationEvent, orderStatus: string): boolean {
  return orderStatus === "cancelled" && (event === "placed" || event === "advance_due" || event === "shipped");
}
