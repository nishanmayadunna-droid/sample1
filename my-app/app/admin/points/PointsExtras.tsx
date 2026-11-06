"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatPrice } from "@/lib/products";
import type { PointsBonus, PointsTier } from "@/lib/points-v2";
import {
  addBonusAction,
  addTierAction,
  deleteBonusAction,
  deleteTierAction,
  expirePointsAction,
  saveExpiryAction,
  setBonusActiveAction,
  type SimpleState,
} from "./extras-actions";

const initialState: SimpleState = { errors: {}, saved: false };
const inputClass = "mt-2 w-full rounded-md border border-line bg-bg px-4 py-3 outline-none focus:border-ink";
const smallButton =
  "rounded-md border border-line px-3 py-1.5 font-mono text-[0.7rem] uppercase tracking-[0.14em] text-muted hover:border-ink hover:text-ink disabled:opacity-40";
const primaryButton =
  "mt-4 rounded-full bg-blaze px-6 py-3 font-medium text-white transition-transform hover:-translate-y-0.5 disabled:opacity-60";
const colombo = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Colombo", dateStyle: "medium", timeStyle: "short" });

/** A form that posts to an action without React resetting the inputs on an error. */
function useAction(action: (prev: SimpleState, formData: FormData) => Promise<SimpleState>) {
  const [state, submit, pending] = useActionState(action, initialState);
  const [, startTransition] = useTransition();
  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => submit(formData));
  };
  return { state, pending, onSubmit };
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="eyebrow text-muted">{label}</span>
      {children}
      {error && <span className="mt-1 block text-sm text-blaze">{error}</span>}
    </label>
  );
}

/** A row button (toggle / delete) that refreshes the page when it finishes. */
function RowAction({
  label,
  run,
  confirm,
}: {
  label: string;
  run: () => Promise<{ error: string | null }>;
  confirm?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        disabled={pending}
        className={smallButton}
        onClick={() => {
          if (confirm && !window.confirm(confirm)) return;
          startTransition(async () => {
            const result = await run();
            setError(result.error);
            router.refresh();
          });
        }}
      >
        {label}
      </button>
      {error && <span className="text-xs text-blaze">{error}</span>}
    </span>
  );
}

