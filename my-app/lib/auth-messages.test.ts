import { describe, expect, it } from "vitest";
import { AUTH_MESSAGES, signInErrorMessage } from "./auth-messages";
import { validateSignUp } from "./auth-rules";

describe("AUTH_MESSAGES", () => {
  it("has Sinhala and English text for every message", () => {
    for (const [code, text] of Object.entries(AUTH_MESSAGES)) {
      expect(text.si.trim(), code).not.toBe("");
      expect(text.en.trim(), code).not.toBe("");
    }
  });

  it("includes the phone sign-in messages", () => {
    for (const code of ["invalidPhone", "codeInvalid", "codeTooSoon", "codeLimit", "smsUnavailable", "smsSendFailed"]) {
      expect(AUTH_MESSAGES, code).toHaveProperty(code);
    }
  });
});

describe("validateSignUp error codes", () => {
  it("returns message codes, not English text", () => {
    const r = validateSignUp({ email: "x", password: "a", name: "n".repeat(101) });
    expect(!r.ok && r.errors).toEqual({
      email: "invalidEmail",
      password: "passwordLength",
      name: "nameTooLong",
    });
  });
});

describe("signInErrorMessage", () => {
  it("maps known Auth.js codes", () => {
    expect(signInErrorMessage("CredentialsSignin")).toBe("invalidCredentials");
    expect(signInErrorMessage("OAuthAccountNotLinked")).toBe("passwordAccount");
  });

  it("uses a generic message for unknown codes, including prototype names", () => {
    expect(signInErrorMessage("constructor")).toBe("signInFailed");
  });

  it("returns null without a code", () => {
    expect(signInErrorMessage(null)).toBeNull();
  });
});
