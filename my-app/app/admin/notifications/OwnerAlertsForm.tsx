"use client";

import { useActionState, useState, useTransition } from "react";
import { OWNER_ALERT_EVENTS, OWNER_EVENT_LABELS, type OwnerAlertSettings } from "@/lib/owner-alerts";
import { saveOwnerAlertSettingsAction, type OwnerAlertSettingsState } from "./actions";

const initialState: OwnerAlertSettingsState = { errors: {}, saved: false };
const inputClass = "mt-2 w-full rounded-md border border-line bg-bg px-4 py-3 outline-none focus:border-ink";

/** The shop owner's own phone and which events text them. */
export default function OwnerAlertsForm({ settings }: { settings: OwnerAlertSettings }) {
  const [state, submit, pending] = useActionState(saveOwnerAlertSettingsAction, initialState);
  const [, startTransition] = useTransition();
  const [enabled, setEnabled] = useState(settings.enabled);
  const [events, setEvents] = useState(settings.events);
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
          Send alerts to my phone
          <span className="block text-sm text-muted">Off by default. While off, nothing is sent or logged.</span>
        </span>
      </label>
      {errors.enabled && <span className="mt-1 block text-sm text-blaze">{errors.enabled}</span>}

      <div className="mt-6 grid gap-x-4 sm:grid-cols-2">
        <label className="block">
          <span className="eyebrow text-muted">My mobile number</span>
          <input name="phone" inputMode="tel" defaultValue={settings.phone} placeholder="0771234567" className={inputClass} />
          {errors.phone && <span className="mt-1 block text-sm text-blaze">{errors.phone}</span>}
        </label>
        <label className="block">
          <span className="eyebrow text-muted">Low stock at (or below)</span>
          <input name="lowStockAt" inputMode="numeric" defaultValue={settings.lowStockAt} className={inputClass} />
          {errors.lowStockAt && <span className="mt-1 block text-sm text-blaze">{errors.lowStockAt}</span>}
        </label>
      </div>

      <div className="mt-6 space-y-3">
        {OWNER_ALERT_EVENTS.map((e) => (
          <label key={e} className="flex items-start gap-3">
            <input
              type="checkbox"
              name={`event_${e}`}
              checked={events[e]}
              onChange={(ev) => setEvents((prev) => ({ ...prev, [e]: ev.target.checked }))}
              className="mt-1"
            />
            <span>{OWNER_EVENT_LABELS[e]}</span>
          </label>
        ))}
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
        className="mt-6 rounded-full bg-blaze px-6 py-3 font-medium text-white transition-transform hover:-translate-y-0.5 disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save"}
      </button>
    </form>
  );
}
