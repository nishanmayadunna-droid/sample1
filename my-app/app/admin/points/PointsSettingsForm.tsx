"use client";

import { useActionState, useState, useTransition } from "react";
import { pointsToEarn, type PointsSettings } from "@/lib/points";
import { formatPrice } from "@/lib/products";
import { savePointsSettingsAction, type PointsSettingsState } from "./actions";

const initialState: PointsSettingsState = { errors: {}, saved: false };
const rupees = (cents: number) => (cents / 100).toFixed(2).replace(/\.00$/, "");
const inputClass = "mt-2 w-full rounded-md border border-line bg-bg px-4 py-3 outline-none focus:border-ink";

function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="mt-5 block">
      <span className="eyebrow text-muted">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-sm text-muted">{hint}</span>}
      {error && <span className="mt-1 block text-sm text-blaze">{error}</span>}
    </label>
  );
}

export default function PointsSettingsForm({ settings }: { settings: PointsSettings }) {
  const [state, submit, pending] = useActionState(savePointsSettingsAction, initialState);
  const [, startTransition] = useTransition();
  const [enabled, setEnabled] = useState(settings.enabled);
  const [earnPer, setEarnPer] = useState(rupees(settings.earnPer));
  const [pointValue, setPointValue] = useState(rupees(settings.pointValue));
  const [maxPercent, setMaxPercent] = useState(String(settings.maxPercent));
  const [sample, setSample] = useState("10000");
  const errors = state.errors;

  // A live example with the numbers as typed; the server validates them on save.
  const cents = (value: string) => Math.round(Number(value) * 100) || 0;
  const live: PointsSettings = {
    enabled: true,
    earnPer: cents(earnPer),
    pointValue: cents(pointValue),
    maxPercent: Number(maxPercent) || 0,
  };
  const earned = pointsToEarn(cents(sample), live);

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
          onChange={(event) => setEnabled(event.target.checked)}
          className="mt-1"
        />
        <span>
          Points are on
          <span className="block text-sm text-muted">
            When off, customers earn nothing new and can&apos;t spend points; balances are kept.
          </span>
        </span>
      </label>

      <div className="grid gap-x-4 sm:grid-cols-2">
        <Field label="Goods value that earns 1 point (Rs)" hint="Earned when the order is delivered." error={errors.earnPer}>
          <input name="earnPer" inputMode="decimal" value={earnPer} onChange={(e) => setEarnPer(e.target.value)} className={inputClass} />
        </Field>
        <Field label="What 1 point is worth (Rs)" hint="The discount one point gives at checkout." error={errors.pointValue}>
          <input name="pointValue" inputMode="decimal" value={pointValue} onChange={(e) => setPointValue(e.target.value)} className={inputClass} />
        </Field>
        <Field label="Most of an order points may pay (%)" hint="Of the goods after promotions; never shipping." error={errors.maxPercent}>
          <input name="maxPercent" inputMode="numeric" value={maxPercent} onChange={(e) => setMaxPercent(e.target.value)} className={inputClass} />
        </Field>
      </div>

      <div className="mt-5 rounded-md border border-line px-4 py-3 text-sm">
        <label>
          Example: an order of Rs{" "}
          <input
            inputMode="decimal"
            value={sample}
            onChange={(e) => setSample(e.target.value)}
            aria-label="Sample order goods value in rupees"
            className="w-28 rounded border border-line bg-bg px-2 py-1 font-mono"
          />
        </label>{" "}
        earns <span className="font-mono text-blaze">{earned}</span> points, worth{" "}
        <span className="font-mono text-blaze">{formatPrice(earned * live.pointValue)}</span> back (
        <span className="font-mono">
          {cents(sample) > 0 ? ((earned * live.pointValue * 100) / cents(sample)).toFixed(1) : "0.0"}%
        </span>
        ).
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
