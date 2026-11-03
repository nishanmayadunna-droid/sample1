"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth-guards";
import { canCustomerCancel } from "@/lib/orders";
import { changeOrderStatus, getOrderForUser } from "@/lib/orders-data";

/**
 * Lets the signed-in customer cancel their own order while it is still pending.
 * The database function repeats the ownership and status checks and puts the
 * stock back. Returns a message code, never text.
 */
export async function cancelMyOrder(
  orderNumber: string,
): Promise<{ message: "cancelled" | "not_allowed" | "error" }> {
  if (typeof orderNumber !== "string") return { message: "error" };
  const user = await requireUser(`/orders/${orderNumber}`);
  try {
    const order = await getOrderForUser(orderNumber, user.id);
    if (!order || !canCustomerCancel(order.status, order.paymentStatus)) return { message: "not_allowed" };
    const outcome = await changeOrderStatus(order.id, "cancelled", user.id);
    if (outcome !== "ok") return { message: "not_allowed" };

    revalidatePath(`/orders/${orderNumber}`);
    revalidatePath("/account");
    revalidatePath("/admin/orders");
    revalidatePath("/", "layout");
    revalidatePath("/products");
    for (const item of order.items) {
      if (item.productId) revalidatePath(`/products/${item.productId}`);
    }
    return { message: "cancelled" };
  } catch (error) {
    console.error("cancelMyOrder failed", error);
    return { message: "error" };
  }
}
