"use client";

import { useEffect, useId, useRef, useSyncExternalStore } from "react";
import { addItem, getCartLines } from "@/app/context/CartContext";
import { openCartDrawer } from "@/app/context/CartDrawerContext";
import { useLang } from "@/app/context/LangContext";
import { quickAddMode } from "@/lib/home-sections";
import { tr } from "@/lib/i18n";
import { allSoldOut, isSoldOut, maxQuantity, type StockMap } from "@/lib/stock";

// Only one size picker is open at a time across every card on the page. Keyed
// per card instance (not per product): one product can appear twice on a page.
let openId: string | null = null;
const listeners = new Set<() => void>();
function setOpenId(next: string | null) {
  openId = next;
  listeners.forEach((l) => l());
}
function useOpenId() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => openId,
    () => null,
  );
}

/** The card's 🛒+ button: adds at once for one size, else asks for a size over the photo. */
export default function QuickAdd({
  productId,
  name,
  sizes,
  stock,
}: {
  productId: string;
  name: string;
  sizes: string[];
  stock: StockMap;
}) {
  const lang = useLang();
  const mode = quickAddMode(sizes);
  const instanceId = useId();
  const open = useOpenId() === instanceId;
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // While open: focus the first size; Esc or a click elsewhere closes.
  useEffect(() => {
    if (!open) return;
    panelRef.current?.querySelector("button")?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpenId(null);
        buttonRef.current?.focus();
      }
    };
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!panelRef.current?.contains(target) && !buttonRef.current?.contains(target)) setOpenId(null);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  if (mode === "none" || allSoldOut({ sizes, stock })) return null;

  function add(size: string) {
    // Don't pile more into the cart than the shop has.
    const inCart = getCartLines().find((l) => l.id === productId && l.size === size)?.quantity ?? 0;
    if (inCart >= maxQuantity({ stock }, size)) {
      setOpenId(null);
      openCartDrawer();
      return;
    }
    addItem(productId, size);
    setOpenId(null);
    // The size pill is about to unmount; hand focus back to 🛒 first so the
    // drawer remembers a button that is still there when it closes.
    buttonRef.current?.focus();
    openCartDrawer();
  }

  return (
    <>
      {open && (
        <div
          ref={panelRef}
          role="group"
          aria-label={tr(lang, `${name} — ප්‍රමාණය තෝරන්න`, `${name} — choose a size`)}
          className="absolute inset-x-2 bottom-12 z-10 flex flex-wrap justify-center gap-1.5 rounded-lg bg-bg/95 p-2 shadow-lg backdrop-blur"
        >
          {sizes.map((size) => (
            <button
              key={size}
              type="button"
              onClick={() => add(size)}
              disabled={isSoldOut({ stock }, size)}
              className="min-w-10 rounded-md border border-line px-2 py-1.5 font-mono text-xs hover:border-blaze hover:text-blaze focus-visible:border-blaze disabled:cursor-not-allowed disabled:text-muted disabled:line-through disabled:opacity-50 disabled:hover:border-line disabled:hover:text-muted"
            >
              {size}
            </button>
          ))}
        </div>
      )}
      <button
        ref={buttonRef}
        type="button"
        onClick={() => (mode === "single" ? add(sizes[0]) : setOpenId(open ? null : instanceId))}
        aria-label={
          mode === "pick"
            ? tr(lang, `${name} — ප්‍රමාණය තෝරන්න`, `Choose a size for ${name}`)
            : tr(lang, `${name} කරත්තයට එක් කරන්න`, `Add ${name} to cart`)
        }
        aria-expanded={mode === "pick" ? open : undefined}
        className="absolute bottom-2 right-2 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-line bg-bg text-ink shadow transition-colors hover:border-blaze hover:bg-blaze hover:text-onaccent"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="h-5 w-5">
          <path d="M3 4h2l2.4 11.2a1 1 0 0 0 1 .8h9.2a1 1 0 0 0 1-.8L20 8H6.2M9 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM17 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM14 3v4M12 5h4" />
        </svg>
      </button>
    </>
  );
}
