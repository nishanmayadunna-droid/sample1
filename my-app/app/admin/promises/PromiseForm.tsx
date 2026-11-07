"use client";

import { useActionState, useTransition } from "react";
import PromiseIcon from "@/app/components/PromiseIcon";
import {
  PROMISE_ICONS,
  PROMISE_TEXT_MAX,
  type PromiseFieldName,
  type StorePromise,
} from "@/lib/storefront-form";
import type { PromiseFormState } from "./actions";

const initialState: PromiseFormState = { errors: {} };

const inputClass =
  "mt-2 w-full rounded-md border border-line bg-bg px-4 py-3 outline-none focus:border-ink";

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="mt-5 block">
      <span className="eyebrow text-muted">{label}</span>
      {children}
      {error && <span className="mt-1 block text-sm text-blaze">{error}</span>}
    </label>
  );
}

export default function PromiseForm({
  action,
  promise,
}: {
  action: (prev: PromiseFormState, formData: FormData) => Promise<PromiseFormState>;
  promise?: StorePromise;
}) {
  const [state, submit, pending] = useActionState(action, initialState);
  const [, startTransition] = useTransition();
  const errors: Partial<Record<PromiseFieldName, string>> = state.errors;

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
      <fieldset className="mt-5">
        <legend className="eyebrow text-muted">Icon</legend>
        <div className="mt-3 flex flex-wrap gap-3">
          {PROMISE_ICONS.map((icon) => (
            <label
              key={icon}
              className="flex cursor-pointer items-center gap-2 rounded-md border border-line px-3 py-2 has-[:checked]:border-blaze"
            >
              <input
                type="radio"
                name="icon"
                value={icon}
                defaultChecked={(promise?.icon ?? "box") === icon}
                className="sr-only"
              />
              <PromiseIcon icon={icon} className="h-5 w-5" />
              <span className="font-mono text-xs">{icon}</span>
            </label>
          ))}
        </div>
        {errors.icon && <span className="mt-1 block text-sm text-blaze">{errors.icon}</span>}
      </fieldset>

      <Field label="Text — සිංහල" error={errors.textSi}>
        <input
          name="textSi"
          defaultValue={promise?.textSi}
          maxLength={PROMISE_TEXT_MAX}
          className={inputClass}
        />
      </Field>

      <Field label="Text — English" error={errors.textEn}>
        <input
          name="textEn"
          defaultValue={promise?.textEn}
          maxLength={PROMISE_TEXT_MAX}
          className={inputClass}
        />
      </Field>

      <label className="mt-6 flex items-center gap-3">
        <input type="checkbox" name="visible" defaultChecked={promise?.visible ?? true} />
        Show in the shop
      </label>

      {errors.form && <p className="mt-4 text-sm text-blaze">{errors.form}</p>}
      <button
        type="submit"
        disabled={pending}
        className="mt-6 rounded-full bg-blaze px-6 py-3 font-medium text-onaccent transition-transform hover:-translate-y-0.5 disabled:opacity-60"
      >
        {pending ? "Saving…" : promise ? "Save changes" : "Add promise"}
      </button>
    </form>
  );
}
