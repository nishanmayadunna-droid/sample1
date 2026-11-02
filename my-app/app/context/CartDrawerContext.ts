"use client";

// Despite the name this is not React Context: a module-level store read
// through useSyncExternalStore, so any component can open the cart drawer.
import { useSyncExternalStore } from "react";

let open = false;
// The element that opened the drawer gets focus back when it closes.
let opener: HTMLElement | null = null;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function openCartDrawer() {
  if (open) return;
  opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  open = true;
  emit();
}

export function closeCartDrawer() {
  if (!open) return;
  open = false;
  emit();
  opener?.focus();
  opener = null;
}

export function useCartDrawer(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => open,
    () => false,
  );
}
