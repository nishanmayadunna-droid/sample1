"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Category } from "@/lib/products";
import L from "./L";

/** "Categories ▾" disclosure in the header nav. */
export default function CategoryMenu({ categories }: { categories: Category[] }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // While open, Esc or a click outside closes it.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    const onPointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls="category-menu"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 whitespace-nowrap py-2 hover:text-ink"
      >
        <L si="වර්ග" en="Categories" />
        <span aria-hidden="true" className={`transition-transform ${open ? "rotate-180" : ""}`}>
          ▾
        </span>
      </button>
      {open && (
        <ul
          id="category-menu"
          className="absolute right-0 top-full z-40 mt-1 min-w-48 rounded-lg border border-line bg-bg py-2 shadow-lg"
        >
          {categories.map((category) => (
            <li key={category.slug}>
              <Link
                href={`/products?category=${encodeURIComponent(category.slug)}`}
                onClick={() => setOpen(false)}
                className="block px-4 py-2 text-sm normal-case tracking-normal text-ink hover:bg-surface"
              >
                {category.name}
              </Link>
            </li>
          ))}
          <li className="mt-1 border-t border-line pt-1">
            <Link
              href="/products"
              onClick={() => setOpen(false)}
              className="block px-4 py-2 text-sm normal-case tracking-normal text-muted hover:bg-surface hover:text-ink"
            >
              <L si="සියලු භාණ්ඩ" en="All products" />
            </Link>
          </li>
        </ul>
      )}
    </div>
  );
}
