"use client";

import { useActionState, useState, useTransition } from "react";
import { NOTIFICATION_EVENTS, type NotificationSettings } from "@/lib/notifications";
import { saveNotificationSettingsAction, type NotificationSettingsState } from "./actions";
import { EVENT_LABELS } from "./labels";

const initialState: NotificationSettingsState = { errors: {}, saved: false };

export default function NotificationSettingsForm({ settings }: { settings: NotificationSettings }) {
  const [state, submit, pending] = useActionState(saveNotificationSettingsAction, initialState);
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
        <input
          type="checkbox"
          name="enabled"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          className="mt-1"
        />
        <span>
          Send order SMS messages
          <span className="block text-sm text-muted">Off by default. While off, nothing is sent (messages are only logged as skipped).</span>
        </span>
      </label>
      {errors.enabled && <span className="mt-1 block text-sm text-blaze">{errors.enabled}</span>}

      <div className="mt-6 space-y-3">
        {NOTIFICATION_EVENTS.map((e) => (
          <label key={e} className="flex items-start gap-3">
            <input
              type="checkbox"
              name={`event_${e}`}
              checked={events[e]}
              onChange={(ev) => setEvents((prev) => ({ ...prev, [e]: ev.target.checked }))}
              className="mt-1"
            />
            <span>{EVENT_LABELS[e]}</span>
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
