// Pure rules for PayHere online card payments (Part 22): the signed checkout
// form, the notification check and the amounts. No I/O and no environment
// access, so the Server Actions, the webhook route and the unit tests share
// them. Money is in cents inside the shop; PayHere gets "1234.50".
//
// API reference: https://support.payhere.lk/api-%26-mobile-sdk/checkout-api
import { createHash, timingSafeEqual } from "node:crypto";
import type { OrderStatus, PaymentStatus } from "./orders";

export const CHECKOUT_URL = {
  sandbox: "https://sandbox.payhere.lk/pay/checkout",
  // The live URL must include "www" (PayHere error PH-0022 otherwise).
  live: "https://www.payhere.lk/pay/checkout",
} as const;

export const PAYHERE_CURRENCY = "LKR";
/** PayHere requires a valid email; phone-only accounts have none. */
export const FALLBACK_EMAIL = "customer@example.com";

export type PayhereSettings = {
  enabled: boolean;
  sandbox: boolean;
  /** Percent off the goods for paying online, 0 to 50. */
  discountPercent: number;
  giftSi: string;
  giftEn: string;
};

export const DEFAULT_PAYHERE_SETTINGS: PayhereSettings = {
  enabled: false,
  sandbox: true,
  discountPercent: 0,
  giftSi: "",
  giftEn: "",
};

const md5 = (text: string) => createHash("md5").update(text).digest("hex");

/** Cents → "1234.50": two decimals, a dot, no thousands separator (what PayHere hashes). */
export function formatAmount(cents: number): string {
  const whole = Math.trunc(cents / 100);
  const fraction = Math.abs(cents % 100);
  return `${whole}.${String(fraction).padStart(2, "0")}`;
}

/** "1234.50" (or "1234.5") → cents, or null when it is not a plain positive amount. */
export function parseAmountToCents(raw: string): number | null {
  const match = /^(\d{1,9})(?:\.(\d{1,2}))?$/.exec(raw.trim());
  if (!match) return null;
  const cents = Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
  return cents > 0 ? cents : null;
}

/** hash = UPPER(md5(merchant_id + order_id + amount + currency + UPPER(md5(merchant_secret)))) */
export function checkoutHash(merchantId: string, orderId: string, amount: string, currency: string, secret: string): string {
  return md5(merchantId + orderId + amount + currency + md5(secret).toUpperCase()).toUpperCase();
}

/** md5sig = UPPER(md5(merchant_id + order_id + payhere_amount + payhere_currency + status_code + UPPER(md5(secret)))) */
export function notifySignature(
  fields: { merchantId: string; orderId: string; amount: string; currency: string; statusCode: string },
  secret: string,
): string {
  return md5(
    fields.merchantId + fields.orderId + fields.amount + fields.currency + fields.statusCode + md5(secret).toUpperCase(),
  ).toUpperCase();
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export type NotifyFields = {
  merchantId: string;
  orderId: string;
  paymentId: string;
  amount: string;
  currency: string;
  statusCode: string;
  md5sig: string;
  method: string;
};

/** Reads PayHere's callback fields; null when any required one is missing or oversized. */
export function parseNotify(get: (name: string) => string | null): NotifyFields | null {
  const read = (name: string, max: number) => {
    const value = get(name);
    return value !== null && value.length > 0 && value.length <= max ? value : null;
  };
  const merchantId = read("merchant_id", 40);
  const orderId = read("order_id", 50);
  const amount = read("payhere_amount", 20);
  const currency = read("payhere_currency", 5);
  const statusCode = read("status_code", 4);
  const md5sig = read("md5sig", 64);
  if (!merchantId || !orderId || !amount || !currency || !statusCode || !md5sig) return null;
  const paymentId = get("payment_id");
  const method = get("method");
  return {
    merchantId,
    orderId,
    amount,
    currency,
    statusCode,
    md5sig,
    paymentId: (paymentId ?? "").slice(0, 60),
    method: (method ?? "").slice(0, 30),
  };
}

/** True only when the notification was signed with our merchant secret for our merchant id. */
export function verifyNotify(fields: NotifyFields, merchantId: string, secret: string): boolean {
  if (!safeEqual(fields.merchantId, merchantId)) return false;
  return safeEqual(fields.md5sig.toUpperCase(), notifySignature(fields, secret));
}

export type PaymentOutcome = "success" | "pending" | "cancelled" | "failed" | "chargedback" | "unknown";

/** PayHere status_code: 2 success, 0 pending, -1 cancelled, -2 failed, -3 chargedback. */
export function outcomeForCode(code: string): PaymentOutcome {
  switch (code.trim()) {
    case "2":
      return "success";
    case "0":
      return "pending";
    case "-1":
      return "cancelled";
    case "-2":
      return "failed";
    case "-3":
      return "chargedback";
    default:
      return "unknown";
  }
}

/** The order_id sent to PayHere: unique per attempt, so a retry never collides. */
export function paymentRef(orderNumber: string, suffix: string): string {
  return `${orderNumber}-${suffix}`;
}

/** An order can be paid online while it is open and not already paid or advance-paid. */
export function canPayOnline(order: { status: OrderStatus; paymentStatus: PaymentStatus }): boolean {
  return (
    (order.status === "pending" || order.status === "confirmed") &&
    (order.paymentStatus === "unpaid" || order.paymentStatus === "advance_due" || order.paymentStatus === "slip_uploaded")
  );
}

/**
 * What an online payment of this order costs. The reward for paying online is a
 * percent off the goods (after promotions and points, never shipping); it is
 * worked out here, on the server, and the notification must match it exactly.
 */
export function onlineAmounts(
  order: { subtotal: number; discount: number; pointsDiscount: number; total: number },
  settings: Pick<PayhereSettings, "discountPercent">,
): { discount: number; payable: number } {
  const goods = Math.max(order.subtotal - order.discount - order.pointsDiscount, 0);
  const wanted = Math.floor((goods * Math.max(settings.discountPercent, 0)) / 100);
  // Never below Re 1 so PayHere always has an amount to charge.
  const discount = Math.min(wanted, Math.max(order.total - 100, 0));
  return { discount, payable: order.total - discount };
}

/** Splits a full name for PayHere's first/last name fields (both are required). */
export function splitName(full: string): { first: string; last: string } {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first: "Customer", last: "Customer" };
  if (parts.length === 1) return { first: parts[0], last: "Customer" };
  return { first: parts[0], last: parts.slice(1).join(" ") };
}

