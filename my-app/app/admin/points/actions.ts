"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth-guards";
import { parsePointsSettings } from "@/lib/points";
import { savePointsSettings } from "@/lib/points-data";

// Every action re-checks admin access first: Server Actions are endpoints of
// their own and can be called without going through the /admin pages.

export type PointsSettingsState = { errors: Record<string, string>; saved: boolean };

const SOMETHING_WRONG = "Something went wrong, please try again.";

function formFields(formData: FormData): Record<string, string | undefined> {
  const fields: Record<string, string | undefined> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") fields[key] = value;
  }
  return fields;
}

export async function savePointsSettingsAction(
  _prev: PointsSettingsState,
  formData: FormData,
): Promise<PointsSettingsState> {
  await requireAdmin("/admin/points");
  const parsed = parsePointsSettings(formFields(formData));
  if (!parsed.ok) return { errors: parsed.errors as Record<string, string>, saved: false };
  try {
    await savePointsSettings(parsed.value);
  } catch {
    return { errors: { form: SOMETHING_WRONG }, saved: false };
  }
  // Checkout, the account page and order pages read these settings.
  revalidatePath("/admin/points");
  revalidatePath("/checkout");
  revalidatePath("/account");
  return { errors: {}, saved: true };
}
