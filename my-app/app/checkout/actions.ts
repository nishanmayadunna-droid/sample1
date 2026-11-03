"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth-guards";
import { getAllProducts, getCategories } from "@/lib/catalog";
import { advanceFor, advanceRequired } from "@/lib/advance";
import { createOrder, findOrderNumberByKey } from "@/lib/orders-data";
import type { PointsSettings } from "@/lib/points";
import { getPointsBalance, getPointsSettings } from "@/lib/points-data";
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
  /** For advance_changed: the advance the shop would charge now, in cents (0 = none). */
  advance?: number;
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
  /** The advance the form showed, in cents (0 when it showed plain COD). */
  expectedAdvance: number,
  /** How many points the shopper chose to use (the server clamps it). */
  pointsRequested: number,
): Promise<PlaceOrderResult> {
  const user = await requireUser("/checkout");
  if (
    typeof key !== "string" ||
    !UUID.test(key) ||
    !Number.isInteger(expectedTotal) ||
    !Number.isInteger(expectedAdvance) ||
    typeof pointsRequested !== "number" ||
    !Number.isFinite(pointsRequested) ||
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
    // A retry after a lost response (same key) must get the order that was already
    // placed. Planning again would see the spent points and call it a price change.
    const placedAlready = await findOrderNumberByKey(user.id, key);
    if (placedAlready) return { message: "placed", orderNumber: placedAlready };

    const [products, categories, promotions, settings] = await Promise.all([
      getAllProducts(),
      getCategories(),
      getRunningPromotions(),
      getStoreSettings(),
    ]);
    // Points are read on the server. If they can't be read they count as off: the
    // form's total then differs and the shopper is asked to review it (price_changed).
    const pointsOff: PointsSettings = { enabled: false, earnPer: 10000, pointValue: 100, maxPercent: 50 };
    const [pointsSettings, pointsBalance] = await Promise.all([
      getPointsSettings().catch((error) => {
        console.error("points settings failed", error);
        return pointsOff;
      }),
      getPointsBalance(user.id).catch((error) => {
        console.error("points balance failed", error);
        return 0;
      }),
    ]);
    const plan = planOrder({
      lines,
      products,
      promotions,
      shippingFee: settings.shippingFee,
      categories,
      expectedTotal,
      pointsRequested,
      pointsBalance,
      pointsSettings,
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

    // The shopper must not agree to cash on delivery and end up owing a bank transfer.
    if (advance !== expectedAdvance) return { message: "advance_changed", advance };

    const result = await createOrder(user.id, key, details.value, plan.totals, plan.items, advance, {
      used: plan.points.used,
      discount: plan.totals.pointsDiscount,
      toEarn: plan.points.toEarn,
    });
    if (!result.ok) {
      if (result.error === "out_of_stock") {
        return { message: "out_of_stock", productId: result.productId, size: result.size, left: result.left };
      }
      if (result.error === "too_many_pending") return { message: "too_many_pending" };
      if (result.error === "not_enough_points") return { message: "points_changed" };
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
