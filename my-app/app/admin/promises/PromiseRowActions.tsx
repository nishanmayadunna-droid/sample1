"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import type { StorePromise } from "@/lib/storefront-form";
import {
  deletePromiseAction,
  movePromiseAction,
  setPromiseVisibleAction,
  type PromiseRowState,
} from "./actions";

const buttonClass =
  "rounded-md border border-line px-2.5 py-1 font-mono text-[0.7rem] uppercase tracking-[0.14em] text-muted hover:border-ink hover:text-ink disabled:opacity-40";

/** Show/hide, reorder, edit and delete for one row of /admin/promises. */
export default function PromiseRowActions({
  promise,
  isFirst,
  isLast,
}: {
  promise: StorePromise;
  isFirst: boolean;
  isLast: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(action: () => Promise<PromiseRowState>) {
    startTransition(async () => {
      const result = await action();
      setError(result.error);
    });
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap justify-end gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => setPromiseVisibleAction(promise.id, !promise.visible))}
          className={buttonClass}
        >
          {promise.visible ? "Hide" : "Show"}
        </button>
        <button
          type="button"
          disabled={pending || isFirst}
          onClick={() => run(() => movePromiseAction(promise.id, "up"))}
          aria-label="Move up"
          className={buttonClass}
        >
          ▲
        </button>
        <button
          type="button"
          disabled={pending || isLast}
          onClick={() => run(() => movePromiseAction(promise.id, "down"))}
          aria-label="Move down"
          className={buttonClass}
        >
          ▼
        </button>
        <Link href={`/admin/promises/${promise.id}`} className={buttonClass}>
          Edit
        </Link>
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            if (window.confirm("Delete this promise? This can't be undone.")) {
              run(() => deletePromiseAction(promise.id));
            }
          }}
          className={`${buttonClass} hover:border-blaze hover:text-blaze`}
        >
          Delete
        </button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-blaze">
          {error}
        </p>
      )}
    </div>
  );
}
