"use server";

import { isHoneypotFilled, validateEmail } from "@/lib/newsletter";
import { subscribeEmail } from "@/lib/newsletter-data";

export type SubscribeResult = { message: "subscribed" | "invalid" | "busy" | "error" };

export async function subscribeNewsletter(formData: FormData): Promise<SubscribeResult> {
  const email = formData.get("email");
  const trap = formData.get("nb_hp");
  // Bots fill the hidden field: pretend it worked, store nothing.
  if (isHoneypotFilled(typeof trap === "string" ? trap : null)) return { message: "subscribed" };
  if (typeof email !== "string") return { message: "invalid" };
  const checked = validateEmail(email);
  if (!checked.ok) return { message: "invalid" };
  return { message: await subscribeEmail(checked.email, "footer") };
}
