"use server";

import { isUnsubscribeToken } from "@/lib/newsletter";
import { unsubscribeByToken } from "@/lib/newsletter-data";


export async function unsubscribeAction(
  token: string,
): Promise<{ message: "ok" | "not_found" | "error" }> {
  if (typeof token !== "string" || !isUnsubscribeToken(token)) return { message: "not_found" };
  return { message: await unsubscribeByToken(token) };
}
