// Pure review rules: validation, rating summary, reviewer display name. No I/O,
// so they are shared by the Server Action, the pages and the unit tests.

export const MAX_REVIEW_LENGTH = 1000;

export type RatingSummary = { average: number; count: number };

/** An approved review as shown on the product page. */
export type Review = {
  id: string;
  authorName: string;
  rating: number;
  body: string;
  createdAt: string;
  /** The author has received this product (a delivered order). */
  verified: boolean;
};

/** Codes the review Server Action returns; the UI turns them into text. */
export type ReviewMessage = "saved" | "rating" | "body" | "error";

// Newline, carriage return and tab are fine; every other control character is not.
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;

export function validateReview(input: {
  rating: unknown;
  body: unknown;
}): { ok: true; rating: number; body: string } | { ok: false; error: "rating" | "body" } {
  const raw = input.rating;
  const rating = typeof raw === "string" && raw.trim() !== "" ? Number(raw) : raw;
  if (typeof rating !== "number" || !Number.isInteger(rating) || rating < 1 || rating > 5) {
    return { ok: false, error: "rating" };
  }
  if (typeof input.body !== "string") return { ok: false, error: "body" };
  const body = input.body.trim();
  if (body.length < 1 || body.length > MAX_REVIEW_LENGTH || CONTROL_CHARS.test(body)) {
    return { ok: false, error: "body" };
  }
  return { ok: true, rating, body };
}

/** Null when there are no ratings, so callers show nothing rather than a fake 0. */
export function summarizeRatings(ratings: number[]): RatingSummary | null {
  if (ratings.length === 0) return null;
  const sum = ratings.reduce((total, rating) => total + rating, 0);
  return { average: Math.round((sum / ratings.length) * 10) / 10, count: ratings.length };
}

/** The reviewer's first name only, for privacy. */
export function firstName(name: string | null): string {
  // A customer with no name is "Customer": never part of their email address.
  return (name ?? "").trim().split(/\s+/)[0] || "Customer";
}
