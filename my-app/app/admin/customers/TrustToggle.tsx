"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setTrustedAction } from "./actions";

const buttonClass =
  "rounded-md border border-line px-3 py-1.5 font-mono text-[0.7rem] uppercase tracking-[0.14em] text-muted hover:border-ink hover:text-ink disabled:opacity-40";

/** Trust a customer (plain COD, no advance) or take that away again. */
export default function TrustToggle({ userId, trusted }: { userId: string; trusted: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggle() {
    if (trusted && !window.confirm("Remove trust? This customer must pay an advance on their next order.")) return;
    startTransition(async () => {
      const result = await setTrustedAction(userId, !trusted);
      setError(result.error);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button type="button" disabled={pending} onClick={toggle} className={buttonClass}>
        {trusted ? "Remove trust" : "Trust"}
      </button>
      {error && <span className="text-sm text-blaze">{error}</span>}
    </div>
  );
}
