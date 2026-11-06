"use server";

import { requireUser } from "@/lib/auth-guards";
import type { AuthMessage } from "@/lib/auth-messages";
import { sendVerification } from "@/lib/email-data";

/** Emails the signed-in account a fresh confirmation link (at most 3 an hour, enforced in the database). */
export async function resendVerificationAction(): Promise<AuthMessage> {
  const user = await requireUser("/account");
  switch (await sendVerification(user.id)) {
    case "sent":
      return "verificationSent";
    case "already":
      return "emailVerified";
    case "too_many":
      return "tooManyRequests";
    default:
      return "emailUnavailable";
  }
}
