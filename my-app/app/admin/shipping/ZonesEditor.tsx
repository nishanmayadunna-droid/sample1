"use client";

import { useActionState, useState, useTransition } from "react";
import { DISTRICTS } from "@/lib/shipping";
import { saveZonesAction, type ZonesState } from "./actions";

type ZoneDraft = { name: string; fee: string; districts: string[] };

const initialState: ZonesState = { errors: [], saved: false };
const inputClass = "mt-2 w-full rounded-md border border-line bg-bg px-4 py-3 outline-none focus:border-ink";
const buttonClass =
  "rounded-md border border-line px-2.5 py-1 font-mono text-[0.7rem] uppercase tracking-[0.14em] text-muted hover:border-ink hover:text-ink disabled:opacity-40";

/** Zones with a fee each; a district belongs to at most one zone (ticking it elsewhere moves it). */
export default function ZonesEditor({ zones: initial }: { zones: ZoneDraft[] }) {
  const [state, submit, pending] = useActionState(saveZonesAction, initialState);
  const [, startTransition] = useTransition();
  const [zones, setZones] = useState<ZoneDraft[]>(initial);

  const update = (index: number, patch: Partial<ZoneDraft>) =>
    setZones((current) => current.map((zone, i) => (i === index ? { ...zone, ...patch } : zone)));

  function toggle(index: number, district: string) {
    setZones((current) => {
      const ticking = !current[index].districts.includes(district);
      return current.map((zone, i) => {
        if (i === index) {
          return {
            ...zone,
            districts: ticking ? [...zone.districts, district] : zone.districts.filter((d) => d !== district),
          };
        }
        // Ticking it here takes it out of any other zone.
        return ticking ? { ...zone, districts: zone.districts.filter((d) => d !== district) } : zone;
      });
    });
  }

  return (
    <form
      // onSubmit rather than `action={submit}`: React 19 resets a form after
      // every form action, which would wipe the inputs on a validation error.
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData();
        formData.set("zones", JSON.stringify(zones));
        startTransition(() => submit(formData));
      }}
      className="max-w-3xl"
    >
      {zones.length === 0 && (
        <p className="mt-4 text-sm text-muted">No zones yet: every district pays the default fee.</p>
      )}
      {zones.map((zone, index) => (
        <fieldset key={index} className="mt-5 rounded-md border border-line p-4">
          <div className="grid gap-x-4 sm:grid-cols-[1fr_12rem_auto] sm:items-end">
            <label className="block">
              <span className="eyebrow text-muted">Zone name</span>
              <input
                value={zone.name}
                maxLength={40}
                onChange={(e) => update(index, { name: e.target.value })}
                className={inputClass}
              />
            </label>
            <label className="block">
              <span className="eyebrow text-muted">Fee (Rs)</span>
              <input
                value={zone.fee}
                inputMode="numeric"
                onChange={(e) => update(index, { fee: e.target.value })}
                className={inputClass}
              />
            </label>
            <button
              type="button"
              onClick={() => setZones((current) => current.filter((_, i) => i !== index))}
              className={`${buttonClass} mt-4 sm:mb-3`}
            >
              Remove zone
            </button>
          </div>
          <p className="eyebrow mt-4 text-muted">Districts ({zone.districts.length})</p>
          <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-3 md:grid-cols-4">
            {DISTRICTS.map((district) => (
              <label key={district.en} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={zone.districts.includes(district.en)}
                  onChange={() => toggle(index, district.en)}
                />
                {district.en}
              </label>
            ))}
          </div>
        </fieldset>
      ))}

      <button
        type="button"
        onClick={() => setZones((current) => [...current, { name: "", fee: "0", districts: [] }])}
        className={`${buttonClass} mt-5`}
      >
        Add a zone
      </button>

      {state.errors.length > 0 && (
        <ul className="mt-4 text-sm text-blaze">
          {state.errors.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      )}
      {state.saved && !pending && (
        <p role="status" className="mt-4 text-sm text-muted">
          Saved.
        </p>
      )}
      <div>
        <button
          type="submit"
          disabled={pending}
          className="mt-6 rounded-full bg-blaze px-6 py-3 font-medium text-white transition-transform hover:-translate-y-0.5 disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save zones"}
        </button>
      </div>
    </form>
  );
}
