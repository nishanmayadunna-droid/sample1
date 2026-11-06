"use client";

import { useActionState, useState, useTransition } from "react";
import { recordRefundAction, type RefundState } from "./actions";

const initialState: RefundState = { errors: {}, saved: false };
const inputClass = "mt-2 w-full rounded-md border border-line bg-bg px-4 py-3 outline-none focus:border-ink";

/**
 * Records money the shop has sent back. The parent gives this form a new `key`
 * after each refund, so every form instance owns one idempotency key: a double
 * click or a retry can never record the same refund twice.
 */
export default function RefundForm({ orderId, remaining }: { orderId: string; remaining: number }) {
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const [state, submit, pending] = useActionState(recordRefundAction.bind(null, orderId, idempotencyKey), initialState);
  const [, startTransition] = useTransition();
  const errors = state.errors;

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        startTransition(() => submit(formData));
      }}
      className="mt-3 max-w-xl"
    >
      <div className="grid gap-x-4 sm:grid-cols-2">
        <label className="block">
          <span className="eyebrow text-muted">Amount (Rs)</span>
          <input name="amount" inputMode="decimal" defaultValue={(remaining / 100).toFixed(2)} className={inputClass} />
          {errors.amount && (
            <span className="mt-1 block text-sm text-blaze">
              {typeof errors.amount === "string" ? errors.amount : "Enter an amount in rupees."}
            </span>
          )}
        </label>
        <label className="block">
          <span className="eyebrow text-muted">Method</span>
          <select name="method" defaultValue="bank_transfer" className={inputClass}>
            <option value="bank_transfer">Bank transfer</option>
            <option value="cash">Cash</option>
            <option value="other">Other</option>
          </select>
        </label>
        <label className="block">
          <span className="eyebrow text-muted">Reference (optional)</span>
          <input name="reference" maxLength={100} className={inputClass} />
          {errors.reference && <span className="mt-1 block text-sm text-blaze">Up to 100 characters.</span>}
        </label>
        <label className="block">
          <span className="eyebrow text-muted">Note (optional)</span>
          <input name="note" maxLength={200} className={inputClass} />
          {errors.note && <span className="mt-1 block text-sm text-blaze">Up to 200 characters.</span>}
        </label>
      </div>
      {typeof errors.form === "string" && <p className="mt-2 text-sm text-blaze">{errors.form}</p>}
      <button
        type="submit"
        disabled={pending || remaining <= 0}
        className="mt-4 rounded-full bg-blaze px-6 py-3 font-medium text-white transition-transform hover:-translate-y-0.5 disabled:opacity-60"
      >
        {pending ? "Saving…" : "Record refund"}
      </button>
    </form>
  );
}
