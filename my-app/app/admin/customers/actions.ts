"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth-guards";
import { setUserTrusted } from "@/lib/payments-data";

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
