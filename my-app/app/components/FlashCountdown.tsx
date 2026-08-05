"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

// The sale ends at the next local midnight; recomputed each tick so it stays
// live without a fixed build-time timestamp.
function saleEndsAt(): number {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}

function remainingMs(): number {
  return Math.max(0, saleEndsAt() - Date.now());
}

// `true` on the client after hydration, `false` during SSR — lets us render a
// stable placeholder first and avoid a hydration mismatch on the live digits.
function useHydrated(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

export default function FlashCountdown() {
  const hydrated = useHydrated();
  const [ms, setMs] = useState<number>(() =>
    typeof window === "undefined" ? 0 : remainingMs(),
  );

  useEffect(() => {
    // setState lives inside the interval callback, not the effect body.
    const id = window.setInterval(() => setMs(remainingMs()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const totalSeconds = Math.floor(ms / 1000);
  const cells: [string, string][] = [
    [String(Math.floor(totalSeconds / 3600)).padStart(2, "0"), "hrs"],
    [String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0"), "min"],
    [String(totalSeconds % 60).padStart(2, "0"), "sec"],
  ];

  return (
    <div className="flex items-center gap-2">
      {cells.map(([value, label], i) => (
        <div key={label} className="flex items-center gap-2">
          <div className="flex w-14 flex-col items-center rounded-md bg-panel px-2 py-2 text-panelink">
            <span className="font-mono text-xl leading-none tabular-nums">
              {hydrated ? value : "––"}
            </span>
            <span className="mt-1 font-mono text-[0.55rem] uppercase tracking-widest text-panelmuted">
              {label}
            </span>
          </div>
          {i < cells.length - 1 && (
            <span aria-hidden="true" className="font-mono text-muted">
              :
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
