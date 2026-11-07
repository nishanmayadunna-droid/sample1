"use client";

import { useActionState, useState, useTransition } from "react";
import { advanceFor, type AdvanceMode } from "@/lib/advance";
import type { PaymentSettings } from "@/lib/payments-data";
import { formatPrice } from "@/lib/products";
import { savePaymentSettingsAction, type PaymentSettingsState } from "./actions";

const initialState: PaymentSettingsState = { errors: {}, saved: false };
const rupees = (cents: number) => (cents / 100).toFixed(2).replace(/\.00$/, "");
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

const MODES: { value: AdvanceMode; label: string; hint: string }[] = [
  { value: "off", label: "Off", hint: "Everyone orders with plain cash on delivery." },
  { value: "fixed", label: "Fixed amount", hint: "New customers pay the same advance on every order." },
  { value: "percent", label: "Percentage", hint: "A share of the order total, between a minimum and a maximum." },
];

export default function PaymentSettingsForm({ settings }: { settings: PaymentSettings }) {
  const [state, submit, pending] = useActionState(savePaymentSettingsAction, initialState);
  const [, startTransition] = useTransition();
  const [mode, setMode] = useState<AdvanceMode>(settings.mode);
  const [fixed, setFixed] = useState(rupees(settings.fixed));
  const [percent, setPercent] = useState(String(settings.percent));
  const [min, setMin] = useState(rupees(settings.min));
  const [max, setMax] = useState(rupees(settings.max));
  const [expiryHours, setExpiryHours] = useState(String(settings.expiryHours));
  const [sample, setSample] = useState("10000");
  const errors = state.errors;

  // A live preview with the numbers as typed; the server validates them on save.
  const toCents = (value: string) => Math.round(Number(value) * 100);
  const preview = advanceFor(toCents(sample) || 0, {
    mode,
    fixed: toCents(fixed) || 0,
    percent: Number(percent) || 0,
    min: toCents(min) || 0,
    max: toCents(max) || 0,
  });

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
      <fieldset>
        <legend className="eyebrow text-muted">Advance for customers who aren&apos;t trusted yet</legend>
        <div className="mt-3 flex flex-col gap-2">
          {MODES.map((option) => (
            <label key={option.value} className="flex items-start gap-3">
              <input
                type="radio"
                name="mode"
                value={option.value}
                checked={mode === option.value}
                onChange={() => setMode(option.value)}
                className="mt-1"
              />
              <span>
                {option.label}
                <span className="block text-sm text-muted">{option.hint}</span>
              </span>
            </label>
          ))}
        </div>
        {errors.mode && <span className="mt-1 block text-sm text-blaze">{errors.mode}</span>}
      </fieldset>

      <div className="grid gap-x-4 sm:grid-cols-2">
        <Field label="Fixed advance (Rs)" error={errors.fixed}>
          <input name="fixed" inputMode="decimal" value={fixed} onChange={(e) => setFixed(e.target.value)} className={inputClass} />
        </Field>
        <Field label="Percentage (1–100)" error={errors.percent}>
          <input name="percent" inputMode="numeric" value={percent} onChange={(e) => setPercent(e.target.value)} className={inputClass} />
        </Field>
        <Field label="Percentage mode: minimum (Rs)" error={errors.min}>
          <input name="min" inputMode="decimal" value={min} onChange={(e) => setMin(e.target.value)} className={inputClass} />
        </Field>
        <Field label="Percentage mode: maximum (Rs)" error={errors.max}>
          <input name="max" inputMode="decimal" value={max} onChange={(e) => setMax(e.target.value)} className={inputClass} />
        </Field>
      </div>

      <Field label="Cancel orders whose advance hasn't arrived after (hours, 0 = never)" error={errors.expiryHours}>
        <input
          name="expiryHours"
          inputMode="numeric"
          value={expiryHours}
          onChange={(e) => setExpiryHours(e.target.value)}
          className={`${inputClass} sm:w-48`}
        />
      </Field>
      <p className="mt-2 max-w-prose text-sm text-muted">
        Only a pending order with no slip waiting for review is cancelled (its stock and any points used come back). A
        rejected slip gives the customer a fresh window. The cancelling runs on a schedule if you turned it on, or when
        you press &quot;Cancel stale now&quot; on the Orders page.
      </p>

      <div className="mt-5 rounded-md border border-line px-4 py-3 text-sm">
        <label>
          Preview: for an order of Rs{" "}
          <input
            inputMode="decimal"
            value={sample}
            onChange={(e) => setSample(e.target.value)}
            aria-label="Sample order total in rupees"
            className="w-28 rounded border border-line bg-bg px-2 py-1 font-mono"
          />
        </label>{" "}
        the advance is <span className="font-mono text-blaze">{mode === "off" ? "none" : formatPrice(preview)}</span>.
      </div>

      <h3 className="display mt-10 text-xl">Bank details</h3>
      <p className="mt-1 max-w-prose text-sm text-muted">
        Shown to customers on their order page, only when they owe an advance. A bank name, account name and account
        number are needed before the advance can be switched on for customers.
      </p>
      <div className="grid gap-x-4 sm:grid-cols-2">
        <Field label="Bank" error={errors.bankName}>
          <input name="bankName" defaultValue={settings.bankName} className={inputClass} />
        </Field>
        <Field label="Account name" error={errors.accountName}>
          <input name="accountName" defaultValue={settings.accountName} className={inputClass} />
        </Field>
        <Field label="Account number" error={errors.accountNumber}>
          <input name="accountNumber" defaultValue={settings.accountNumber} className={inputClass} />
        </Field>
        <Field label="Branch" error={errors.branch}>
          <input name="branch" defaultValue={settings.branch} className={inputClass} />
        </Field>
      </div>
      <Field label="Note to customers (optional)" error={errors.note}>
        <textarea name="note" rows={3} defaultValue={settings.note} className={inputClass} />
      </Field>

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
