import { beforeEach, expect, it, vi } from "vitest";
import {
  addItem,
  clear,
  getCartLines,
  getCartOwner,
  onCartChange,
  replaceCart,
  setCartOwner,
  setQuantity,
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

it("caps a line's quantity at 99 when adding", () => {
  addItem("a", "M", 98);
  addItem("a", "M", 5);
  expect(getCartLines()).toEqual([{ id: "a", size: "M", quantity: 99 }]);
});

it("caps a line's quantity at 99 when setting it", () => {
  addItem("a", "M");
  setQuantity("a", "M", 150);
  expect(getCartLines()).toEqual([{ id: "a", size: "M", quantity: 99 }]);
});

it("refuses a 51st distinct line", () => {
  for (let i = 0; i < 51; i++) addItem(`p${i}`, "M");
  expect(getCartLines()).toHaveLength(50);
  expect(getCartLines().some((line) => line.id === "p50")).toBe(false);
});

it("round-trips the owner", () => {
  setCartOwner("u1");
  expect(getCartOwner()).toBe("u1");
  setCartOwner(null);
  expect(getCartOwner()).toBeNull();
});
