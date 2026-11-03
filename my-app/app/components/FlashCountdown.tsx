"use client";

import { useEffect, useState } from "react";
import L from "./L";

// Counts down to a real promotion's end (never an invented deadline).
function remainingMs(endsAt: string): number {
  return Math.max(0, Date.parse(endsAt) - Date.now());
}

export default function FlashCountdown({ endsAt }: { endsAt: string }) {
  // null until the first tick: the server and the first client render then
  // match exactly (same placeholder cells), and the live digits follow.
  const [ms, setMs] = useState<number | null>(null);

  useEffect(() => {
    // setState lives inside the timer callbacks, not the effect body.
    const tick = () => setMs(remainingMs(endsAt));
    const first = window.setTimeout(tick, 0);
    const id = window.setInterval(tick, 1000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(id);
    };
  }, [endsAt]);

  // Over: nothing to count (the page refreshes at the end; see PromotionClock).
  if (ms === 0) return null;

  const live = ms !== null;
  const totalSeconds = Math.floor((ms ?? 0) / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const cells: [string, string, string][] = [
    ...(live && days > 0 ? [[String(days), "දින", "days"] as [string, string, string]] : []),
    [String(Math.floor((totalSeconds % 86400) / 3600)).padStart(2, "0"), "පැය", "hrs"],
    [String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0"), "මිනි", "min"],
    [String(totalSeconds % 60).padStart(2, "0"), "තත්", "sec"],
  ];

  return (
    <div className="flex items-center gap-2">
      {cells.map(([value, si, en], i) => (
        <div key={en} className="flex items-center gap-2">
          <div className="flex w-14 flex-col items-center rounded-md bg-panel px-2 py-2 text-panelink">
            <span className="font-mono text-xl leading-none tabular-nums">
              {live ? value : "––"}
            </span>
            <span className="mt-1 font-mono text-[0.55rem] uppercase tracking-widest text-panelmuted">
              <L si={si} en={en} />
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
