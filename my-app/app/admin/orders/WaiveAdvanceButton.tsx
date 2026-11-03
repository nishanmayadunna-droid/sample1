"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { waiveAdvanceAction } from "./actions";

/** Lets this customer skip the advance: the order becomes plain cash on delivery. */
export default function WaiveAdvanceButton({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function waive() {
    if (!window.confirm("Waive the advance? The customer will pay the whole total on delivery.")) return;
    startTransition(async () => {
      const result = await waiveAdvanceAction(orderId);
      setError(result.error);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={waive}
        className="rounded-md border border-line px-3 py-1.5 font-mono text-[0.7rem] uppercase tracking-[0.14em] text-muted hover:border-ink hover:text-ink disabled:opacity-40"
      >
        Waive advance
      </button>
      {error && <span className="text-sm text-blaze">{error}</span>}
    </div>
  );
}
