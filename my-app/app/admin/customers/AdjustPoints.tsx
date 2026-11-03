"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { adjustPointsAction } from "./actions";

/** Adds or removes points for one customer, with a note that shows in their history. */
export default function AdjustPoints({ userId }: { userId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [points, setPoints] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const amount = Number(points);
    startTransition(async () => {
      const result = await adjustPointsAction(userId, amount, note);
      setError(result.error);
      if (!result.error) {
        setPoints("");
        setNote("");
      }
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col items-end gap-1">
      <div className="flex flex-wrap justify-end gap-2">
        <input
          value={points}
          onChange={(e) => setPoints(e.target.value)}
          inputMode="numeric"
          placeholder="+50 or -20"
          aria-label="Points to add or remove"
          className="w-28 rounded-md border border-line bg-bg px-2 py-1 font-mono text-sm"
        />
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={200}
          placeholder="Note (required)"
          aria-label="Note for this adjustment"
          className="w-44 rounded-md border border-line bg-bg px-2 py-1 text-sm"
        />
        <button
          type="submit"
          disabled={pending || points.trim() === "" || note.trim() === ""}
          className="rounded-md border border-line px-2.5 py-1 font-mono text-[0.7rem] uppercase tracking-[0.14em] text-muted hover:border-ink hover:text-ink disabled:opacity-40"
        >
          Adjust
        </button>
      </div>
      {error && <span className="text-sm text-blaze">{error}</span>}
    </form>
  );
}
