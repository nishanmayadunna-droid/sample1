"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Client navigation never re-renders the root layout, so the promotion list
// the shell (drawer, search, promise strip) got on the first load would stay
// as it was. This refreshes it when a promotion starts or ends, and when the
// tab comes back after a while.
const STALE_MS = 60_000;
// ISR may still serve the old page right at the boundary; check again after it revalidates.
const RETRIES_MS = [2_000, 65_000];
// setTimeout can't wait longer than ~24.8 days; anything that far is caught on focus.
const MAX_WAIT_MS = 2_147_000_000;

export default function PromotionClock({ nextChange }: { nextChange: string | null }) {
  const router = useRouter();

  useEffect(() => {
    let last = Date.now();
    const refresh = () => {
      last = Date.now();
      router.refresh();
    };
    const timers: number[] = [];
    if (nextChange) {
      const wait = Date.parse(nextChange) - Date.now();
      for (const extra of RETRIES_MS) {
        if (wait + extra < MAX_WAIT_MS) timers.push(window.setTimeout(refresh, Math.max(0, wait) + extra));
      }
    }
    const onVisible = () => {
      if (document.visibilityState === "visible" && Date.now() - last > STALE_MS) refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      timers.forEach((t) => window.clearTimeout(t));
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [nextChange, router]);

  return null;
}
