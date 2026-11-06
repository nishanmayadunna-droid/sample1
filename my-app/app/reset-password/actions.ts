"use server";

import type { AuthMessage } from "@/lib/auth-messages";
import { completePasswordReset } from "@/lib/email-data";

/** Step 2 of a password reset: the emailed token plus the new password. The token works once. */
export async function resetPasswordAction(token: string, password: string): Promise<AuthMessage> {
  if (typeof token !== "string" || typeof password !== "string") return "linkInvalid";
  switch (await completePasswordReset(token, password)) {
    case "ok":
      return "passwordChanged";
    case "invalid_password":
      return "passwordLength";
    case "invalid_token":
      return "linkInvalid";
    default:
      return "somethingWrong";
  }
}
