"use server";

import { requireUser } from "@/lib/auth-guards";
import { registerToken, unregisterToken } from "@/lib/push-data";

// Both actions take the user from the session, never from the arguments: a
// customer can only register or remove their OWN devices. They return a code.

export type PushActionResult = "ok" | "invalid" | "too_many" | "error";

/** Saves this browser's FCM token for the signed-in customer (10 an hour, 10 devices). */
export async function registerCustomerPushAction(token: string, platform: string): Promise<PushActionResult> {
  const user = await requireUser("/account");
  if (typeof token !== "string" || typeof platform !== "string" || platform !== "web") return "invalid";
  try {
    return await registerToken(user.id, "web", token);
  } catch {
    return "error";
  }
}

export async function unregisterCustomerPushAction(token: string): Promise<PushActionResult> {
  const user = await requireUser("/account");
  if (typeof token !== "string") return "invalid";
  try {
    const result = await unregisterToken(user.id, token);
    return result === "ok" || result === "not_found" ? "ok" : result === "invalid" ? "invalid" : "error";
  } catch {
    return "error";
  }
}
