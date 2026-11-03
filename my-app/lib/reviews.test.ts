import { describe, expect, it } from "vitest";
import { firstName, MAX_REVIEW_LENGTH, summarizeRatings, validateReview } from "./reviews";

describe("validateReview", () => {
  it("rejects ratings that are not whole numbers 1 to 5", () => {
    for (const rating of [0, 6, 2.5, "abc", null, undefined]) {
      expect(validateReview({ rating, body: "fine" })).toEqual({ ok: false, error: "rating" });
    }
  });

  it("accepts 1, 5 and numeric strings", () => {
    expect(validateReview({ rating: 1, body: "ok" })).toEqual({ ok: true, rating: 1, body: "ok" });
    expect(validateReview({ rating: 5, body: "ok" }).ok).toBe(true);
    expect(validateReview({ rating: "4", body: "ok" })).toEqual({ ok: true, rating: 4, body: "ok" });
  });

  it("rejects empty, over-long and control-character bodies", () => {
    for (const body of ["", "   ", "x".repeat(MAX_REVIEW_LENGTH + 1), "hi\u0000", 5, null]) {
      expect(validateReview({ rating: 3, body })).toEqual({ ok: false, error: "body" });
    }
  });

  it("accepts a maximal body and keeps newlines, trimmed", () => {
    expect(validateReview({ rating: 3, body: "x".repeat(MAX_REVIEW_LENGTH) }).ok).toBe(true);
    expect(validateReview({ rating: 3, body: "  a\nb  " })).toEqual({ ok: true, rating: 3, body: "a\nb" });
  });
});

describe("summarizeRatings", () => {
  it("is null for no ratings", () => {
    expect(summarizeRatings([])).toBeNull();
  });

  it("averages to one decimal", () => {
    expect(summarizeRatings([5, 4])).toEqual({ average: 4.5, count: 2 });
    expect(summarizeRatings([5, 4, 4])).toEqual({ average: 4.3, count: 3 });
  });
});

describe("firstName", () => {
  it("uses the first word of the name", () => {
    expect(firstName("  Nimal  Perera ")).toBe("Nimal");
  });

  it("never falls back to part of the email address", () => {
    expect(firstName(null)).toBe("Customer");
    expect(firstName("")).toBe("Customer");
    expect(firstName("   ")).toBe("Customer");
  });
});
