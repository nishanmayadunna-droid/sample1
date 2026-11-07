import { revalidatePath } from "next/cache";
import { outcomeForCode, parseAmountToCents, parseNotify, PAYHERE_CURRENCY, verifyNotify } from "@/lib/payhere";
import { changeOrderStatus, getOrderForAdmin } from "@/lib/orders-data";
import { confirmPayment, orderNumberForRef, payhereCredentials, setPaymentStatus } from "@/lib/payhere-data";

// PayHere's server-to-server payment notification (the "notify_url"). It is a
// public endpoint on purpose: the only thing that makes a notification real is
// its md5sig, checked here with the merchant secret before anything is changed.
// It never trusts the browser, never reads cookies, and logs no card data.

const text = (body: string, status: number) =>
  new Response(body, { status, headers: { "Content-Type": "text/plain", "Cache-Control": "no-store" } });

export async function POST(request: Request): Promise<Response> {
  const credentials = payhereCredentials();
  if (!credentials) return text("not configured", 503);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return text("bad request", 400);
  }
  const read = (name: string) => {
    const value = form.get(name);
    return typeof value === "string" ? value : null;
  };

  const fields = parseNotify(read);
  if (!fields || !verifyNotify(fields, credentials.merchantId, credentials.secret)) {
    // Do not say which check failed.
    return text("invalid", 400);
  }

  try {
    const outcome = outcomeForCode(fields.statusCode);

    if (outcome === "success") {
      // Only our own currency, and only a plain amount we can compare exactly.
      const cents = parseAmountToCents(fields.amount);
      if (fields.currency !== PAYHERE_CURRENCY || cents === null) {
        console.error("payhere notify: unexpected currency or amount");
        return text("invalid", 400);
      }
      const result = await confirmPayment({
        ref: fields.orderId,
        paymentId: fields.paymentId,
        amountCents: cents,
        method: fields.method,
      });
      if (result === "unknown_ref") return text("unknown", 400);
      if (result === "amount_mismatch") {
        // Recorded on the attempt (status "mismatch", listed under Needs attention): answer 200 so
        // PayHere stops retrying a notification that will never match.
        console.error("payhere notify: amount mismatch for an attempt");
      }
      if (result === "paid") {
        // Money is in, signed by PayHere: confirm the order so the shop can pack it.
        // Best effort and only from "pending"; a failure must not make PayHere retry a
        // payment that is already recorded.
        try {
          const number = await orderNumberForRef(fields.orderId);
          const order = number ? await getOrderForAdmin(number) : null;
          if (order && order.status === "pending") await changeOrderStatus(order.id, "confirmed");
        } catch (error) {
          console.error("payhere auto-confirm failed", error instanceof Error ? error.name : "unknown");
        }
      }
      if (result === "overpaid" || result === "paid_no_order") {
        // Money arrived that the order could not take: the admin page lists it.
        console.error("payhere notify: payment needs a manual refund", result);
      }
    } else if (outcome === "cancelled" || outcome === "failed" || outcome === "chargedback") {
      const result = await setPaymentStatus(fields.orderId, outcome);
      if (result === "unknown_ref") return text("unknown", 400);
    }
    // "pending" and unknown codes need no change; PayHere sends the final one later.

    const orderNumber = await orderNumberForRef(fields.orderId).catch(() => null);
    if (orderNumber) {
      revalidatePath(`/orders/${orderNumber}`);
      revalidatePath(`/admin/orders/${orderNumber}`);
    }
    revalidatePath("/admin/orders");
    revalidatePath("/admin/online");
    revalidatePath("/account");
    return text("OK", 200);
  } catch (error) {
    // A server error makes PayHere retry the notification later.
    console.error("payhere notify failed", error instanceof Error ? error.name : "unknown");
    return text("error", 500);
  }
}
