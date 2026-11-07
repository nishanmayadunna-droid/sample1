"use client";

import { useActionState, useState } from "react";
import { isDeleteConfirmed } from "@/lib/product-form";
import { deleteProductAction, type DeleteProductState } from "./actions";

const initialState: DeleteProductState = { error: null };

/** Danger zone on the edit page: hard delete behind a type-the-id confirmation. */
export default function DeleteProduct({ id, name }: { id: string; name: string }) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [state, submit, pending] = useActionState(
    deleteProductAction.bind(null, id),
    initialState,
  );
  const confirmed = isDeleteConfirmed(id, typed);

  return (
    <section className="mt-16 max-w-2xl rounded-lg border border-blaze p-6">
      <p className="eyebrow text-blaze">Danger zone</p>
      {!open ? (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-4">
          <p className="text-sm text-muted">
            Unpublishing hides a product and can be undone. Deleting cannot.
          </p>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="rounded-full border border-blaze px-5 py-2 text-sm font-medium text-blaze transition-colors hover:bg-blaze hover:text-onaccent"
          >
            Delete product
          </button>
        </div>
      ) : (
        <form action={submit} className="mt-3">
          <p className="text-sm">
            This permanently deletes <strong>{name}</strong> and its photo. Type{" "}
            <code className="font-mono">{id}</code> to confirm.
          </p>
          <input
            name="confirmation"
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            autoComplete="off"
            aria-label="Type the product ID to confirm"
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
