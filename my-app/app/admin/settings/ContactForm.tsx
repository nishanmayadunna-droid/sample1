"use client";

import { useActionState, useTransition } from "react";
import type { StoreContact } from "@/lib/store-contact";
import type { ContactSettingsState } from "./actions";

const initialState: ContactSettingsState = { errors: {}, saved: false };

const inputClass =
  "mt-2 w-full rounded-md border border-line bg-bg px-4 py-3 outline-none focus:border-ink";

export default function ContactForm({
  action,
  contact,
}: {
  action: (prev: ContactSettingsState, formData: FormData) => Promise<ContactSettingsState>;
  contact: StoreContact;
}) {
  const [state, submit, pending] = useActionState(action, initialState);
  const [, startTransition] = useTransition();

  const field = (
    name: keyof StoreContact,
    label: string,
    opts: { multiline?: boolean; width?: string; inputMode?: "numeric" | "tel" | "email" } = {},
  ) => (
    <label className="mt-5 block">
      <span className="eyebrow text-muted">{label}</span>
      {opts.multiline ? (
        <textarea
          name={name}
          rows={3}
          defaultValue={String(contact[name])}
          className={inputClass}
        />
      ) : (
        <input
          name={name}
          inputMode={opts.inputMode}
          defaultValue={String(contact[name])}
          className={`${inputClass} ${opts.width ?? ""}`}
        />
      )}
      {state.errors[name] && <span className="mt-1 block text-sm text-blaze">{state.errors[name]}</span>}
    </label>
  );

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
      {field("businessName", "Business name")}
      {field("phone", "Phone", { inputMode: "tel", width: "sm:w-72" })}
      {field("whatsapp", "WhatsApp number", { inputMode: "tel", width: "sm:w-72" })}
      {field("email", "Email", { inputMode: "email" })}
      {field("address", "Address", { multiline: true })}
      {field("hours", "Opening hours")}
      {field("returnDays", "Return days (0 = no returns)", { inputMode: "numeric", width: "w-48" })}
      <p className="mt-2 max-w-prose text-sm text-muted">
        Shown on the Contact, Returns and Privacy pages. Empty fields are hidden. Use international
        numbers where you can (for example +94771234567).
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
