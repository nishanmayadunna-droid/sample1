import { describe, expect, it } from "vitest";
import { decideSync, mergeCartLines, sanitizeCartLines } from "./cart-rules";

const l = (id: string, size: string, quantity: number) => ({ id, size, quantity });

describe("sanitizeCartLines", () => {
  it.each([null, undefined, "x", 5, {}])("returns [] for %j", (raw) =>
    expect(sanitizeCartLines(raw)).toEqual([]));

  it("keeps valid lines in order", () =>
    expect(sanitizeCartLines([l("a", "M", 1), l("b", "L", 99)])).toEqual([
      l("a", "M", 1),
      l("b", "L", 99),
    ]));

  it.each([
    { id: "", size: "M", quantity: 1 },
    { id: "a", size: "", quantity: 1 },
    { id: 1, size: "M", quantity: 1 },
    { id: "a", size: "M", quantity: 0 },
    { id: "a", size: "M", quantity: 100 },
    { id: "a", size: "M", quantity: 1.5 },
    { id: "a", size: "M", quantity: "2" },
    { id: "a", size: "M" },
    null,
    "a",
  ])("drops invalid line %j", (bad) =>
    expect(sanitizeCartLines([bad, l("ok", "S", 1)])).toEqual([l("ok", "S", 1)]));

  it("collapses duplicates keeping the larger quantity at the first position", () =>
    expect(
      sanitizeCartLines([l("a", "M", 2), l("b", "S", 1), l("a", "M", 5)]),
    ).toEqual([l("a", "M", 5), l("b", "S", 1)]));

  it("caps at 50 lines", () =>
    expect(
      sanitizeCartLines(Array.from({ length: 60 }, (_, i) => l(`p${i}`, "M", 1))),
    ).toHaveLength(50));
});

describe("mergeCartLines", () => {
  it("puts account lines first, then new local lines", () =>
    expect(mergeCartLines([l("x", "M", 1)], [l("a", "S", 2)])).toEqual([
      l("a", "S", 2),
      l("x", "M", 1),
    ]));

  it("keeps the larger quantity when local is larger", () =>
    expect(mergeCartLines([l("a", "M", 4)], [l("a", "M", 1)])).toEqual([l("a", "M", 4)]));

  it("keeps the larger quantity when account is larger", () =>
    expect(mergeCartLines([l("a", "M", 1)], [l("a", "M", 3)])).toEqual([l("a", "M", 3)]));

  it("treats different sizes as different lines", () =>
    expect(mergeCartLines([l("a", "M", 1)], [l("a", "L", 1)])).toEqual([
      l("a", "L", 1),
      l("a", "M", 1),
    ]));

  it("caps the result at 50", () =>
    expect(
      mergeCartLines(
        Array.from({ length: 30 }, (_, i) => l(`x${i}`, "M", 1)),
        Array.from({ length: 30 }, (_, i) => l(`a${i}`, "M", 1)),
      ),
    ).toHaveLength(50));
});

describe("decideSync", () => {
  it.each([
    [{ status: "loading", userId: null, owner: null }, "wait"],
    [{ status: "authenticated", userId: null, owner: null }, "wait"],
    [{ status: "authenticated", userId: "u1", owner: null }, "merge"],
    [{ status: "authenticated", userId: "u1", owner: "u1" }, "pull"],
    // Another user's leftover cart is replaced, never merged into this account.
    [{ status: "authenticated", userId: "u2", owner: "u1" }, "pull"],
    [{ status: "unauthenticated", userId: null, owner: "u1" }, "clear"],
    [{ status: "unauthenticated", userId: null, owner: null }, "none"],
  ] as const)("%j → %s", (input, expected) => expect(decideSync(input)).toBe(expected));
});
