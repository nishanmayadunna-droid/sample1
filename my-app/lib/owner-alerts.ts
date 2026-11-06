// Pure rules for SMS alerts to the shop owner. No I/O, so the sender, the admin
// form and the unit tests share them. Owner messages are English and plain
// ASCII on purpose (one or two SMS segments, no Unicode surcharge).
import { formatPrice } from "./products";
import { normalizePhone } from "./orders";
import { segmentCount } from "./notifications";

export const OWNER_ALERT_EVENTS = ["new_order", "new_slip", "low_stock", "sms_failed"] as const;
export type OwnerAlertEvent = (typeof OWNER_ALERT_EVENTS)[number];

export const OWNER_EVENT_LABELS: Record<OwnerAlertEvent, string> = {
  new_order: "A new order is placed",
  new_slip: "A customer uploads a payment slip",
  low_stock: "A size is running low",
  sms_failed: "A customer SMS fails to send",
};

export type OwnerAlertSettings = {
  enabled: boolean;
  /** 07XXXXXXXX, or "" when not set. */
  phone: string;
  events: Record<OwnerAlertEvent, boolean>;
  lowStockAt: number;
};

export const DEFAULT_OWNER_ALERT_SETTINGS: OwnerAlertSettings = {
  enabled: false,
  phone: "",
  events: { new_order: true, new_slip: true, low_stock: true, sms_failed: true },
  lowStockAt: 3,
};

/** At most this many owner alerts are sent or attempted in 24 hours (stops runaway cost). */
export const OWNER_DAILY_CAP = 40;

export function withinOwnerCap(sentLast24h: number): boolean {
  return sentLast24h < OWNER_DAILY_CAP;
}

/** Checks the admin form. The switch needs a valid owner number. */
export function parseOwnerAlertSettings(
  fields: Record<string, string | undefined>,
): { ok: true; value: OwnerAlertSettings } | { ok: false; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  const enabled = fields.enabled === "on";

  const rawPhone = (fields.phone ?? "").trim();
  let phone = "";
  if (rawPhone !== "") {
    const normalized = normalizePhone(rawPhone);
    if (normalized === null) errors.phone = "Enter a Sri Lankan mobile number such as 0771234567.";
    else phone = normalized;
  }
  if (enabled && phone === "" && !errors.phone) errors.phone = "Add your mobile number before switching alerts on.";

  const threshold = (fields.lowStockAt ?? "").trim();
  const lowStockAt = /^\d{1,2}$/.test(threshold) ? Number(threshold) : NaN;
  if (!(lowStockAt >= 1 && lowStockAt <= 50)) errors.lowStockAt = "Use a whole number from 1 to 50.";

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  const events = { ...DEFAULT_OWNER_ALERT_SETTINGS.events };
  for (const e of OWNER_ALERT_EVENTS) events[e] = fields[`event_${e}`] === "on";
  return { ok: true, value: { enabled, phone, events, lowStockAt } };
}

export type OwnerMessageData =
  | { event: "new_order"; orderNumber: string; total: number; advanceAmount: number }
  | { event: "new_slip"; orderNumber: string }
  | { event: "low_stock"; productName: string; size: string; left: number }
  | { event: "sms_failed"; orderNumber: string; customerEvent: string };

/** Keeps only printable ASCII so a product name can never push the text into Unicode. */
function ascii(text: string, max: number): string {
  const clean = text.replace(/[^\x20-\x7E]/g, "").replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 1).trimEnd()}.` : clean;
}

export function buildOwnerMessage(data: OwnerMessageData): string {
  switch (data.event) {
    case "new_order": {
      const pay = data.advanceAmount > 0 ? `advance ${formatPrice(data.advanceAmount)} due` : "COD";
      return `Northbound: new order ${data.orderNumber}, ${formatPrice(data.total)} (${pay}).`;
    }
    case "new_slip":
      return `Northbound: payment slip uploaded for ${data.orderNumber}. Please review it.`;
    case "low_stock": {
      const name = ascii(data.productName, 40) || "A product";
      const left = data.left <= 0 ? "sold out" : `${data.left} left`;
      return `Northbound: low stock, ${name} (${ascii(data.size, 12)}): ${left}.`;
    }
    case "sms_failed":
      return `Northbound: the ${ascii(data.customerEvent, 20)} SMS for ${data.orderNumber} failed to send. Check Notifications.`;
  }
}

export function ownerMessageSegments(data: OwnerMessageData): number {
  return segmentCount(buildOwnerMessage(data));
}

export function shouldSendOwner(input: {
  settings: OwnerAlertSettings;
  event: OwnerAlertEvent;
  tokenSet: boolean;
  senderId: string;
}): "send" | "skip" {
  const { settings, event, tokenSet, senderId } = input;
  if (!settings.enabled || !settings.events[event]) return "skip";
  if (!tokenSet || senderId.trim() === "") return "skip";
  if (normalizePhone(settings.phone) === null) return "skip";
  return "send";
}

/** The sizes that should raise a low-stock alert: tracked (a number) and at or under the threshold. */
export function lowStockHits(
  items: { productId: string; productName: string; size: string }[],
  stockByProduct: Map<string, Record<string, number> | null>,
  threshold: number,
  max = 3,
): { productId: string; productName: string; size: string; left: number }[] {
  const seen = new Set<string>();
  const hits: { productId: string; productName: string; size: string; left: number }[] = [];
  for (const item of items) {
    const key = `${item.productId}:${item.size}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const left = stockByProduct.get(item.productId)?.[item.size];
    if (typeof left === "number" && left <= threshold) {
      hits.push({ ...item, left: Math.max(left, 0) });
      if (hits.length >= max) break;
    }
  }
  return hits;
}

/** One alert per event subject; low stock repeats at most once per product size per Colombo day. */
export function ownerDedupe(event: OwnerAlertEvent, subject: string, day?: string): string {
  return event === "low_stock" ? `${subject}:${day ?? ""}` : subject;
}
