"use server";

import { headers } from "next/headers";
import type { AuthMessage } from "@/lib/auth-messages";
import { clientIp } from "@/lib/email";
import { requestPasswordReset } from "@/lib/email-data";

/**
 * Step 1 of a password reset. The answer is the same whether or not the address
 * has an account, so this form cannot be used to find out who is registered.
 */
export async function requestPasswordResetAction(email: string): Promise<AuthMessage> {
  if (typeof email !== "string") return "invalidEmail";
  const h = await headers();
  const result = await requestPasswordReset(email, clientIp((name) => h.get(name)));
  if (result === "invalid") return "invalidEmail";
  if (result === "busy") return "tooManyRequests";
  return "resetRequested";
}