export type CheckoutInput = {
  merchantId: string;
  secret: string;
  sandbox: boolean;
  ref: string;
  amountCents: number;
  orderNumber: string;
  customerName: string;
  email: string | null;
  phone: string;
  address: string;
  city: string;
  returnUrl: string;
  cancelUrl: string;
  notifyUrl: string;
};

/** The signed fields the browser posts to PayHere. The secret never leaves the server. */
export function buildCheckoutForm(input: CheckoutInput): { url: string; fields: Record<string, string> } {
  const amount = formatAmount(input.amountCents);
  const { first, last } = splitName(input.customerName);
  return {
    url: input.sandbox ? CHECKOUT_URL.sandbox : CHECKOUT_URL.live,
    fields: {
      merchant_id: input.merchantId,
      return_url: input.returnUrl,
      cancel_url: input.cancelUrl,
      notify_url: input.notifyUrl,
      order_id: input.ref,
      items: `Order ${input.orderNumber}`,
      currency: PAYHERE_CURRENCY,
      amount,
      first_name: first,
      last_name: last,
      email: input.email && input.email.includes("@") ? input.email : FALLBACK_EMAIL,
      phone: input.phone,
      address: input.address,
      city: input.city,
      country: "Sri Lanka",
      hash: checkoutHash(input.merchantId, input.ref, amount, PAYHERE_CURRENCY, input.secret),
    },
  };
}

const CONTROL = /[\u0000-\u001F\u007F]/;

/** Checks the admin form (the merchant id and secret are environment variables, not form fields). */
export function parsePayhereSettings(
  fields: Record<string, string | undefined>,
): { ok: true; value: PayhereSettings } | { ok: false; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  const rawPercent = (fields.discountPercent ?? "").trim();
  const discountPercent = /^\d{1,2}$/.test(rawPercent) ? Number(rawPercent) : Number.NaN;
  if (!(discountPercent >= 0 && discountPercent <= 50)) errors.discountPercent = "Enter a whole number from 0 to 50.";
  const giftSi = (fields.giftSi ?? "").trim();
  const giftEn = (fields.giftEn ?? "").trim();
  if (giftSi.length > 120 || CONTROL.test(giftSi)) errors.giftSi = "Up to 120 characters.";
  if (giftEn.length > 120 || CONTROL.test(giftEn)) errors.giftEn = "Up to 120 characters.";
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: {
      enabled: fields.enabled === "on",
      sandbox: fields.sandbox === "on",
      discountPercent,
      giftSi,
      giftEn,
    },
  };
}

/** The gift line in the customer's language, or null when none is set. */
export function giftText(settings: Pick<PayhereSettings, "giftSi" | "giftEn">, lang: "si" | "en"): string | null {
  const text = lang === "si" ? settings.giftSi || settings.giftEn : settings.giftEn || settings.giftSi;
  return text.trim() === "" ? null : text;
}
