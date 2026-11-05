import { describe, expect, it } from "vitest";
import {
  NEWSLETTER_DAILY_CAP,
  csvCell,
  isHoneypotFilled,
  isUnsubscribeToken,
  toCsv,
  validateEmail,
} from "./newsletter";

describe("validateEmail", () => {
  it("trims and lowercases", () => {
    expect(validateEmail("  Foo@Bar.COM ")).toEqual({ ok: true, email: "foo@bar.com" });
  });
  it("rejects bad addresses", () => {
    for (const bad of ["a@b", "a b@c.com", "a@@b.com", "", `${"a".repeat(249)}@b.com`]) {
      expect(validateEmail(bad).ok).toBe(false);
    }
  });
});

describe("isHoneypotFilled", () => {
  it("is true only for non-empty values", () => {
    expect(isHoneypotFilled("")).toBe(false);
    expect(isHoneypotFilled(null)).toBe(false);
    expect(isHoneypotFilled(undefined)).toBe(false);
    expect(isHoneypotFilled("x")).toBe(true);
  });
});

describe("csv", () => {
  it("has a daily cap", () => {
    expect(NEWSLETTER_DAILY_CAP).toBe(500);
  });
  it("neutralises formulas", () => {
    expect(csvCell("=cmd")).toBe("'=cmd");
    expect(csvCell("+1")).toBe("'+1");
    expect(csvCell("-1")).toBe("'-1");
    expect(csvCell("@x")).toBe("'@x");
  });
  it("quotes when needed", () => {
    expect(csvCell("a,b")).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
  });
  it("builds a csv with CRLF and keeps newline cells quoted", () => {
    const out = toCsv([
      { email: "a@b.lk", source: "foo\nbar", createdAt: "2026-01-01", unsubscribedAt: null },
    ]);
    expect(out).toBe(
      'email,source,subscribed_at,unsubscribed_at\r\na@b.lk,"foo\nbar",2026-01-01,',
    );
  });
});

describe("isUnsubscribeToken", () => {
  const hex = "a1b2c3d4".repeat(8);
  it("accepts 64 hex characters", () => {
    expect(isUnsubscribeToken(hex)).toBe(true);
    expect(isUnsubscribeToken(hex.toUpperCase())).toBe(true);
  });
  it("rejects other shapes", () => {
    expect(isUnsubscribeToken("123e4567-e89b-12d3-a456-426614174000")).toBe(false);
    expect(isUnsubscribeToken(hex.slice(1))).toBe(false);
    expect(isUnsubscribeToken(hex + "a")).toBe(false);
    expect(isUnsubscribeToken("g".repeat(64))).toBe(false);
    expect(isUnsubscribeToken("")).toBe(false);
  });
});
