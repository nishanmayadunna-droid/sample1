"use client";

import { useActionState, useState } from "react";
import { isDeleteConfirmed } from "@/lib/product-form";
import { deleteCategoryAction, type DeleteCategoryState } from "./actions";

const initialState: DeleteCategoryState = { error: null };

/** Danger zone: an empty category can be deleted after typing its slug. */
export default function DeleteCategory({
  slug,
  name,
  productCount,
}: {
  slug: string;
  name: string;
  productCount: number;
}) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [state, submit, pending] = useActionState(
    deleteCategoryAction.bind(null, slug),
    initialState,
  );
  const confirmed = isDeleteConfirmed(slug, typed);
  const blocked = productCount > 0;

  return (
    <section className="mt-16 max-w-2xl rounded-lg border border-blaze p-6">
      <p className="eyebrow text-blaze">Danger zone</p>
      {blocked ? (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-4">
          <p className="text-sm text-muted">
            This category has {productCount} {productCount === 1 ? "product" : "products"}. Move
            or delete them first.
          </p>
          <button
            type="button"
            disabled
            className="rounded-full border border-line px-5 py-2 text-sm font-medium text-muted opacity-60"
          >
            Delete category
          </button>
        </div>
      ) : !open ? (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-4">
          <p className="text-sm text-muted">This category has no products.</p>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="rounded-full border border-blaze px-5 py-2 text-sm font-medium text-blaze transition-colors hover:bg-blaze hover:text-white"
          >
            Delete category
          </button>
        </div>
      ) : (
        <form action={submit} className="mt-3">
          <p className="text-sm">
            This permanently deletes the <strong>{name}</strong> category. Type{" "}
            <code className="font-mono">{slug}</code> to confirm.
          </p>
          <input
            name="confirmation"
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            autoComplete="off"
            aria-label="Type the category slug to confirm"
            className="mt-3 w-full rounded-md border border-line bg-bg px-4 py-3 font-mono outline-none focus:border-ink"
          />
          {state.error && <p className="mt-2 text-sm text-blaze">{state.error}</p>}
          <div className="mt-4 flex gap-3">
            <button
              type="submit"
              disabled={!confirmed || pending}
              className="rounded-full bg-blaze px-5 py-2 text-sm font-medium text-white disabled:opacity-40"
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
