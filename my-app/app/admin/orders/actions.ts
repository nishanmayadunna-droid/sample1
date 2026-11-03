"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth-guards";
import { ORDER_STATUSES, type OrderStatus } from "@/lib/orders";
import { changeOrderStatus } from "@/lib/orders-data";
import { reviewSlip } from "@/lib/payments-data";
import { supabaseAdmin } from "@/lib/supabase/admin";

// Every action re-checks admin access first: Server Actions are endpoints of
// their own and can be called without going through the /admin pages.

export type OrderRowState = { error: string | null };

const SOMETHING_WRONG = "Something went wrong, please try again.";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function setOrderStatusAction(orderId: string, to: string): Promise<OrderRowState> {
  await requireAdmin("/admin/orders");
  if (!UUID.test(orderId) || !ORDER_STATUSES.includes(to as OrderStatus)) {
    return { error: SOMETHING_WRONG };
  }
  try {
    const outcome = await changeOrderStatus(orderId, to as OrderStatus);
    if (outcome === "not_found") return { error: "That order no longer exists." };
    if (outcome === "advance_unpaid") return { error: "Approve the advance slip before confirming this order." };
    if (outcome === "bad_transition") return { error: "That status change isn't allowed from the current status." };

    // Page paths come from the order itself, so nothing here trusts the client.
    const { data } = await supabaseAdmin
      .from("orders")
      .select("order_number, order_items(product_id)")
      .eq("id", orderId)
      .maybeSingle<{ order_number: string; order_items: { product_id: string | null }[] | null }>();
    revalidatePath("/admin/orders");
    if (data) {
      revalidatePath(`/admin/orders/${data.order_number}`);
      revalidatePath(`/orders/${data.order_number}`);
      for (const item of data.order_items ?? []) {
        if (item.product_id) revalidatePath(`/products/${item.product_id}`);
      }
    }
    // Cancelling gives stock back, which shows on cards and the shell.
    revalidatePath("/account");
    revalidatePath("/", "layout");
    revalidatePath("/products");
  } catch (error) {
    console.error("setOrderStatusAction failed", error);
    return { error: SOMETHING_WRONG };
  }
  return { error: null };
}

/** Approves or rejects a customer's advance slip. Approving makes the customer trusted. */
export async function reviewSlipAction(
  slipId: string,
  approve: boolean,
  reason: string,
): Promise<OrderRowState> {
  await requireAdmin("/admin/orders");
  const cleanReason = typeof reason === "string" ? reason.trim() : "";
  if (
    typeof slipId !== "string" ||
    !UUID.test(slipId) ||
    typeof approve !== "boolean" ||
    cleanReason.length > 200 ||
    (!approve && cleanReason === "")
  ) {
    return { error: approve ? SOMETHING_WRONG : "Give a short reason (up to 200 characters) when rejecting." };
  }
  try {
    const outcome = await reviewSlip(slipId, approve, cleanReason);
    if (outcome === "not_found") return { error: "That slip no longer exists." };
    if (outcome === "not_pending") return { error: "That slip was already reviewed. Refresh the page." };
    if (outcome === "bad_state") return { error: "This order is cancelled." };
    revalidatePath("/admin/orders");
    revalidatePath("/admin/orders/[number]", "page");
    revalidatePath("/orders/[number]", "page");
    revalidatePath("/admin/customers");
    revalidatePath("/account");
    revalidatePath("/checkout");
  } catch (error) {
    console.error("reviewSlipAction failed", error);
    return { error: SOMETHING_WRONG };
  }
  return { error: null };
}
