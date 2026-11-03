"use client";

import { useState, useTransition } from "react";
import type { ReviewStatus } from "@/lib/admin-reviews";
import { deleteReviewAction, setReviewStatusAction, type ReviewRowState } from "./actions";

const buttonClass =
  "rounded-md border border-line px-2.5 py-1 font-mono text-[0.7rem] uppercase tracking-[0.14em] text-muted hover:border-ink hover:text-ink disabled:opacity-40";

/** Approve, reject and delete for one row of /admin/reviews. */
export default function ReviewRowActions({ id, status }: { id: string; status: ReviewStatus }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(action: () => Promise<ReviewRowState>) {
    startTransition(async () => {
      const result = await action();
      setError(result.error);
    });
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap justify-end gap-2">
        {status !== "approved" && (
          <button type="button" disabled={pending} onClick={() => run(() => setReviewStatusAction(id, "approved"))} className={buttonClass}>
            Approve
          </button>
        )}
        {status !== "rejected" && (
          <button type="button" disabled={pending} onClick={() => run(() => setReviewStatusAction(id, "rejected"))} className={buttonClass}>
            Reject
          </button>
        )}
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            if (window.confirm("Delete this review permanently?")) run(() => deleteReviewAction(id));
          }}
          className={buttonClass}
        >
          Delete
        </button>
      </div>
      {error && <span className="text-sm text-blaze">{error}</span>}
    </div>
  );
}
