"use server";

import { unsubscribeByToken } from "@/lib/newsletter-data";

const TOKEN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function unsubscribeAction(
  token: string,
): Promise<{ message: "ok" | "not_found" | "error" }> {
  if (typeof token !== "string" || !TOKEN.test(token)) return { message: "not_found" };
  return { message: await unsubscribeByToken(token) };
}
