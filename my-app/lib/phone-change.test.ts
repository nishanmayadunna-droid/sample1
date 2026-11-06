import { describe, expect, it } from "vitest";
import { AUTH_MESSAGES } from "./auth-messages";
import { canChangePhone, confirmMessage, type SetPhoneResult } from "./phone-change";

const now = new Date("2026-11-14T12:00:00Z");
const hoursAgo = (h: number) => new Date(now.getTime() - h * 3600_000).toISOString();

describe("canChangePhone", () => {
  it("allows linking a first number at any time", () => {
    expect(canChangePhone(null, null, now)).toBe(true);
    expect(canChangePhone(null, hoursAgo(1), now)).toBe(true);
  });
  it("allows a change when it was never changed or long ago", () => {
    expect(canChangePhone("0771234567", null, now)).toBe(true);
    expect(canChangePhone("0771234567", hoursAgo(25), now)).toBe(true);
    expect(canChangePhone("0771234567", hoursAgo(24), now)).toBe(true);
  });
  it("blocks a second change inside 24 hours", () => {
    expect(canChangePhone("0771234567", hoursAgo(23), now)).toBe(false);
    expect(canChangePhone("0771234567", hoursAgo(0), now)).toBe(false);
  });
});

describe("confirmMessage", () => {
  it("is null when the number was saved", () => {
    expect(confirmMessage("linked")).toBeNull();
    expect(confirmMessage("changed")).toBeNull();
  });
  it("never reveals that a number belongs to another account", () => {
    expect(confirmMessage("phone_taken")).toBe(confirmMessage("invalid_code"));
    expect(confirmMessage("phone_taken")).toBe("codeInvalid");
  });
  it("only returns messages that exist in both languages", () => {
    const results: SetPhoneResult[] = ["linked", "changed", "same", "phone_taken", "too_soon", "user_not_found"];
    for (const result of [...results, "invalid_code", "invalid_phone", "unavailable"] as const) {
      const message = confirmMessage(result);
      if (message) {
        expect(AUTH_MESSAGES[message].si.length).toBeGreaterThan(0);
        expect(AUTH_MESSAGES[message].en.length).toBeGreaterThan(0);
      }
    }
  });
});
