"use server";

import { isHoneypotFilled, validateEmail } from "@/lib/newsletter";
import { headers } from "next/headers";
import { clientIp } from "@/lib/email";
import { allowRequest } from "@/lib/email-data";
import { subscribeEmail } from "@/lib/newsletter-data";

export type SubscribeResult = { message: "confirm" | "invalid" | "busy" | "unavailable" | "error" };

export async function subscribeNewsletter(formData: FormData): Promise<SubscribeResult> {
  const email = formData.get("email");
  const trap = formData.get("nb_hp");
  // Bots fill the hidden field: pretend it worked, store nothing.
  if (isHoneypotFilled(typeof trap === "string" ? trap : null)) return { message: "confirm" };
  if (typeof email !== "string") return { message: "invalid" };
  const checked = validateEmail(email);
  if (!checked.ok) return { message: "invalid" };
  // Five tries an hour per IP, so the form cannot be used to mail-bomb people.
  const h = await headers();
  if (!(await allowRequest("newsletter-ip", clientIp((name) => h.get(name)), 5, 3600))) return { message: "busy" };
  return { message: await subscribeEmail(checked.email, "footer") };
}
