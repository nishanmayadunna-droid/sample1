"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth-guards";
import { deleteSubscriber } from "@/lib/newsletter-data";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function deleteSubscriberAction(id: string): Promise<{ error: string | null }> {
  await requireAdmin("/admin/newsletter");
  if (typeof id !== "string" || !UUID.test(id)) {
    return { error: "That subscriber can't be deleted (refresh the page)." };
  }
  try {
    await deleteSubscriber(id);
  } catch {
    return { error: "Something went wrong, please try again." };
  }
  revalidatePath("/admin/newsletter");
  return { error: null };
}
