// Pure rules for refunds of an approved advance on a cancelled order.
// No I/O, so the Server Action, the admin form and the unit tests share them.
// All money is in cents.
import { parsePriceToCents } from "./product-form";
import type { OrderStatus, PaymentStatus } from "./orders";

export type RefundMethod = "bank_transfer" | "cash" | "other";

export const REFUND_METHODS: RefundMethod[] = ["bank_transfer", "cash", "other"];

const LABELS: Record<RefundMethod, { si: string; en: string }> = {
  bank_transfer: { si: "බැංකු මාරුවක්", en: "Bank transfer" },
  cash: { si: "මුදල්", en: "Cash" },
  other: { si: "වෙනත්", en: "Other" },
};

export function refundMethodLabel(method: RefundMethod): { si: string; en: string } {
  return LABELS[method];
}

export type Refund = {
  id: string;
  amount: number;
  method: RefundMethod;
  reference: string | null;
  note: string | null;
  createdAt: string;
};

/** Only a cancelled order whose advance was approved has money to give back. */
export function canRefund(order: {
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  advanceAmount: number;
}): boolean {
  return order.status === "cancelled" && order.paymentStatus === "advance_paid" && order.advanceAmount > 0;
}

export type RefundSummary = {
  refunded: number;
  remaining: number;
  state: "none" | "partial" | "full";
};

export function refundSummary(advanceAmount: number, refunds: { amount: number }[]): RefundSummary {
  const refunded = refunds.reduce((sum, refund) => sum + refund.amount, 0);
  const remaining = Math.max(advanceAmount - refunded, 0);
  const state = refunded <= 0 ? "none" : remaining === 0 ? "full" : "partial";
  return { refunded, remaining, state };
}

export type RefundInput = { amount: string; method: string; reference: string; note: string };
export type RefundValue = {
  amount: number;
  method: RefundMethod;
  reference: string;
  note: string;
};

// Newline and tab are fine in the note; other control characters are not.
const CONTROL_CHARS = /[\u0000-\u0008\u000B-\u001F\u007F]/;

function text(raw: string, max: number): string | null {
  const value = raw.trim();
  return value.length <= max && !CONTROL_CHARS.test(value) ? value : null;
}

/** Checks the admin's refund form. `remaining` is what is still owed, in cents. */
export function parseRefundForm(
  input: RefundInput,
  remaining: number,
): { ok: true; value: RefundValue } | { ok: false; errors: Record<string, string | true> } {
  const errors: Record<string, string | true> = {};

  const amount = parsePriceToCents(input.amount);
  if (amount === null) errors.amount = true;
  else if (amount > remaining) errors.amount = "That is more than is still owed.";

  const method = REFUND_METHODS.find((m) => m === input.method);
  if (!method) errors.method = true;

  const reference = text(input.reference, 100);
  if (reference === null) errors.reference = true;
  const note = text(input.note, 200);
  if (note === null) errors.note = true;

  if (Object.keys(errors).length > 0 || amount === null || !method || reference === null || note === null) {
    return { ok: false, errors };
  }
  return { ok: true, value: { amount, method, reference, note } };
}
