import { beforeEach, expect, it, vi } from "vitest";
import {
  addItem,
  clear,
  getCartLines,
  getCartOwner,
  onCartChange,
  replaceCart,
  setCartOwner,
} from "./CartContext";

// Runs in Node: no window, so the store keeps state in memory only.
beforeEach(() => {
  replaceCart([]);
  setCartOwner(null);
});

it("reports local mutations as local", () => {
  const seen: string[] = [];
  const off = onCartChange((_, source) => seen.push(source));
  addItem("a", "M");
  clear();
  off();
  expect(seen).toEqual(["local", "local"]);
});

it("reports replaceCart as remote and stores the lines", () => {
  const seen: string[] = [];
  const off = onCartChange((_, source) => seen.push(source));
  replaceCart([{ id: "a", size: "M", quantity: 2 }]);
  off();
  expect(seen).toEqual(["remote"]);
  expect(getCartLines()).toEqual([{ id: "a", size: "M", quantity: 2 }]);
});

it("stops notifying after unsubscribe", () => {
  const listener = vi.fn();
  onCartChange(listener)();
  addItem("a", "M");
  expect(listener).not.toHaveBeenCalled();
});

it("round-trips the owner", () => {
  setCartOwner("u1");
  expect(getCartOwner()).toBe("u1");
  setCartOwner(null);
  expect(getCartOwner()).toBeNull();
});
