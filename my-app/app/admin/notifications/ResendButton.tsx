"use client";

import { useState, useTransition } from "react";
import { resendNotificationAction } from "./actions";

export default function ResendButton({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <span>
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            try {
              const result = await resendNotificationAction(id);
              setError(result.error);
            } catch {
              setError("Something went wrong, please try again.");
            }
          });
        }}
        className="rounded-full border border-line px-3 py-1 font-mono text-[0.7rem] uppercase tracking-[0.12em] hover:border-ink disabled:opacity-60"
      >
        {pending ? "Sending…" : "Resend"}
      </button>
      {error && (
        <span role="alert" className="mt-1 block text-sm text-blaze">
          {error}
        </span>
      )}
    </span>
  );
}
