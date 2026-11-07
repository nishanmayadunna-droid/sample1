"use client";

import { useActionState, useState, useTransition } from "react";
import { DISTRICTS } from "@/lib/shipping";
import { saveZonesAction, type ZonesState } from "./actions";

type BandDraft = { upToGrams: string; fee: string };
type ZoneDraft = { name: string; fee: string; districts: string[]; bands: BandDraft[]; extraPerKg: string };

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

  const updateBand = (index: number, bandIndex: number, patch: Partial<BandDraft>) =>
    setZones((current) =>
      current.map((zone, i) =>
        i === index
          ? { ...zone, bands: zone.bands.map((band, j) => (j === bandIndex ? { ...band, ...patch } : band)) }
          : zone,
      ),
    );

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
          <p className="eyebrow mt-4 text-muted">Weight bands (optional)</p>
          <p className="mt-1 max-w-prose text-sm text-muted">
            Charge by the weight of the order instead of the flat fee. Each band is &quot;up to this many grams, this
            fee&quot;. If any item in the order has no weight, the flat fee above is charged.
          </p>
          {zone.bands.map((band, bandIndex) => (
            <div key={bandIndex} className="mt-2 grid items-end gap-x-3 sm:grid-cols-[1fr_1fr_auto]">
              <label className="block">
                <span className="eyebrow text-muted">Up to (grams)</span>
                <input
                  value={band.upToGrams}
                  inputMode="numeric"
                  onChange={(e) => updateBand(index, bandIndex, { upToGrams: e.target.value })}
                  className={inputClass}
                />
              </label>
              <label className="block">
                <span className="eyebrow text-muted">Fee (Rs)</span>
                <input
                  value={band.fee}
                  inputMode="numeric"
                  onChange={(e) => updateBand(index, bandIndex, { fee: e.target.value })}
                  className={inputClass}
                />
              </label>
              <button
                type="button"
                onClick={() => update(index, { bands: zone.bands.filter((_, j) => j !== bandIndex) })}
                className={`${buttonClass} mb-3`}
              >
                Remove
              </button>
            </div>
          ))}
          <div className="mt-2 flex flex-wrap items-end gap-x-4">
            <button
              type="button"
              disabled={zone.bands.length >= 6}
              onClick={() => update(index, { bands: [...zone.bands, { upToGrams: "", fee: "" }] })}
              className={buttonClass}
            >
              Add a band
            </button>
            {zone.bands.length > 0 && (
              <label className="block">
                <span className="eyebrow text-muted">Rs per extra kg above the last band</span>
                <input
                  value={zone.extraPerKg}
                  inputMode="numeric"
                  onChange={(e) => update(index, { extraPerKg: e.target.value })}
                  className={`${inputClass} max-w-40`}
                />
              </label>
            )}
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
        onClick={() => setZones((current) => [...current, { name: "", fee: "0", districts: [], bands: [], extraPerKg: "" }])}
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
          className="mt-6 rounded-full bg-blaze px-6 py-3 font-medium text-onaccent transition-transform hover:-translate-y-0.5 disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save zones"}
        </button>
      </div>
    </form>
  );
}
