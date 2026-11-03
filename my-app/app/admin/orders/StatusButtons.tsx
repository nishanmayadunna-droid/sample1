"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { nextStatuses, statusLabel, type OrderStatus } from "@/lib/orders";
import { setOrderStatusAction } from "./actions";

const buttonClass =
  "rounded-md border border-line px-3 py-1.5 font-mono text-[0.7rem] uppercase tracking-[0.14em] text-muted hover:border-ink hover:text-ink disabled:opacity-40";

/** Only the status changes the order's current status allows. */
export default function StatusButtons({ orderId, status }: { orderId: string; status: OrderStatus }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const options = nextStatuses(status);

  if (options.length === 0) {
    return <p className="text-sm text-muted">This order is {statusLabel(status).en.toLowerCase()}; no further changes.</p>;
  }

  function change(to: OrderStatus) {
    if (to === "cancelled") {
      const text =
        status === "shipped"
          ? "Cancel this shipped order? Its stock is NOT put back automatically: adjust it in the product once the parcel is really back."
          : "Cancel this order? Its stock goes back on the shelf.";
      if (!window.confirm(text)) return;
    }
    startTransition(async () => {
      const result = await setOrderStatusAction(orderId, to);
      setError(result.error);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {options.map((to) => (
          <button key={to} type="button" disabled={pending} onClick={() => change(to)} className={buttonClass}>
            {to === "cancelled" ? "Cancel order" : `Mark ${statusLabel(to).en.toLowerCase()}`}
          </button>
        ))}
      </div>
      {error && <span className="text-sm text-blaze">{error}</span>}
    </div>
  );
}
