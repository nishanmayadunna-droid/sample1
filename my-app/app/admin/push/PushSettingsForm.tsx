"use client";

import { useActionState, useState, useTransition } from "react";
import {
  CUSTOMER_EVENT_LABELS,
  OWNER_EVENT_LABELS,
  PUSH_CUSTOMER_EVENTS,
  PUSH_OWNER_EVENTS,
  type PushSettings,
} from "@/lib/push";
import { savePushSettingsAction, type PushSettingsState } from "./actions";

const initialState: PushSettingsState = { errors: {}, saved: false };

export default function PushSettingsForm({ settings }: { settings: PushSettings }) {
  const [state, submit, pending] = useActionState(savePushSettingsAction, initialState);
  const [, startTransition] = useTransition();
  const [enabled, setEnabled] = useState(settings.enabled);
  const [owner, setOwner] = useState(settings.owner);
  const [customer, setCustomer] = useState(settings.customer);
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
          Send push notifications
          <span className="block text-sm text-muted">
            Off by default. While off, nothing is sent and customers are not offered the button. Push is always in addition
            to SMS and email, never instead of them.
          </span>
        </span>
      </label>
      {errors.enabled && <span className="mt-1 block text-sm text-blaze">{errors.enabled}</span>}

      <fieldset className="mt-6">
        <legend className="eyebrow text-muted">To the shop owner&apos;s devices (admin accounts)</legend>
        <div className="mt-3 space-y-3">
          {PUSH_OWNER_EVENTS.map((e) => (
            <label key={e} className="flex items-start gap-3">
              <input
                type="checkbox"
                name={`owner_${e}`}
                checked={owner[e]}
                onChange={(ev) => setOwner((prev) => ({ ...prev, [e]: ev.target.checked }))}
                className="mt-1"
              />
              <span>{OWNER_EVENT_LABELS[e]}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="mt-6">
        <legend className="eyebrow text-muted">To a customer&apos;s own devices</legend>
        <div className="mt-3 space-y-3">
          {PUSH_CUSTOMER_EVENTS.map((e) => (
            <label key={e} className="flex items-start gap-3">
              <input
                type="checkbox"
                name={`customer_${e}`}
                checked={customer[e]}
                onChange={(ev) => setCustomer((prev) => ({ ...prev, [e]: ev.target.checked }))}
                className="mt-1"
              />
              <span>{CUSTOMER_EVENT_LABELS[e]}</span>
            </label>
          ))}
        </div>
      </fieldset>

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
