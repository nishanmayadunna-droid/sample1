"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cancelStaleOrdersAction } from "./actions";

/** Runs the stale-advance cancel by hand (the same function the schedule runs). */
export default function CancelStaleButton({ staleCount }: { staleCount: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function run() {
    if (
      staleCount > 0 &&
      !window.confirm(`Cancel ${staleCount} stale ${staleCount === 1 ? "order" : "orders"}? Their stock and points go back.`)
    ) {
      return;
    }
    startTransition(async () => {
      const result = await cancelStaleOrdersAction();
      if (result.error) setMessage(result.error);
      else setMessage(result.cancelled === 0 ? "Nothing to cancel." : `Cancelled ${result.cancelled} ${result.cancelled === 1 ? "order" : "orders"}.`);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        disabled={pending}
        onClick={run}
        className="rounded-md border border-line px-3 py-1.5 font-mono text-[0.7rem] uppercase tracking-[0.14em] text-muted hover:border-ink hover:text-ink disabled:opacity-40"
      >
        Cancel stale now{staleCount > 0 ? ` (${staleCount})` : ""}
      </button>
      {message && (
        <span role="status" className="text-sm text-muted">
          {message}
        </span>
      )}
    </div>
  );
}
