"use client";

import { useActionState, useState, useTransition } from "react";
import type { EmailSettings } from "@/lib/email";
import { saveEmailSettingsAction, type EmailSettingsState } from "./actions";

const initialState: EmailSettingsState = { errors: {}, saved: false };

export default function EmailSettingsForm({ settings }: { settings: EmailSettings }) {
  const [state, submit, pending] = useActionState(saveEmailSettingsAction, initialState);
  const [, startTransition] = useTransition();
  const [enabled, setEnabled] = useState(settings.enabled);
  const [orderEmails, setOrderEmails] = useState(settings.orderEmails);
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
          Send emails
          <span className="block text-sm text-muted">
            Off by default. While off, nothing is sent: password reset and confirmation links are not available and the
            newsletter form says sign-ups are not open yet.
          </span>
        </span>
      </label>
      {errors.enabled && <span className="mt-1 block text-sm text-blaze">{errors.enabled}</span>}

      <label className="mt-5 flex items-start gap-3">
        <input
          type="checkbox"
          name="orderEmails"
          checked={orderEmails}
          onChange={(e) => setOrderEmails(e.target.checked)}
          className="mt-1"
        />
        <span>
          Email customers about their orders
          <span className="block text-sm text-muted">The same updates as the SMS, to customers who have an email address.</span>
        </span>
      </label>

      {errors.form && <p className="mt-4 text-sm text-blaze">{errors.form}</p>}
      {state.saved && !pending && (
        <p role="status" className="mt-4 text-sm text-muted">
          Saved.
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
