"use client";

import { useTransition } from "react";
import { setPublishedAction } from "./products/actions";

export default function PublishToggle({
  id,
  published,
}: {
  id: string;
  published: boolean;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => setPublishedAction(id, !published))}
      className="rounded-full border border-line px-4 py-2 font-mono text-[0.65rem] uppercase tracking-[0.16em] transition-colors hover:border-ink disabled:opacity-50"
    >
      {published ? "Unpublish" : "Publish"}
    </button>
  );
}
