"use server";

import { randomBytes } from "node:crypto";
import { requireUser } from "@/lib/auth-guards";
import { getOrderForUser } from "@/lib/orders-data";
import { buildCheckoutForm, canPayOnline, giftText, onlineAmounts, paymentRef } from "@/lib/payhere";
import {
  createPaymentAttempt,
  onlinePaymentAvailable,
  payhereCredentials,
  recentAttemptCount,
} from "@/lib/payhere-data";
import { absoluteUrl } from "@/lib/site";
import { findUserById } from "@/lib/users";

export type StartOnlineResult =
  | { ok: true; url: string; fields: Record<string, string> }
  | { ok: false; message: "not_available" | "not_allowed" | "busy" | "error" };

/**
 * Begins an online payment of the signed-in customer's own order. The amount, the
 * discount and the signed form are all worked out here from the order in the
 * database; the browser sends nothing but the order number.
 */
export async function startOnlinePayment(orderNumber: string): Promise<StartOnlineResult> {
  if (typeof orderNumber !== "string") return { ok: false, message: "error" };
  const user = await requireUser(`/orders/${orderNumber}`);
  try {
    const order = await getOrderForUser(orderNumber, user.id);
    if (!order || !canPayOnline(order)) return { ok: false, message: "not_allowed" };

    const [{ available, settings }, credentials] = [await onlinePaymentAvailable(), payhereCredentials()];
    if (!available || !credentials) return { ok: false, message: "not_available" };

    if ((await recentAttemptCount(order.id)) >= 5) return { ok: false, message: "busy" };

    const { discount, payable } = onlineAmounts(order, settings);
    const ref = paymentRef(order.orderNumber, randomBytes(4).toString("hex"));
    // The gift promised at this moment is kept with the attempt, so later setting
    // changes never rewrite what this customer was offered.
    const gift = giftText(settings, "en");

    await createPaymentAttempt({ orderId: order.id, ref, amount: payable, discount, gift });

    const account = await findUserById(user.id);
    const form = buildCheckoutForm({
      merchantId: credentials.merchantId,
      secret: credentials.secret,
      sandbox: settings.sandbox,
      ref,
      amountCents: payable,
      orderNumber: order.orderNumber,
      customerName: order.customerName,
      email: account?.email ?? null,
      phone: order.phone,
      address: order.address,
      city: order.city,
      returnUrl: absoluteUrl(`/orders/${order.orderNumber}?paid=1`),
      cancelUrl: absoluteUrl(`/orders/${order.orderNumber}`),
      notifyUrl: absoluteUrl("/api/payhere/notify"),
    });
    return { ok: true, url: form.url, fields: form.fields };
  } catch (error) {
    console.error("startOnlinePayment failed", error instanceof Error ? error.name : "unknown");
    return { ok: false, message: "error" };
  }
}
