"use client";

import { useActionState, useState } from "react";
import { isDeleteConfirmed } from "@/lib/product-form";
import { deletePromotionAction, type DeletePromotionState } from "./actions";

const initialState: DeletePromotionState = { error: null };

/** Danger zone: a promotion is deleted (with its rules and banner image) after typing its slug. */
export default function DeletePromotion({ id, slug, name }: { id: string; slug: string; name: string }) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [state, submit, pending] = useActionState(deletePromotionAction.bind(null, id), initialState);
  const confirmed = isDeleteConfirmed(slug, typed);

  return (
    <section className="mt-16 max-w-2xl rounded-lg border border-blaze p-6">
      <p className="eyebrow text-blaze">Danger zone</p>
      {!open ? (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-4">
          <p className="text-sm text-muted">To pause a promotion, untick Active instead.</p>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="rounded-full border border-blaze px-5 py-2 text-sm font-medium text-blaze transition-colors hover:bg-blaze hover:text-onaccent"
          >
            Delete promotion
          </button>
        </div>
      ) : (
        <form action={submit} className="mt-3">
          <p className="text-sm">
            This permanently deletes <strong>{name}</strong>, its rules and its banner image. Type{" "}
            <code className="font-mono">{slug}</code> to confirm.
          </p>
          <input
            name="confirm"
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            autoComplete="off"
            aria-label="Type the promotion slug to confirm"
            className="mt-3 w-full rounded-md border border-line bg-bg px-4 py-3 font-mono outline-none focus:border-ink"
          />
          {state.error && <p className="mt-2 text-sm text-blaze">{state.error}</p>}
          <div className="mt-4 flex gap-3">
            <button
              type="submit"
              disabled={!confirmed || pending}
              className="rounded-full bg-blaze px-5 py-2 text-sm font-medium text-onaccent disabled:opacity-40"
            >
              {pending ? "Deleting…" : "Delete forever"}
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setTyped("");
              }}
              className="rounded-full border border-line px-5 py-2 text-sm font-medium hover:border-ink"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
