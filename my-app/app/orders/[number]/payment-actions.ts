"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth-guards";
import { isValidSlipPath, MAX_SLIPS, SLIP_MAX_BYTES, SLIP_TYPES, slipPathFor } from "@/lib/advance";
import { getOrderForUser, type Order } from "@/lib/orders-data";
import { attachSlip, createSlipUpload, listSlipsForOrder, objectExists } from "@/lib/payments-data";

// Both actions load the order with the session user's id, so another
// customer's order number is simply "not allowed".

/** An advance order that is still waiting for its advance and isn't cancelled. */
function acceptsSlips(order: Order): boolean {
  return (
    order.advanceAmount > 0 &&
    order.status !== "cancelled" &&
    (order.paymentStatus === "advance_due" || order.paymentStatus === "slip_uploaded")
  );
}

/** A one-time signed URL the browser uploads the slip to, in this order's folder. */
export async function requestSlipUpload(
  orderNumber: string,
  contentType: string,
  size: number,
): Promise<{ path: string; token: string } | { error: "not_allowed" | "bad_file" | "error" }> {
  if (typeof orderNumber !== "string") return { error: "not_allowed" };
  const user = await requireUser(`/orders/${orderNumber}`);
  try {
    const order = await getOrderForUser(orderNumber, user.id);
    if (!order || !acceptsSlips(order)) return { error: "not_allowed" };
    if ((await listSlipsForOrder(order.id)).length >= MAX_SLIPS) return { error: "not_allowed" };
    if (
      !(SLIP_TYPES as readonly string[]).includes(contentType) ||
      !Number.isFinite(size) ||
      size <= 0 ||
      size > SLIP_MAX_BYTES
    ) {
      return { error: "bad_file" };
    }
    const rand = crypto.randomUUID().replace(/-/g, "").slice(0, 10);
    const path = slipPathFor(order.id, contentType, Date.now(), rand);
    if (!path) return { error: "bad_file" };
    return await createSlipUpload(path);
  } catch (error) {
    console.error("requestSlipUpload failed", error);
    return { error: "error" };
  }
}

/** Records the uploaded file as a pending slip for the admin to check. */
export async function attachPaymentSlip(
  orderNumber: string,
  path: string,
): Promise<{ message: "saved" | "not_allowed" | "bad_file" | "too_many" | "error" }> {
  if (typeof orderNumber !== "string" || typeof path !== "string") return { message: "not_allowed" };
  const user = await requireUser(`/orders/${orderNumber}`);
  try {
    const order = await getOrderForUser(orderNumber, user.id);
    if (!order || !acceptsSlips(order)) return { message: "not_allowed" };
    // Only a file name we issued, in this order's folder, that really was uploaded.
    if (!isValidSlipPath(order.id, path) || !(await objectExists("payment-slips", path))) {
      return { message: "bad_file" };
    }
    const outcome = await attachSlip(order.id, user.id, path);
    if (outcome === "too_many") return { message: "too_many" };
    if (outcome !== "ok") return { message: "not_allowed" };
    revalidatePath(`/orders/${orderNumber}`);
    revalidatePath("/admin/orders");
    revalidatePath(`/admin/orders/${orderNumber}`);
    return { message: "saved" };
  } catch (error) {
    console.error("attachPaymentSlip failed", error);
    return { message: "error" };
  }
}
