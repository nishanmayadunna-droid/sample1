"use client";

import { useActionState, useTransition } from "react";
import { saveShipmentAction, type ShipmentState } from "./actions";

const initialState: ShipmentState = { errors: {}, saved: false };
const inputClass = "mt-2 w-full rounded-md border border-line bg-bg px-4 py-3 outline-none focus:border-ink";

/** Courier and tracking number for a confirmed or shipped order. */
export default function ShipmentForm({
  orderNumber,
  couriers,
  courierName,
  trackingNumber,
}: {
  orderNumber: string;
  couriers: { id: string; name: string }[];
  courierName: string | null;
  trackingNumber: string | null;
}) {
  const [state, submit, pending] = useActionState(saveShipmentAction.bind(null, orderNumber), initialState);
  const [, startTransition] = useTransition();
  const errors = state.errors;
  // Preselect the saved courier when it is still on the active list.
  const selected = couriers.find((c) => c.name === courierName)?.id ?? "";

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        startTransition(() => submit(formData));
      }}
      className="mt-3 max-w-xl"
    >
      <div className="grid gap-x-4 sm:grid-cols-2">
        <label className="block">
          <span className="eyebrow text-muted">Courier</span>
          <select name="courierId" defaultValue={selected} className={inputClass}>
            <option value="" disabled>
              Choose a courier
            </option>
            {couriers.map((courier) => (
              <option key={courier.id} value={courier.id}>
                {courier.name}
              </option>
            ))}
          </select>
          {errors.courierId && <span className="mt-1 block text-sm text-blaze">Choose a courier.</span>}
        </label>
        <label className="block">
          <span className="eyebrow text-muted">Tracking number</span>
          <input name="trackingNumber" defaultValue={trackingNumber ?? ""} maxLength={40} className={inputClass} />
          {errors.trackingNumber && (
            <span className="mt-1 block text-sm text-blaze">3 to 40 letters, numbers or dashes.</span>
          )}
        </label>
      </div>
      {typeof errors.form === "string" && <p className="mt-2 text-sm text-blaze">{errors.form}</p>}
      {state.saved && !pending && (
        <p role="status" className="mt-2 text-sm text-muted">
          Saved.
        </p>
      )}
      <button
        type="submit"
        disabled={pending || couriers.length === 0}
        className="mt-4 rounded-full bg-blaze px-6 py-3 font-medium text-white transition-transform hover:-translate-y-0.5 disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save shipment"}
      </button>
    </form>
  );
}
