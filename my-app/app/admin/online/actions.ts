"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth-guards";
import { parsePayhereSettings } from "@/lib/payhere";
import { payhereConfigured, savePayhereSettings } from "@/lib/payhere-data";

// Every action re-checks admin access first: Server Actions are endpoints of
// their own and can be called without going through the /admin pages.

export type PayhereSettingsState = { errors: Record<string, string>; saved: boolean };

export async function savePayhereSettingsAction(
  _prev: PayhereSettingsState,
  formData: FormData,
): Promise<PayhereSettingsState> {
  await requireAdmin("/admin/online");
  const fields: Record<string, string | undefined> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") fields[key] = value;
  }
  const parsed = parsePayhereSettings(fields);
  if (!parsed.ok) return { errors: parsed.errors, saved: false };
  if (parsed.value.enabled && !payhereConfigured()) {
    return {
      errors: { enabled: "Set PAYHERE_MERCHANT_ID and PAYHERE_MERCHANT_SECRET on the server first." },
      saved: false,
    };
  }
  try {
    await savePayhereSettings(parsed.value);
  } catch {
    return { errors: { form: "Something went wrong, please try again." }, saved: false };
  }
  // Order pages show or hide the Pay online section from these settings.
  revalidatePath("/admin/online");
  revalidatePath("/orders/[number]", "page");
  return { errors: {}, saved: true };
}
