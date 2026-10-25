import { describe, expect, it } from "vitest";
import {
  normalizeEmail,
  resolveGoogleSignIn,
  safeCallbackUrl,
  validateSignUp,
} from "./auth-rules";

const pw = (n: number) => "a".repeat(n);

describe("normalizeEmail", () => {
  it("trims and lowercases", () =>
    expect(normalizeEmail("  Bob@X.COM ")).toBe("bob@x.com"));
});

describe("validateSignUp", () => {
  it("accepts valid input and normalizes", () => {
    expect(
      validateSignUp({ email: " A@B.co ", password: pw(8), name: "  Ana " }),
    ).toEqual({
      ok: true,
      value: { email: "a@b.co", password: pw(8), name: "Ana" },
    });
  });

  it("turns a blank name into null", () => {
    const r = validateSignUp({ email: "a@b.co", password: pw(8), name: "   " });
    expect(r.ok && r.value.name).toBeNull();
  });

  it.each(["", "no-at", "a@", "@b.co", "a b@c.co"])(
    "rejects email %j",
    (email) => {
      const r = validateSignUp({ email, password: pw(8), name: "" });
      expect(r.ok).toBe(false);
      expect(!r.ok && r.errors.email).toBeTruthy();
    },
  );

  it.each([
    [7, false],
    [8, true],
    [72, true],
    [73, false],
  ])("password of %i chars ok=%s", (n, ok) => {
    expect(validateSignUp({ email: "a@b.co", password: pw(n), name: "" }).ok).toBe(
      ok,
    );
  });

  it("rejects a password over 72 bytes even under 72 chars", () => {
    const r = validateSignUp({
      email: "a@b.co",
      password: "😀".repeat(30),
      name: "",
    });
    expect(!r.ok && r.errors.password).toBeTruthy();
  });

  it("rejects a name over 100 chars", () => {
    const r = validateSignUp({
      email: "a@b.co",
      password: pw(8),
      name: "n".repeat(101),
    });
    expect(!r.ok && r.errors.name).toBeTruthy();
  });

  it("rejects non-string fields", () => {
    expect(
      validateSignUp({ email: null, password: 5, name: undefined }).ok,
    ).toBe(false);
  });
});

describe("resolveGoogleSignIn", () => {
  const profile = { email: "Bob@X.com ", emailVerified: true, googleId: "g1" };

  it("rejects an unverified email", () =>
    expect(
      resolveGoogleSignIn(null, null, { ...profile, emailVerified: false }),
    ).toEqual({ action: "reject", reason: "unverified" }));

  it("allows a known google id", () =>
    expect(
      resolveGoogleSignIn({ googleId: "g1", hasPassword: false }, null, profile),
    ).toEqual({ action: "allow" }));

  it("rejects when the email belongs to a password account", () =>
    expect(
      resolveGoogleSignIn(null, { googleId: null, hasPassword: true }, profile),
    ).toEqual({ action: "reject", reason: "password_account" }));

  it("creates with a normalized email when nobody has it", () =>
    expect(resolveGoogleSignIn(null, null, profile)).toEqual({
      action: "create",
      email: "bob@x.com",
    }));
});

describe("safeCallbackUrl", () => {
  it.each([
    ["/cart", "/cart"],
    ["/products/x?y=1", "/products/x?y=1"],
  ])("keeps %s", (u, e) => expect(safeCallbackUrl(u)).toBe(e));

  it.each(["//evil.com", "/\\evil.com", "https://evil.com", "evil", "", null, undefined])(
    "rejects %j",
    (u) => expect(safeCallbackUrl(u)).toBe("/account"),
  );

  it("uses a custom fallback", () =>
    expect(safeCallbackUrl(null, "/")).toBe("/"));
});
