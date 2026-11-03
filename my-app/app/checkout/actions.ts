"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth-guards";
import { getAllProducts, getCategories } from "@/lib/catalog";
import { advanceFor, advanceRequired } from "@/lib/advance";
import { createOrder } from "@/lib/orders-data";
import { bankDetailsComplete, getPaymentSettings, isUserTrusted } from "@/lib/payments-data";
import { planOrder } from "@/lib/order-plan";
import { parseCheckoutDetails, type DetailsField, type OrderMessage } from "@/lib/orders";
import { getRunningPromotions, getStoreSettings } from "@/lib/storefront";

export type PlaceOrderResult = {
  message: OrderMessage;
  orderNumber?: string;
  /** For out_of_stock: which product and size, and how many are left. */
  productId?: string;
  size?: string;
  left?: number;
  /** For price_changed: the total the shop would charge now, in cents. */
  total?: number;
  /** For details: the fields to fix. */
  fields?: DetailsField[];
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Places a cash-on-delivery order for the signed-in customer. The browser
 * sends only its cart lines, the details and the total it showed; every price,
 * promotion and stock limit is recomputed here. `key` is created once per
 * checkout attempt, so a double click or retry makes one order.
 */
export async function placeOrder(
  lines: unknown,
  fields: Record<string, string | undefined>,
  expectedTotal: number,
  key: string,
): Promise<PlaceOrderResult> {
  const user = await requireUser("/checkout");
  if (
    typeof key !== "string" ||
    !UUID.test(key) ||
    !Number.isInteger(expectedTotal) ||
    typeof fields !== "object" ||
    fields === null
  ) {
    return { message: "error" };
  }

  const details = parseCheckoutDetails(fields);
  if (!details.ok) {
    return { message: "details", fields: Object.keys(details.errors) as DetailsField[] };
  }

  try {
    const [products, categories, promotions, settings] = await Promise.all([
      getAllProducts(),
      getCategories(),
      getRunningPromotions(),
      getStoreSettings(),
    ]);
    const plan = planOrder({
      lines,
      products,
      promotions,
      shippingFee: settings.shippingFee,
      categories,
      expectedTotal,
    });
    if (!plan.ok) {
      if (plan.error === "empty") return { message: "empty" };
      if (plan.error === "price_changed") return { message: "price_changed", total: plan.total };
      if (plan.error === "out_of_stock") {
        return { message: "out_of_stock", productId: plan.productId, size: plan.size, left: plan.left };
      }
      // A product that is hidden, gone, or no longer offered in that size.
      return { message: "unknown_product", productId: plan.productId };
    }

    // The advance is decided here, never by the browser: untrusted customers pay
    // one when the shop has it switched on. Without bank details to pay into, no
    // order is placed at all (so nobody is left holding an unpayable advance).
    const [trusted, payment] = await Promise.all([isUserTrusted(user.id), getPaymentSettings()]);
    const required = advanceRequired(trusted, payment);
    if (required && !bankDetailsComplete(payment)) return { message: "advance_setup" };
    const advance = required ? advanceFor(plan.totals.total, payment) : 0;

    const result = await createOrder(user.id, key, details.value, plan.totals, plan.items, advance);
    if (!result.ok) {
      if (result.error === "out_of_stock") {
        return { message: "out_of_stock", productId: result.productId, size: result.size, left: result.left };
      }
      if (result.error === "too_many_pending") return { message: "too_many_pending" };
      return { message: "error" };
    }

    // Stock changed: refresh everything that shows sizes, sold-out tags or ratings.
    revalidatePath("/", "layout");
    revalidatePath("/products");
    for (const item of plan.items) revalidatePath(`/products/${item.productId}`);
    revalidatePath("/admin/orders");
    return { message: "placed", orderNumber: result.orderNumber };
  } catch (error) {
    console.error("placeOrder failed", error);
    return { message: "error" };
  }
}
