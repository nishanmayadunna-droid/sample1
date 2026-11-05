import type { NotificationEvent } from "@/lib/notifications";

export const EVENT_LABELS: Record<NotificationEvent, string> = {
  placed: "Order placed (cash on delivery)",
  advance_due: "Order placed, advance payment due",
  slip_approved: "Payment slip approved",
  slip_rejected: "Payment slip rejected",
  shipped: "Order shipped (with tracking)",
  delivered: "Order delivered",
  cancelled: "Order cancelled",
};
