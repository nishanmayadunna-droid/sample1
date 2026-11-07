"use client";

import { useActionState, useState, useTransition } from "react";
import type { PayhereSettings } from "@/lib/payhere";
import { savePayhereSettingsAction, type PayhereSettingsState } from "./actions";

const initialState: PayhereSettingsState = { errors: {}, saved: false };
const inputClass = "mt-2 w-full rounded-md border border-line bg-bg px-4 py-3 outline-none focus:border-ink";

export default function PayhereSettingsForm({ settings }: { settings: PayhereSettings }) {
  const [state, submit, pending] = useActionState(savePayhereSettingsAction, initialState);
  const [, startTransition] = useTransition();
  const [enabled, setEnabled] = useState(settings.enabled);
  const [sandbox, setSandbox] = useState(settings.sandbox);
  const errors = state.errors;

  return (
    <form
      // onSubmit rather than `action={submit}`: React 19 resets a form after
      // every form action, which would wipe the inputs on a validation error.
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        startTransition(() => submit(formData));
      }}
      className="max-w-2xl"
    >
      <label className="flex items-start gap-3">
        <input type="checkbox" name="enabled" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="mt-1" />
        <span>
          Offer online card payment
          <span className="block text-sm text-muted">Off by default. Customers see a Pay online button on their order page.</span>
        </span>
      </label>
      {errors.enabled && <span className="mt-1 block text-sm text-blaze">{errors.enabled}</span>}

      <label className="mt-5 flex items-start gap-3">
        <input type="checkbox" name="sandbox" checked={sandbox} onChange={(e) => setSandbox(e.target.checked)} className="mt-1" />
        <span>
          Sandbox (test money)
          <span className="block text-sm text-muted">
            Keep this on until PayHere has approved your live account. Untick it to take real payments; the keys must be
            the live ones then.
          </span>
        </span>
      </label>

      <div className="mt-5 grid gap-x-4 sm:grid-cols-2">
        <label className="block">
          <span className="eyebrow text-muted">Discount for paying online (%)</span>
          <input name="discountPercent" inputMode="numeric" defaultValue={settings.discountPercent} className={inputClass} />
          <span className="mt-1 block text-sm text-muted">Off the goods (after promotions and points), never shipping. 0 = none.</span>
          {errors.discountPercent && <span className="mt-1 block text-sm text-blaze">{errors.discountPercent}</span>}
        </label>
      </div>
      <div className="mt-5 grid gap-x-4 sm:grid-cols-2">
        <label className="block">
          <span className="eyebrow text-muted">Gift for paying online (Sinhala, optional)</span>
          <input name="giftSi" maxLength={120} defaultValue={settings.giftSi} className={inputClass} />
          {errors.giftSi && <span className="mt-1 block text-sm text-blaze">{errors.giftSi}</span>}
        </label>
        <label className="block">
          <span className="eyebrow text-muted">Gift for paying online (English, optional)</span>
          <input name="giftEn" maxLength={120} defaultValue={settings.giftEn} className={inputClass} />
          <span className="mt-1 block text-sm text-muted">The English text is the one kept on each paid order.</span>
          {errors.giftEn && <span className="mt-1 block text-sm text-blaze">{errors.giftEn}</span>}
        </label>
      </div>

      {errors.form && <p className="mt-4 text-sm text-blaze">{errors.form}</p>}
      {state.saved && !pending && (
        <p role="status" className="mt-4 text-sm text-muted">
          Saved.
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="mt-6 rounded-full bg-blaze px-6 py-3 font-medium text-onaccent transition-transform hover:-translate-y-0.5 disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save"}
      </button>
    </form>
  );
}
