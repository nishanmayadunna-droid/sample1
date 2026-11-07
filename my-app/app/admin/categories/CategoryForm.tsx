"use client";

import { useActionState, useTransition } from "react";
import type { CategoryFieldName } from "@/lib/category-form";
import type { Category } from "@/lib/products";
import type { CategoryFormState } from "./actions";

const initialState: CategoryFormState = { errors: {} };

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

export default function CategoryForm({
  mode,
  action,
  category,
}: {
  mode: "create" | "update";
  action: (prev: CategoryFormState, formData: FormData) => Promise<CategoryFormState>;
  category?: Category;
}) {
  const [state, submit, pending] = useActionState(action, initialState);
  const [, startTransition] = useTransition();
  const errors: Partial<Record<CategoryFieldName | "form", string>> = state.errors;

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
      {mode === "create" ? (
        <Field label="Slug (used in URLs, can't be changed later)" error={errors.slug}>
          <input name="slug" placeholder="rain-gear" className={`${inputClass} font-mono`} required />
        </Field>
      ) : (
        <p className="mt-5 font-mono text-sm text-muted">Slug: {category?.slug}</p>
      )}

      <Field label="Name" error={errors.name}>
        <input
          name="name"
          defaultValue={category?.name}
          maxLength={40}
          className={inputClass}
          required
        />
      </Field>

      <div className="grid gap-x-4 sm:grid-cols-2">
        <Field label="Tile color 1" error={errors.swatchA}>
          <input
            type="color"
            name="swatchA"
            defaultValue={category?.swatch[0] ?? "#4d7c0f"}
            className="mt-2 h-12 w-full"
          />
        </Field>
        <Field label="Tile color 2" error={errors.swatchB}>
          <input
            type="color"
            name="swatchB"
            defaultValue={category?.swatch[1] ?? "#365314"}
            className="mt-2 h-12 w-full"
          />
        </Field>
      </div>

      <Field label="Sort order" error={errors.sortOrder}>
        <input
          name="sortOrder"
          inputMode="numeric"
          defaultValue={category?.sortOrder ?? 0}
          className={inputClass}
        />
      </Field>

      {errors.form && <p className="mt-6 text-sm text-blaze">{errors.form}</p>}
      <button
        type="submit"
        disabled={pending}
        className="mt-6 w-full rounded-full bg-blaze py-4 font-medium text-onaccent transition-transform hover:-translate-y-0.5 disabled:opacity-60"
      >
        {pending ? "Saving…" : mode === "create" ? "Create category" : "Save changes"}
      </button>
    </form>
  );
}
