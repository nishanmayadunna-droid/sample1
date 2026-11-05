"use client";

import Link from "next/link";
import { useActionState, useTransition } from "react";
import type { ShippingSettingsState } from "./actions";

const initialState: ShippingSettingsState = { errors: {}, saved: false };

const rupees = (cents: number) => (cents / 100).toFixed(2).replace(/\.00$/, "");

export default function ShippingForm({
  action,
  shippingFee,
}: {
  action: (prev: ShippingSettingsState, formData: FormData) => Promise<ShippingSettingsState>;
  shippingFee: number;
}) {
  const [state, submit, pending] = useActionState(action, initialState);
  const [, startTransition] = useTransition();

  return (
    <form
      // onSubmit rather than `action={submit}`: React 19 resets a form after
      // every form action, which would wipe the input on a validation error.
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        startTransition(() => submit(formData));
      }}
      className="max-w-2xl"
    >
      <label className="mt-5 block">
        <span className="eyebrow text-muted">Shipping fee (Rs)</span>
        <input
          name="shippingFee"
          inputMode="decimal"
          defaultValue={rupees(shippingFee)}
          className="mt-2 w-48 rounded-md border border-line bg-bg px-4 py-3 outline-none focus:border-ink"
        />
        {state.errors.shippingFee && (
          <span className="mt-1 block text-sm text-blaze">{state.errors.shippingFee}</span>
        )}
      </label>
      <p className="mt-2 max-w-prose text-sm text-muted">
        Charged on every order unless a running promotion gives free shipping (see Promotions). This
        fee only applies to districts that are in no zone; set per-district fees on the{" "}
        <Link href="/admin/shipping" className="text-blaze underline underline-offset-4">
          Shipping zones page
        </Link>
        .
      </p>
      {state.errors.form && <p className="mt-4 text-sm text-blaze">{state.errors.form}</p>}
      {state.saved && !pending && (
        <p role="status" className="mt-4 text-sm text-muted">
          Saved. The shop shows the change within a minute.
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="mt-6 rounded-full bg-blaze px-6 py-3 font-medium text-white transition-transform hover:-translate-y-0.5 disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save"}
      </button>
    </form>
  );
}
