import { describe, expect, it } from "vitest";
import { clampToStock, decideSync, mergeCartLines, sanitizeCartLines } from "./cart-rules";

const l = (id: string, size: string, quantity: number) => ({ id, size, quantity });

describe("sanitizeCartLines", () => {
  it.each([null, undefined, "x", 5, {}])("returns [] for %j", (raw) =>
    expect(sanitizeCartLines(raw)).toEqual([]));

  it("keeps valid lines in order", () =>
    expect(sanitizeCartLines([l("a", "M", 1), l("b", "L", 99)])).toEqual([
      l("a", "M", 1),
      l("b", "L", 99),
    ]));

  it("clamps quantities above 99 instead of dropping the line", () =>
    expect(sanitizeCartLines([l("a", "M", 100), l("b", "S", 250)])).toEqual([
      l("a", "M", 99),
      l("b", "S", 99),
    ]));

  it.each([
    { id: "", size: "M", quantity: 1 },
    { id: "a", size: "", quantity: 1 },
    { id: 1, size: "M", quantity: 1 },
    { id: "a", size: "M", quantity: 0 },
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
    [{ status: "loading", userId: null, owner: null, dirty: false }, "wait"],
    [{ status: "authenticated", userId: null, owner: null, dirty: false }, "wait"],
    [{ status: "authenticated", userId: "u1", owner: null, dirty: false }, "merge"],
    [{ status: "authenticated", userId: "u1", owner: null, dirty: true }, "merge"],
    [{ status: "authenticated", userId: "u1", owner: "u1", dirty: false }, "pull"],
    // Unsaved local changes (this tab, another tab, or before a reload) are
    // pushed instead of being overwritten by the older server copy.
    [{ status: "authenticated", userId: "u1", owner: "u1", dirty: true }, "push"],
    // Another user's leftover cart is replaced, never merged or pushed.
    [{ status: "authenticated", userId: "u2", owner: "u1", dirty: false }, "pull"],
    [{ status: "authenticated", userId: "u2", owner: "u1", dirty: true }, "pull"],
    [{ status: "unauthenticated", userId: null, owner: "u1", dirty: true }, "clear"],
    [{ status: "unauthenticated", userId: null, owner: null, dirty: false }, "none"],
  ] as const)("%j → %s", (input, expected) => expect(decideSync(input)).toBe(expected));
});

describe("clampToStock", () => {
  const line = (id: string, size: string, quantity: number) => ({ id, size, quantity });

  it("lowers a line above its cap", () => {
    const result = clampToStock([line("a", "M", 5)], [{ id: "a", stock: { M: 2 } }]);
    expect(result).toEqual({ lines: [line("a", "M", 2)], changed: true });
  });

  it("drops a sold-out line", () => {
    const result = clampToStock([line("a", "M", 1), line("b", "L", 1)], [{ id: "a", stock: { M: 0 } }]);
    expect(result).toEqual({ lines: [line("b", "L", 1)], changed: true });
  });

  it("leaves untracked, unknown and in-range lines alone", () => {
    const lines = [line("a", "M", 3), line("b", "M", 2), line("zzz", "M", 9)];
    const result = clampToStock(lines, [
      { id: "a", stock: null },
      { id: "b", stock: { M: 2 } },
    ]);
    expect(result).toEqual({ lines, changed: false });
  });

  it("caps each size by its own entry", () => {
    const result = clampToStock(
      [line("a", "M", 4), line("a", "L", 4)],
      [{ id: "a", stock: { M: 1 } }],
    );
    expect(result.lines).toEqual([line("a", "M", 1), line("a", "L", 4)]);
  });
});
