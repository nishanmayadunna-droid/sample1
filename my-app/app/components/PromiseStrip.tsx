"use client";

import { useEffect, useState } from "react";
import { promiseItems, type StorePromise } from "@/lib/storefront-form";
import L from "./L";
import PromiseIcon from "./PromiseIcon";

const ROTATE_MS = 4000;

/** Black strip at the very top: every promise in a row, or one at a time on phones. */
export default function PromiseStrip({ promises }: { promises: StorePromise[] }) {
  const items = promiseItems(promises);
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    if (items.length < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // setState lives inside the interval callback, not the effect body.
    const id = window.setInterval(() => setCurrent((i) => (i + 1) % items.length), ROTATE_MS);
    return () => window.clearInterval(id);
  }, [items.length]);

  return (
    <div className="bg-panel text-panelink">
      <ul className="mx-auto flex max-w-6xl items-center justify-center px-4 py-2 text-[0.75rem] sm:divide-x sm:divide-white/15">
        {items.map((item, i) => (
          <li
            key={item.key}
            className={`items-center gap-2 sm:flex sm:px-5 ${
              i === current ? "promise-fade flex" : "hidden"
            }`}
          >
            <PromiseIcon icon={item.icon} className="h-4 w-4 text-blaze" />
            <L si={item.si} en={item.en} />
          </li>
        ))}
      </ul>
    </div>
  );
}
