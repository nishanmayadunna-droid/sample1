"use server";

import type { AuthMessage } from "@/lib/auth-messages";
import { validateSignUp, type SignUpErrors } from "@/lib/auth-rules";
import { createPasswordUser } from "@/lib/users";
import { requestPhoneCode } from "@/lib/phone-auth";
import { sendVerification } from "@/lib/email-data";

export type SignUpState = {
  ok: boolean;
  errors: SignUpErrors;
  formError: AuthMessage | null;
};

// Creates the account only. The client signs in afterwards with
// next-auth/react, so the browser navigates and the Header's session is fresh.
export async function signUpAction(
  _prev: SignUpState,
  formData: FormData,
): Promise<SignUpState> {
  const result = validateSignUp({
    email: formData.get("email"),
    password: formData.get("password"),
    name: formData.get("name"),
  });
  if (!result.ok) return { ok: false, errors: result.errors, formError: null };

  try {
    const created = await createPasswordUser(result.value);
    if (created === "exists") {
      return {
        ok: false,
        errors: { email: "emailTaken" },
        formError: null,
      };
    }
    // Best effort: a missing or switched-off email service never blocks sign-up.
    await sendVerification(created.id);
  } catch {
    return {
      ok: false,
      errors: {},
      formError: "somethingWrong",
    };
  }
  return { ok: true, errors: {}, formError: null };
}

// Step 1 of phone sign-in: texts a code. Returns a message code, or null when
// the code was sent. Server Actions are public endpoints, so check the type.
export async function requestPhoneCodeAction(
  phone: string,
): Promise<AuthMessage | null> {
  if (typeof phone !== "string") return "invalidPhone";
  try {
    const result = await requestPhoneCode(phone);
    switch (result) {
      case "sent":
        return null;
      case "invalid_phone":
        return "invalidPhone";
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
