"use server";

import { confirmEmailToken } from "@/lib/email-data";

/** Confirms an email address from the emailed link. The token works once. */
export async function confirmEmailAction(token: string): Promise<"ok" | "invalid" | "error"> {
  if (typeof token !== "string") return "invalid";
  return confirmEmailToken(token);
}
