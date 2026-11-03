// Pure order rules: statuses, checkout details validation, totals. No I/O, so
// they are shared by the Server Actions, the pages and the unit tests.

export const ORDER_STATUSES = ["pending", "confirmed", "shipped", "delivered", "cancelled"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

/** Codes the checkout Server Action returns; the UI turns them into text. */
export type OrderMessage =
  | "placed"
  | "details"
  | "empty"
  | "out_of_stock"
  | "price_changed"
  | "unknown_product"
  | "too_many_pending"
  | "error";

// Keep in step with public.set_order_status in the orders migration.
const NEXT: Record<OrderStatus, OrderStatus[]> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["shipped", "cancelled"],
  shipped: ["delivered", "cancelled"],
  delivered: [],
  cancelled: [],
};

export function nextStatuses(status: OrderStatus): OrderStatus[] {
  return NEXT[status];
}

/** A customer may cancel their own order only before the shop has confirmed it. */
export function canCustomerCancel(status: OrderStatus): boolean {
  return status === "pending";
}

const LABELS: Record<OrderStatus, { si: string; en: string }> = {
  pending: { si: "අපේක්ෂිත", en: "Pending" },
  confirmed: { si: "තහවුරු කළා", en: "Confirmed" },
  shipped: { si: "යවා ඇත", en: "Shipped" },
  delivered: { si: "බෙදා හැරියා", en: "Delivered" },
  cancelled: { si: "අවලංගු කළා", en: "Cancelled" },
};

export function statusLabel(status: OrderStatus): { si: string; en: string } {
  return LABELS[status];
}

/** A Sri Lankan mobile number in any common spelling → `07XXXXXXXX`, else null. */
export function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/[\s-]/g, "");
  const match = /^(?:\+94|94|0)(7\d{8})$/.exec(digits);
  return match ? `0${match[1]}` : null;
}

export type CheckoutDetails = {
  name: string;
  phone: string;
  address: string;
  city: string;
  note: string | null;
};

export type DetailsField = "name" | "phone" | "address" | "city" | "note";

// Newline and tab are fine in an address or note; other control characters are not.
const CONTROL_CHARS = /[\u0000-\u0008\u000B-\u001F\u007F]/;

function text(raw: string | undefined, min: number, max: number): string | null {
  const value = (raw ?? "").trim();
  return value.length >= min && value.length <= max && !CONTROL_CHARS.test(value) ? value : null;
}

export function parseCheckoutDetails(
  fields: Record<string, string | undefined>,
): { ok: true; value: CheckoutDetails } | { ok: false; errors: Partial<Record<DetailsField, true>> } {
  const errors: Partial<Record<DetailsField, true>> = {};

  const name = text(fields.name, 2, 80);
  if (name === null) errors.name = true;
  const phone = normalizePhone(fields.phone ?? "");
  if (phone === null) errors.phone = true;
  const address = text(fields.address, 5, 200);
  if (address === null) errors.address = true;
  const city = text(fields.city, 2, 60);
  if (city === null) errors.city = true;

  const rawNote = (fields.note ?? "").trim();
  const note = rawNote === "" ? null : text(rawNote, 1, 500);
  if (rawNote !== "" && note === null) errors.note = true;

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value: { name: name!, phone: phone!, address: address!, city: city!, note } };
}

export type OrderTotals = { subtotal: number; discount: number; shipping: number; total: number };

export function orderTotals(summary: {
  subtotal: number;
  orderDiscount: { amount: number } | null;
  shipping: number;
  total: number;
}): OrderTotals {
  return {
    subtotal: summary.subtotal,
    discount: summary.orderDiscount?.amount ?? 0,
    shipping: summary.shipping,
    total: summary.total,
  };
}
