// Pure auth decisions: no I/O, no Next or Supabase imports, so they're safe
// anywhere and covered by unit tests (lib/auth-rules.test.ts).

export type Role = "user" | "admin";

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export type SignUpInput = {
  email: string;
  password: string;
  name: string | null;
};

export type SignUpErrors = Partial<Record<"email" | "password" | "name", string>>;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// bcrypt ignores everything past 72 bytes, so cap by bytes, not characters.
const PASSWORD_MIN_BYTES = 8;
const PASSWORD_MAX_BYTES = 72;
const NAME_MAX_LENGTH = 100;

export function validateSignUp(raw: {
  email: unknown;
  password: unknown;
  name: unknown;
}):
  | { ok: true; value: SignUpInput }
  | { ok: false; errors: SignUpErrors } {
  const errors: SignUpErrors = {};

  const email = typeof raw.email === "string" ? normalizeEmail(raw.email) : "";
  if (!EMAIL_PATTERN.test(email)) {
    errors.email = "Enter a valid email address.";
  }

  const password = typeof raw.password === "string" ? raw.password : "";
  const passwordBytes = new TextEncoder().encode(password).length;
  if (passwordBytes < PASSWORD_MIN_BYTES || passwordBytes > PASSWORD_MAX_BYTES) {
    errors.password = "Password must be 8–72 characters.";
  }

  const trimmedName = typeof raw.name === "string" ? raw.name.trim() : "";
  if (trimmedName.length > NAME_MAX_LENGTH) {
    errors.name = "Name must be 100 characters or fewer.";
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value: { email, password, name: trimmedName || null } };
}

/** The bits of a stored user that matter for Google account linking. */
export type ExistingAccount = { googleId: string | null; hasPassword: boolean } | null;

export type GoogleProfile = {
  email: string;
  emailVerified: boolean;
  googleId: string;
};

export type GoogleDecision =
  | { action: "allow" }
  | { action: "create"; email: string }
  | { action: "reject"; reason: "unverified" | "password_account" };

/**
 * Decides a Google sign-in. Accounts are never linked automatically: an email
 * already owned by a password account is rejected rather than merged.
 */
export function resolveGoogleSignIn(
  byGoogleId: ExistingAccount,
  byEmail: ExistingAccount,
  profile: GoogleProfile,
): GoogleDecision {
  if (!profile.emailVerified) return { action: "reject", reason: "unverified" };
  if (byGoogleId) return { action: "allow" };
  if (byEmail) return { action: "reject", reason: "password_account" };
  return { action: "create", email: normalizeEmail(profile.email) };
}

/**
 * Only same-origin paths are allowed as post-sign-in destinations. Browsers
 * treat `//host` and `/\host` as external and strip tab/CR/LF before parsing,
 * so control characters and backslashes are rejected outright and the rest is
 * resolved with the URL parser against a dummy origin.
 */
export function safeCallbackUrl(
  url: string | null | undefined,
  fallback = "/account",
): string {
  if (!url || url[0] !== "/" || /[\u0000-\u001F\u007F\\]/.test(url)) {
    return fallback;
  }
  const base = "http://same-origin.invalid";
  const parsed = new URL(url, base);
  if (parsed.origin !== base) return fallback;
  return parsed.pathname + parsed.search + parsed.hash;
}
