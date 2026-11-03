"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth-guards";
import { setUserTrusted } from "@/lib/payments-data";
import { adjustPoints } from "@/lib/points-data";

// Every action re-checks admin access first: Server Actions are endpoints of
// their own and can be called without going through the /admin pages.

const SOMETHING_WRONG = "Something went wrong, please try again.";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Trusts or untrusts a customer by hand. Trusted customers order with plain COD. */
export async function setTrustedAction(
  userId: string,
  trusted: boolean,
): Promise<{ error: string | null }> {
  await requireAdmin("/admin/customers");
  if (typeof userId !== "string" || !UUID.test(userId) || typeof trusted !== "boolean") {
    return { error: SOMETHING_WRONG };
  }
  try {
    if (!(await setUserTrusted(userId, trusted))) return { error: "That customer no longer exists." };
  } catch {
    return { error: SOMETHING_WRONG };
  }
  revalidatePath("/admin/customers");
  revalidatePath("/account");
  revalidatePath("/checkout");
  return { error: null };
}

/** Adds or removes points by hand. The database refuses a balance below zero. */
export async function adjustPointsAction(
  userId: string,
  points: number,
  note: string,
): Promise<{ error: string | null }> {
  await requireAdmin("/admin/customers");
  const cleanNote = typeof note === "string" ? note.trim() : "";
  if (
    typeof userId !== "string" ||
    !UUID.test(userId) ||
    !Number.isSafeInteger(points) ||
    points === 0 ||
    Math.abs(points) > 1_000_000 ||
    cleanNote === "" ||
    cleanNote.length > 200 ||
    /[\u0000-\u001F\u007F]/.test(cleanNote)
  ) {
    return { error: "Enter a whole number of points (not 0) and a short note." };
  }
  try {
    const result = await adjustPoints(userId, points, cleanNote);
    if (!result.ok) {
      if (result.error === "would_go_negative") return { error: "That would take the balance below zero." };
      if (result.error === "not_found") return { error: "That customer no longer exists." };
      return { error: SOMETHING_WRONG };
    }
  } catch {
    return { error: SOMETHING_WRONG };
  }
  revalidatePath("/admin/customers");
  revalidatePath("/account");
  revalidatePath("/checkout");
  return { error: null };
}