export function ExpirySection({ days }: { days: number }) {
  const { state, pending, onSubmit } = useAction(saveExpiryAction);
  const router = useRouter();
  const [expiring, startTransition] = useTransition();
  const [result, setResult] = useState<string | null>(null);

  return (
    <div>
      <form onSubmit={onSubmit} className="max-w-xl">
        <Field label="Points expire after (days, 0 = never)" error={state.errors.days}>
          <input name="days" inputMode="numeric" defaultValue={days} className={inputClass} />
        </Field>
        {state.errors.form && <p className="mt-2 text-sm text-blaze">{state.errors.form}</p>}
        {state.saved && !pending && (
          <p role="status" className="mt-2 text-sm text-muted">
            Saved.
          </p>
        )}
        <button type="submit" disabled={pending} className={primaryButton}>
          {pending ? "Saving…" : "Save"}
        </button>
      </form>
      {days > 0 && (
        <div className="mt-4">
          <button
            type="button"
            disabled={expiring}
            className={smallButton}
            onClick={() => {
              if (!window.confirm("Expire all points older than the limit now? This cannot be undone.")) return;
              startTransition(async () => {
                const r = await expirePointsAction();
                setResult(r.error ?? `${r.customers} customer${r.customers === 1 ? "" : "s"} lost expired points.`);
                router.refresh();
              });
            }}
          >
            {expiring ? "Working…" : "Expire now"}
          </button>
          {result && (
            <p role="status" className="mt-2 text-sm text-muted">
              {result}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export function BonusSection({ bonuses }: { bonuses: PointsBonus[] }) {
  const { state, pending, onSubmit } = useAction(addBonusAction);
  // The page is dynamic, so "now" is fresh on every render of this admin view.
  const [now] = useState(() => Date.now());

  return (
    <div>
      {bonuses.length === 0 ? (
        <p className="text-sm text-muted">No bonus events yet.</p>
      ) : (
        <ul className="divide-y divide-line border-y border-line">
          {bonuses.map((bonus) => {
            const running = bonus.active && Date.parse(bonus.startsAt) <= now && now < Date.parse(bonus.endsAt);
            const over = now >= Date.parse(bonus.endsAt);
            return (
              <li key={bonus.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                <span>
                  {bonus.name} · +{bonus.bonusPercent}%
                  <span className="block font-mono text-xs text-muted">
                    {colombo.format(new Date(bonus.startsAt))} → {colombo.format(new Date(bonus.endsAt))}
                  </span>
                </span>
                <span className="flex items-center gap-2">
                  <span
                    className={`font-mono text-[0.7rem] uppercase tracking-[0.14em] ${running ? "text-blaze" : "text-muted"}`}
                  >
                    {running ? "running" : over ? "ended" : bonus.active ? "scheduled" : "off"}
                  </span>
                  {!over && (
                    <RowAction
                      label={bonus.active ? "Switch off" : "Switch on"}
                      run={() => setBonusActiveAction(bonus.id, !bonus.active)}
                    />
                  )}
                  <RowAction label="Delete" run={() => deleteBonusAction(bonus.id)} confirm="Delete this bonus event?" />
                </span>
              </li>
            );
          })}
        </ul>
      )}

      <form onSubmit={onSubmit} className="mt-6 max-w-xl">
        <div className="grid gap-x-4 gap-y-4 sm:grid-cols-2">
          <Field label="Name" error={state.errors.name}>
            <input name="name" maxLength={60} placeholder="Double points weekend" className={inputClass} />
          </Field>
          <Field label="Extra points (%)" error={state.errors.bonusPercent}>
            <input name="bonusPercent" inputMode="numeric" defaultValue="100" className={inputClass} />
          </Field>
          <Field label="Starts (Colombo time)" error={state.errors.startsAt}>
            <input type="datetime-local" name="startsAt" className={inputClass} />
          </Field>
          <Field label="Ends (Colombo time)" error={state.errors.endsAt}>
            <input type="datetime-local" name="endsAt" className={inputClass} />
          </Field>
        </div>
        {state.errors.form && <p className="mt-2 text-sm text-blaze">{state.errors.form}</p>}
        {state.saved && !pending && (
          <p role="status" className="mt-2 text-sm text-muted">
            Added.
          </p>
        )}
        <button type="submit" disabled={pending} className={primaryButton}>
          {pending ? "Adding…" : "Add bonus event"}
        </button>
      </form>
    </div>
  );
}

export function TierSection({ tiers }: { tiers: PointsTier[] }) {
  const { state, pending, onSubmit } = useAction(addTierAction);

  return (
    <div>
      {tiers.length === 0 ? (
        <p className="text-sm text-muted">No tiers yet. Everyone earns the normal rate.</p>
      ) : (
        <ul className="divide-y divide-line border-y border-line">
          {tiers.map((tier) => (
            <li key={tier.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
              <span>
                {tier.name} · from {formatPrice(tier.minSpend)} · +{tier.bonusPercent}%
              </span>
              <RowAction label="Delete" run={() => deleteTierAction(tier.id)} confirm={`Delete the ${tier.name} tier?`} />
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={onSubmit} className="mt-6 max-w-xl">
        <div className="grid gap-x-4 gap-y-4 sm:grid-cols-3">
          <Field label="Name" error={state.errors.name}>
            <input name="name" maxLength={30} placeholder="Gold" className={inputClass} />
          </Field>
          <Field label="Lifetime spend from (Rs)" error={state.errors.minSpend}>
            <input name="minSpend" inputMode="decimal" placeholder="50000" className={inputClass} />
          </Field>
          <Field label="Extra points (%)" error={state.errors.bonusPercent}>
            <input name="bonusPercent" inputMode="numeric" defaultValue="10" className={inputClass} />
          </Field>
        </div>
        {state.errors.form && <p className="mt-2 text-sm text-blaze">{state.errors.form}</p>}
        {state.saved && !pending && (
          <p role="status" className="mt-2 text-sm text-muted">
            Added.
          </p>
        )}
        <button type="submit" disabled={pending} className={primaryButton}>
          {pending ? "Adding…" : "Add tier"}
        </button>
      </form>
    </div>
  );
}
