// Pure rules for linking or changing the phone number of a signed-in account
// (Part 19). No I/O, so the Server Actions, the account form and the unit tests
// share them.
import type { AuthMessage } from "./auth-messages";

export type SetPhoneResult = "linked" | "changed" | "same" | "phone_taken" | "too_soon" | "user_not_found";

export const PHONE_CHANGE_COOLDOWN_HOURS = 24;

/** Mirrors the 24 hour rule in set_user_phone(): a number already set can change once a day. */
export function canChangePhone(currentPhone: string | null, changedAt: string | null, now: Date): boolean {
  if (!currentPhone || !changedAt) return true;
  return Date.parse(changedAt) <= now.getTime() - PHONE_CHANGE_COOLDOWN_HOURS * 3600_000;
}

/**
 * The message for a failed confirmation, or null when the number was saved.
 * "phone_taken" gets the same wording as a wrong code, so the form never tells
 * anyone which numbers already have an account.
 */
export function confirmMessage(result: SetPhoneResult | "invalid_code" | "invalid_phone" | "unavailable"): AuthMessage | null {
  switch (result) {
    case "linked":
    case "changed":
      return null;
    case "same":
      return "phoneSame";
    case "too_soon":
      return "phoneChangeTooSoon";
    case "invalid_phone":
      return "invalidPhone";
    case "unavailable":
      return "smsUnavailable";
    case "phone_taken":
    case "invalid_code":
    case "user_not_found":
      return "codeInvalid";
  }
}
