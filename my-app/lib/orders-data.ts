// Server-side access to orders. Uses the secret-key client: callers must have
// checked requireUser()/requireAdmin() first and customer reads must always
// pass the session user's id.
import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { PlannedItem } from "@/lib/order-plan";
import type { CheckoutDetails, OrderStatus, OrderTotals, PaymentMethod, PaymentStatus } from "@/lib/orders";

export type OrderItem = {
  productId: string | null;
  productName: string;
  size: string;
  quantity: number;
  unitPrice: number;
  compareAt: number | null;
};

export type Order = {
  id: string;
  orderNumber: string;
  userId: string;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  /** What the customer pays up front by bank transfer, in cents (0 for plain COD). */
  advanceAmount: number;
  customerName: string;
  phone: string;
  address: string;
  city: string;
  note: string | null;
  subtotal: number;
  discount: number;
  shipping: number;
  total: number;
  createdAt: string;
  items: OrderItem[];
};

type ItemRow = {
  product_id: string | null;
  product_name: string;
  size: string;
  quantity: number;
  unit_price: number;
  compare_at: number | null;
};

type OrderRow = {
  id: string;
  order_number: string;
  user_id: string;
  status: OrderStatus;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  advance_amount: number;
  customer_name: string;
  phone: string;
  address: string;
  city: string;
  note: string | null;
  subtotal: number;
  discount: number;
  shipping: number;
  total: number;
  created_at: string;
  order_items: ItemRow[] | null;
};

const COLUMNS =
  "id, order_number, user_id, status, payment_method, payment_status, advance_amount, customer_name, phone, address, city, note, subtotal, discount, shipping, total, created_at, order_items(product_id, product_name, size, quantity, unit_price, compare_at)";

function toOrder(row: OrderRow): Order {
  return {
    id: row.id,
    orderNumber: row.order_number,
    userId: row.user_id,
    status: row.status,
    paymentMethod: row.payment_method,
    paymentStatus: row.payment_status,
    advanceAmount: row.advance_amount,
    customerName: row.customer_name,
    phone: row.phone,
    address: row.address,
    city: row.city,
    note: row.note,
    subtotal: row.subtotal,
    discount: row.discount,
    shipping: row.shipping,
    total: row.total,
    createdAt: row.created_at,
    items: (row.order_items ?? []).map((item) => ({
      productId: item.product_id,
      productName: item.product_name,
      size: item.size,
      quantity: item.quantity,
      unitPrice: item.unit_price,
      compareAt: item.compare_at,
    })),
  };
}

function fail(error: unknown): never {
  console.error("orders query failed", error);
  throw new Error("orders query failed");
}

export type CreateOrderResult =
  | { ok: true; orderNumber: string }
  | { ok: false; error: "out_of_stock"; productId: string; size: string; left: number }
  | { ok: false; error: "unknown_product"; productId: string }
  | { ok: false; error: "too_many_pending" }
  | { ok: false; error: "error" };

/** Places the order and takes the stock in one database transaction. */
export async function createOrder(
  userId: string,
  key: string,
  details: CheckoutDetails,
  totals: OrderTotals,
  items: PlannedItem[],
  /** The advance to collect by bank transfer, in cents; 0 for plain COD. */
  advance: number,
): Promise<CreateOrderResult> {
  const { data, error } = await supabaseAdmin.rpc("place_order", {
    p_user_id: userId,
    p_key: key,
    p_customer: {
      name: details.name,
      phone: details.phone,
      address: details.address,
      city: details.city,
      note: details.note ?? "",
    },
    p_totals: totals,
    p_advance: advance,
    p_items: items.map((item) => ({
      product_id: item.productId,
      product_name: item.productName,
      size: item.size,
      quantity: item.quantity,
      unit_price: item.unitPrice,
      compare_at: item.compareAt ?? "",
    })),
  });
  if (error) {
    const stock = /out_of_stock:([^:]+):([^:]+):(\d+)/.exec(error.message);
    if (stock) {
      return { ok: false, error: "out_of_stock", productId: stock[1], size: stock[2], left: Number(stock[3]) };
    }
    if (error.message.includes("too_many_pending")) return { ok: false, error: "too_many_pending" };
    const unknown = /unknown_product:(.+)$/.exec(error.message);
    if (unknown) return { ok: false, error: "unknown_product", productId: unknown[1] };
    console.error("place_order failed", error);
    return { ok: false, error: "error" };
  }
  return { ok: true, orderNumber: data as string };
}

/** The user's own order; null for a missing number or someone else's order. */
export async function getOrderForUser(orderNumber: string, userId: string): Promise<Order | null> {
  const { data, error } = await supabaseAdmin
    .from("orders")
    .select(COLUMNS)
    .eq("order_number", orderNumber)
    .eq("user_id", userId)
    .maybeSingle<OrderRow>();
  if (error) fail(error);
  return data ? toOrder(data) : null;
}

export async function listOrdersForUser(userId: string): Promise<Order[]> {
  const { data, error } = await supabaseAdmin
    .from("orders")
    .select(COLUMNS)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(100)
    .returns<OrderRow[]>();
  if (error) fail(error);
  return data.map(toOrder);
}

/** The delivery details of the user's latest order, to prefill the checkout form. */
export async function getLatestDetailsForUser(userId: string): Promise<CheckoutDetails | null> {
  const { data, error } = await supabaseAdmin
    .from("orders")
    .select("customer_name, phone, address, city")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .returns<{ customer_name: string; phone: string; address: string; city: string }[]>();
  if (error) fail(error);
  const row = data[0];
  return row
    ? { name: row.customer_name, phone: row.phone, address: row.address, city: row.city, note: null }
    : null;
}

export async function listOrdersForAdmin(status?: OrderStatus): Promise<Order[]> {
  let query = supabaseAdmin.from("orders").select(COLUMNS);
  if (status) query = query.eq("status", status);
  const { data, error } = await query
    .order("created_at", { ascending: false })
    .limit(300)
    .returns<OrderRow[]>();
  if (error) fail(error);
  const orders = data.map(toOrder);
  // Pending first (they need action), then newest first.
  return orders.sort((a, b) => Number(b.status === "pending") - Number(a.status === "pending"));
}

export async function getOrderForAdmin(orderNumber: string): Promise<Order | null> {
  const { data, error } = await supabaseAdmin
    .from("orders")
    .select(COLUMNS)
    .eq("order_number", orderNumber)
    .maybeSingle<OrderRow>();
  if (error) fail(error);
  return data ? toOrder(data) : null;
}

/** Moves an order along its flow; the database function enforces the rules. */
export async function changeOrderStatus(
  orderId: string,
  to: OrderStatus,
  userId?: string,
): Promise<"ok" | "bad_transition" | "not_found" | "advance_unpaid"> {
  const { error } = await supabaseAdmin.rpc("set_order_status", {
    p_order_id: orderId,
    p_to: to,
    p_user_id: userId ?? null,
  });
  if (!error) return "ok";
  if (error.message.includes("bad_transition")) return "bad_transition";
  if (error.message.includes("advance_unpaid")) return "advance_unpaid";
  if (error.message.includes("order_not_found")) return "not_found";
  fail(error);
}

/** True when the user has a delivered order containing this product. */
export async function userHasDeliveredProduct(userId: string, productId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from("orders")
    .select("id, order_items!inner(product_id)")
    .eq("user_id", userId)
    .eq("status", "delivered")
    .eq("order_items.product_id", productId)
    .limit(1)
    .returns<{ id: string }[]>();
  if (error) fail(error);
  return data.length > 0;
}
