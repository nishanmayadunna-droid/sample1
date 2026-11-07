"use client";

import { useActionState, useState, useTransition } from "react";
import type { SmsSettings } from "@/lib/otp";
import { saveSmsSettingsAction, type SmsSettingsState } from "./actions";

const initialState: SmsSettingsState = { errors: {}, saved: false };
const inputClass = "mt-2 w-full rounded-md border border-line bg-bg px-4 py-3 outline-none focus:border-ink";

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="mt-5 block">
      <span className="eyebrow text-muted">{label}</span>
      {children}
      {error && <span className="mt-1 block text-sm text-blaze">{error}</span>}
    </label>
  );
}

export default function SmsSettingsForm({ settings }: { settings: SmsSettings }) {
  const [state, submit, pending] = useActionState(saveSmsSettingsAction, initialState);
  const [, startTransition] = useTransition();
  const [enabled, setEnabled] = useState(settings.enabled);
  const [senderId, setSenderId] = useState(settings.senderId);
  const [dailyCap, setDailyCap] = useState(String(settings.dailyCap));
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
        <input
          type="checkbox"
          name="enabled"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          className="mt-1"
        />
        <span>
          Phone sign-in with an SMS code
          <span className="block text-sm text-muted">Off by default. While off, customers can&apos;t sign in with a phone.</span>
        </span>
      </label>
      {errors.enabled && <span className="mt-1 block text-sm text-blaze">{errors.enabled}</span>}

      <div className="grid gap-x-4 sm:grid-cols-2">
        <Field label="Sender ID (3–11 letters or digits)" error={errors.senderId}>
          <input name="senderId" value={senderId} onChange={(e) => setSenderId(e.target.value)} className={inputClass} />
        </Field>
        <Field label="Daily limit (codes per day)" error={errors.dailyCap}>
          <input
            name="dailyCap"
            inputMode="numeric"
            value={dailyCap}
            onChange={(e) => setDailyCap(e.target.value)}
            className={inputClass}
          />
        </Field>
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
