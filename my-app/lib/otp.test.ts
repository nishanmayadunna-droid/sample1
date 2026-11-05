import { describe, expect, it } from "vitest";
import {
  DEFAULT_DAILY_CAP,
  MAX_DAILY_CAP,
  generateCode,
  hashCode,
  isValidCodeInput,
  otpMessage,
  parseSmsSettings,
  toTextlkRecipient,
} from "./otp";

describe("generateCode", () => {
  it("is always six digits", () => {
    for (let i = 0; i < 200; i++) expect(generateCode()).toMatch(/^\d{6}$/);
  });
});

describe("hashCode", () => {
  it("is stable and differs when any input differs", () => {
    const h = hashCode("0771234567", "123456", "s");
    expect(hashCode("0771234567", "123456", "s")).toBe(h);
    expect(hashCode("0771234568", "123456", "s")).not.toBe(h);
    expect(hashCode("0771234567", "123457", "s")).not.toBe(h);
    expect(hashCode("0771234567", "123456", "t")).not.toBe(h);
  });

  it("is hex and never contains the code", () => {
    const h = hashCode("0771234567", "123456", "s");
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(h).not.toContain("123456");
  });
});

describe("toTextlkRecipient", () => {
  it("converts local numbers to 94 format", () => {
    expect(toTextlkRecipient("0771234567")).toBe("94771234567");
  });
  it("rejects anything else", () => {
    expect(toTextlkRecipient("771234567")).toBeNull();
    expect(toTextlkRecipient("0671234567")).toBeNull();
    expect(toTextlkRecipient("")).toBeNull();
  });
});

describe("otpMessage", () => {
  it("includes the code and validity", () => {
    expect(otpMessage("123456")).toBe("Northbound code: 123456. Valid 5 minutes.");
  });
});

describe("isValidCodeInput", () => {
  it("accepts exactly six digits", () => {
    expect(isValidCodeInput("012345")).toBe(true);
    expect(isValidCodeInput("12345")).toBe(false);
    expect(isValidCodeInput("1234567")).toBe(false);
    expect(isValidCodeInput("12345a")).toBe(false);
    expect(isValidCodeInput(" 123456")).toBe(false);
  });
});

describe("parseSmsSettings", () => {
  it("requires a sender id when enabled", () => {
    const r = parseSmsSettings({ enabled: "on", senderId: "", dailyCap: "200" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.senderId).toBeTruthy();
  });

  it("rejects bad sender ids", () => {
    for (const senderId of ["ab", "No!", "ABCDEFGHIJKL"]) {
      const r = parseSmsSettings({ enabled: "on", senderId, dailyCap: "200" });
      expect(r.ok).toBe(false);
    }
  });

  it("rejects bad caps", () => {
    for (const dailyCap of ["0", "5001", "1.5", "abc"]) {
      const r = parseSmsSettings({ enabled: "off", senderId: "", dailyCap });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.errors.dailyCap).toBeTruthy();
    }
  });

  it("accepts disabled with an empty sender id", () => {
    const r = parseSmsSettings({ senderId: "", dailyCap: "200" });
    expect(r).toEqual({ ok: true, value: { enabled: false, senderId: "", dailyCap: 200 } });
  });

  it("trims the sender id and accepts the cap limits", () => {
    const r = parseSmsSettings({ enabled: "on", senderId: "  Northbound ", dailyCap: String(MAX_DAILY_CAP) });
    expect(r).toEqual({ ok: true, value: { enabled: true, senderId: "Northbound", dailyCap: MAX_DAILY_CAP } });
  });

  it("falls back to the default cap when blank", () => {
    const r = parseSmsSettings({ enabled: "off" });
    expect(r.ok && r.value.dailyCap).toBe(DEFAULT_DAILY_CAP);
  });
});
