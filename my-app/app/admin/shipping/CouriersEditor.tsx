"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Courier } from "@/lib/shipping-data";
import { deleteCourierAction, saveCourierAction, type CourierState } from "./actions";

const initialState: CourierState = { errors: {}, saved: false };
const inputClass = "mt-2 w-full rounded-md border border-line bg-bg px-4 py-3 outline-none focus:border-ink";
const buttonClass =
  "rounded-md border border-line px-2.5 py-1 font-mono text-[0.7rem] uppercase tracking-[0.14em] text-muted hover:border-ink hover:text-ink disabled:opacity-40";

/** One courier (or the blank "add" row when `courier` is undefined). */
function CourierForm({ courier }: { courier?: Courier }) {
  const router = useRouter();
  const [state, submit, pending] = useActionState(saveCourierAction, initialState);
  const [, startTransition] = useTransition();
  const [deleting, startDelete] = useTransition();
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const errors = state.errors;

  function remove() {
    if (!courier || !window.confirm(`Delete ${courier.name}? Past orders keep the name.`)) return;
    startDelete(async () => {
      const result = await deleteCourierAction(courier.id);
      setDeleteError(result.error);
      router.refresh();
    });
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const formData = new FormData(form);
        startTransition(async () => {
          await submit(formData);
          if (!courier) form.reset();
          router.refresh();
        });
      }}
      className="rounded-md border border-line p-4"
    >
      {courier && <input type="hidden" name="id" value={courier.id} />}
      <div className="grid gap-x-4 sm:grid-cols-2">
        <label className="block">
          <span className="eyebrow text-muted">{courier ? "Courier" : "New courier"}</span>
          <input name="name" defaultValue={courier?.name ?? ""} maxLength={40} className={inputClass} />
          {errors.name && <span className="mt-1 block text-sm text-blaze">{errors.name}</span>}
        </label>
        <label className="block">
          <span className="eyebrow text-muted">Tracking link (optional)</span>
          <input
            name="template"
            defaultValue={courier?.trackingUrlTemplate ?? ""}
            placeholder="https://…/{number}"
            maxLength={200}
            className={inputClass}
          />
          <span className="mt-1 block text-xs text-muted">Must start with https:// and contain {"{number}"}.</span>
          {errors.template && <span className="mt-1 block text-sm text-blaze">{errors.template}</span>}
        </label>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-4">
        {courier && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="active" defaultChecked={courier.active} />
            Active (offered on orders)
          </label>
        )}
        <button type="submit" disabled={pending} className={buttonClass}>
          {pending ? "Saving…" : courier ? "Save" : "Add courier"}
        </button>
        {courier && (
          <button type="button" disabled={deleting} onClick={remove} className={buttonClass}>
            Delete
          </button>
        )}
        {state.saved && !pending && (
          <span role="status" className="text-sm text-muted">
            Saved.
          </span>
        )}
      </div>
      {errors.form && <p className="mt-2 text-sm text-blaze">{errors.form}</p>}
      {deleteError && <p className="mt-2 text-sm text-blaze">{deleteError}</p>}
    </form>
  );
}

export default function CouriersEditor({ couriers }: { couriers: Courier[] }) {
  return (
    <div className="mt-4 flex max-w-3xl flex-col gap-3">
      {couriers.length === 0 && <p className="text-sm text-muted">No couriers yet.</p>}
      {couriers.map((courier) => (
        <CourierForm key={courier.id} courier={courier} />
      ))}
      <CourierForm />
    </div>
  );
}
