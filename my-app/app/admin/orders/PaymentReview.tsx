"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { reviewSlipAction } from "./actions";

const buttonClass =
  "rounded-md border border-line px-2.5 py-1 font-mono text-[0.7rem] uppercase tracking-[0.14em] text-muted hover:border-ink hover:text-ink disabled:opacity-40";

/** Approve or reject one pending slip. Rejecting asks for a short reason the customer sees. */
export default function PaymentReview({ slipId }: { slipId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function review(approve: boolean) {
    let reason = "";
    if (approve) {
      if (!window.confirm("Approve this slip? The advance is marked paid and the customer becomes trusted.")) return;
    } else {
      const answer = window.prompt("Why is this slip rejected? (the customer sees this, up to 200 characters)");
      if (answer === null) return;
      reason = answer;
    }
    startTransition(async () => {
      const result = await reviewSlipAction(slipId, approve, reason);
      setError(result.error);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-2">
        <button type="button" disabled={pending} onClick={() => review(true)} className={buttonClass}>
          Approve
        </button>
        <button type="button" disabled={pending} onClick={() => review(false)} className={buttonClass}>
          Reject
        </button>
      </div>
      {error && <span className="text-sm text-blaze">{error}</span>}
    </div>
  );
}
