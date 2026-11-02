"use client";

import { useActionState, useTransition } from "react";
import type { LangSettings } from "@/lib/i18n";
import type { LanguageSettingsState } from "./actions";

const initialState: LanguageSettingsState = { errors: {}, saved: false };

export default function LanguageForm({
  action,
  settings,
}: {
  action: (prev: LanguageSettingsState, formData: FormData) => Promise<LanguageSettingsState>;
  settings: LangSettings;
}) {
  const [state, submit, pending] = useActionState(action, initialState);
  const [, startTransition] = useTransition();

  return (
    <form
      // onSubmit rather than `action={submit}`: React 19 resets a form after
      // every form action, which would undo the admin's choices on an error.
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        startTransition(() => submit(formData));
      }}
      className="max-w-2xl"
    >
      <fieldset className="mt-5">
        <legend className="eyebrow text-muted">Default language</legend>
        <div className="mt-3 flex gap-6">
          {(
            [
              ["si", "සිංහල"],
              ["en", "English"],
            ] as const
          ).map(([value, label]) => (
            <label key={value} className="flex items-center gap-2">
              <input
                type="radio"
                name="defaultLang"
                value={value}
                defaultChecked={settings.defaultLang === value}
              />
              {label}
            </label>
          ))}
        </div>
        {state.errors.defaultLang && (
          <span className="mt-1 block text-sm text-blaze">{state.errors.defaultLang}</span>
        )}
      </fieldset>

      <label className="mt-6 flex items-center gap-3">
        <input type="checkbox" name="bilingual" defaultChecked={settings.bilingual} />
        Show the language switcher (සිං / EN)
      </label>
      <p className="mt-2 max-w-prose text-sm text-muted">
        Visitors who already chose a language keep it while the switcher is on.
        Turning it off shows everyone the default language.
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
