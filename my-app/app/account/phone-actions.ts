"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth-guards";
import type { AuthMessage } from "@/lib/auth-messages";
import { confirmPhoneChange, requestPhoneChangeCode } from "@/lib/phone-account";

// Both actions take the user from the session, never from the arguments, and
// return a message code (null = success) like the sign-in actions do.

/** Step 1: text a code to the new number. */
export async function requestPhoneChangeAction(phone: string): Promise<AuthMessage | null> {
  const user = await requireUser("/account");
  if (typeof phone !== "string") return "invalidPhone";
  try {
    const result = await requestPhoneChangeCode(user.id, phone);
    switch (result) {
      case "sent":
        return null;
      case "invalid_phone":
        return "invalidPhone";
      case "same_phone":
        return "phoneSame";
      case "unavailable":
        return "smsUnavailable";
      case "too_soon":
        return "codeTooSoon";
      case "hourly_limit":
      case "daily_cap":
        return "codeLimit";
      default:
        return "smsSendFailed";
    }
  } catch {
    return "smsSendFailed";
  }
}

/** Step 2: confirm the code and save the number. */
export async function confirmPhoneChangeAction(phone: string, code: string): Promise<AuthMessage | null> {
  const user = await requireUser("/account");
  if (typeof phone !== "string" || typeof code !== "string") return "codeInvalid";
  try {
    const message = await confirmPhoneChange(user.id, phone, code);
    if (message === null) revalidatePath("/account");
    return message;
  } catch {
    return "somethingWrong";
  }
}
