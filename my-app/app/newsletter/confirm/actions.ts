"use server";

import { confirmNewsletterToken } from "@/lib/newsletter-data";

/** Confirms a newsletter subscription from the emailed link (double opt-in). */
export async function confirmNewsletterAction(token: string): Promise<"ok" | "invalid" | "error"> {
  if (typeof token !== "string") return "invalid";
  return confirmNewsletterToken(token);
}
